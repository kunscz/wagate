import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import qrcode from 'qrcode';
import pino from 'pino';
import path from 'path';
import { prisma } from '../utils/prisma.js';

export class WhatsAppService {
  constructor(io) {
    this.logger = pino({ level: 'info' });
    this.authDir = path.join(process.cwd(), 'auth_info_baileys');
    this.queue = new Map();
    this.maxRetries = 3;
    this.baseDelayMs = 1000; // Renamed for clarity
    this.io = io;
    this.sock = null;
    this.qrCode = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.isConnected = false;
    this.initialize();
  }

  async initialize() {
    if (this.isConnecting || this.sock) return;
    this.isConnecting = true;

    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        browser: Browsers.windows('Chrome'),
        syncFullHistory: false,
        connectTimeoutMs: 60000, // Increased from 30000 to 60s
        keepAliveIntervalMs: 30000, // Increased from 15000 to 30s
        mobile: false,
        version,
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
      this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));
      this.processQueue();
    } catch (err) {
      this.logger.error({ err, stack: err.stack }, 'Failed to initialize WhatsApp socket');
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

   handleConnectionUpdate(update) {
      const { connection, lastDisconnect, qr } = update;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message;

      if (connection === 'open') {
         this.isConnecting = false;
         this.isConnected = true;
         this.reconnectAttempts = 0;
         this.io.emit('connectionStatus', { status: 'connected' });
         this.logger.info('WhatsApp connection opened');
      } else if (connection === 'close') {
         this.isConnecting = false;
         this.isConnected = false;
         this.io.emit('connectionStatus', { status: 'disconnected', reason });
         this.logger.info({ statusCode, reason }, 'WhatsApp connection closed');

         if (statusCode === DisconnectReason.restartRequired) {
            this.logger.info('Restart required. Resetting socket.');
            this.sock = null;
            this.scheduleReconnect();
            return;
         }

         this.scheduleReconnect();
      } else if (qr) {
         this.qrCode = qr;
         this.io.emit('qrCode', { qr });
         this.logger.info('New QR code generated');
      }
   }

   handleMessagesUpsert(m) {
    const msg = m.messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      const keyword = msg.message.conversation.toLowerCase();
      this.getAutoReply(keyword).then((autoReply) => {
        if (autoReply) {
          this.sendMessage(msg.key.remoteJid, autoReply.response).then(() => {
            this.logger.info(`Sent auto-reply to ${msg.key.remoteJid}: ${autoReply.response}`);
          }).catch((err) => {
            this.logger.error({ err, keyword }, 'Failed to send auto-reply');
          });
        }
      }).catch((err) => {
        this.logger.error({ err, keyword }, 'Failed to fetch auto-reply');
      });
    }
   }

   scheduleReconnect() {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      const attempts = (this.queue.size > 0 ? 0 : this.reconnectAttempts++) || 0;
      if (attempts < this.maxRetries) {
         const delay = this.baseDelayMs * Math.pow(2, attempts) + Math.random() * 1000;
         this.logger.info({ attempts, delay }, 'Scheduling reconnect');

         this.reconnectTimeout = setTimeout(async () => {
            this.sock = null;
            await this.initialize()
         }, delay);
      } else {
         this.logger.error('Max reconnect attempts reached');
      }
   }

  async processQueue() {
    if (!this.sock || this.isConnecting || !this.isConnected) return;

    for (const [messageId, { to, content, retries = 0 }] of this.queue) {
      if (retries >= this.maxRetries) {
        this.logger.error({ messageId, to }, 'Max retries reached, message dropped');
        this.io.emit('messageStatus', { id: messageId, status: 'failed', error: 'Max retries reached' });
        this.queue.delete(messageId);
        continue;
      }

      try {
        let normalizedTo = to.replace(/[^\d+]/g, '');
        if (!normalizedTo.startsWith('+')) {
          normalizedTo = '+' + normalizedTo;
        }
        if (normalizedTo.startsWith('++')) {
          normalizedTo = '+' + normalizedTo.slice(2);
        }
        const formattedNumber = `${normalizedTo.replace('+', '')}@s.whatsapp.net`; // Remove + before JID
        this.io.emit('messageStatus', { id: messageId, status: 'sending' });

        const messageText = typeof content.text === 'string' ? content.text : (typeof content === 'string' ? content : '');
        if (!messageText) {
          throw new Error('Message content is invalid or empty');
        }

        const result = await this.sock.sendMessage(formattedNumber, { text: messageText });
        this.logger.info({ messageId, to: formattedNumber }, 'Message sent successfully');
        this.io.emit('messageStatus', { id: messageId, status: 'sent' });
        this.queue.delete(messageId);
        await prisma.message.create({
          data: { id: messageId, recipient: formattedNumber, content: messageText, type: 'text', status: 'sent' },
        });
      } catch (err) {
        this.logger.error({ err, messageId, to, retries, stack: err.stack }, 'Failed to send message');
      //   this.io.emit('messageStatus', { id: messageId, status: 'failed', error: err.message });
        if (err.message.includes('timeout') || err.message.includes('not connected')) {
            const newMessageId = uuidv4();
            this.queue.set(newMessageId, { to, content, retries: retries + 1 });
            this.io.emit('messageStatus', { id: newMessageId, status: 'queued', previousId: messageId })
        } else {
          this.queue.delete(messageId);
          await prisma.message.create({
            data: {
               id: messageId,
               recipient: to,
               content: typeof content.text === 'string' ? content.text : (typeof content === 'string' ? content : ''),
               type: 'text',
               status: 'failed',
               error: err.message
            },
          }).catch((prismaErr) => {
            this.logger.error({ prismaErr, messageId, stack: prismaErr.stack }, 'Failed to record failed message');
          });
        }
      }
    }
  }

  async sendMessage(to, content) {
    const messageId = uuidv4();
    const messageContent = typeof content === 'string' ? { text: content } : content;
    this.queue.set(messageId, { to, content: messageContent });
    this.io.emit('messageStatus', { id: messageId, status: 'queued' });
    this.logger.info({ messageId, to }, 'Message queued');
    this.processQueue();
    return { id: messageId, status: 'queued' };
  }

  async getQrCode() {
    if (this.isConnected) {
      return { status: 'connected', qr: null, message: 'WhatsApp is already connected.' };
    }
    if (!this.qrCode) {
      return { status: 'waiting', qr: null, message: 'Waiting for QR code generation.' };
    }
    try {
      const qrImage = await qrcode.toDataURL(this.qrCode, { small: true });
      return { status: 'qr', qr: qrImage, message: 'Scan this QR code with WhatsApp.' };
    } catch (err) {
      this.logger.error({ err }, 'QR code generation failed.');
      throw new Error('Failed to generate QR code image.');
    }
  }

  getClientStatus() {
    return { isConnected: this.isConnected, hasQr: !!this.qrCode };
  }

  async sendMessages(to, content) {
    this.logger.warn('sendMessages is deprecated, use sendMessage instead');
    return this.sendMessage(to, content);
  }

  async getAutoReply(keyword) {
    if (!keyword) return null;
    try {
      const autoReply = await prisma.autoReply.findFirst({
        where: { keyword: { equals: keyword, mode: 'insensitive' } },
      });
      this.logger.info({ keyword, found: !!autoReply }, 'Auto-reply queried');
      return autoReply;
    } catch (err) {
      this.logger.error({ err, keyword }, 'Failed to query auto-reply');
      throw err;
    }
  }
}