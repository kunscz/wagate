import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Boom } from '@hapi/boom';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { body, validationResult } from 'express-validator';
import { whatsappService, io } from '../server.js'; // Import from app.js
import pino from 'pino';

/**
 * @module api
 * @description API routes for authentication, messaging, templates, auto-replies, and WhatsApp management.
 */

const router = express.Router();
const logger = pino({ level: 'info' }); // Local logger for route-specific logging

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid credentials
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send a WhatsApp message
 *     description: Send a text message to a WhatsApp recipient, optionally using a template.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipient:
 *                 type: string
 *                 description: Phone number with country code (e.g., +6281234567890)
 *                 example: "+6281234567890"
 *               content:
 *                 type: string
 *                 description: Message content (required if no templateId is provided)
 *                 example: "Hello, this is a test message"
 *               templateId:
 *                 type: integer
 *                 description: ID of the template to use (optional, overrides content)
 *                 example: 1
 *             required:
 *               - recipient
 *     responses:
 *       200:
 *         description: Message queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 status:
 *                   type: string
 *                   example: "queued"
 *       400:
 *         description: Validation error or missing template/content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         example: "Invalid phone number format"
 *       404:
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Template not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to send message"
 *                 data:
 *                   type: object
 *                   properties:
 *                     details:
 *                       type: string
 *                       example: "Cannot destructure property 'user' of undefined"
 */
router.post(
  '/messages',
  authMiddleware,
  [
    body('recipient')
      .notEmpty()
      .withMessage('Recipient is required')
      .matches(/^\+?\d{8,15}$/)
      .withMessage('Invalid phone number format (e.g., +6281234567890)'),
    body('content')
      .optional()
      .notEmpty()
      .withMessage('Content is required if no template is used')
      .isString()
      .withMessage('Content must be a string'),
    body('templateId')
      .optional()
      .isInt()
      .withMessage('Template ID must be an integer'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { recipient, content, templateId } = req.body;
      let messageContent = content;

      if (templateId) {
        const template = await prisma.template.findUnique({ where: { id: templateId } });
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
        if (!template.content) {
          return res.status(400).json({ error: 'Template content is empty' });
        }
        messageContent = template.content;
      } else if (!content) {
        return res.status(400).json({ error: 'Content or templateId is required' });
      }

      const formattedRecipient = recipient.replace(/\D/g, '').startsWith('+')
        ? `${recipient.replace(/\D/g, '')}@s.whatsapp.net`
        : `+${recipient.replace(/\D/g, '')}@s.whatsapp.net`;
      const response = await whatsappService.sendMessage(formattedRecipient, { text: messageContent });
      await prisma.message.create({
        data: {
          id: response.id,
          recipient: formattedRecipient,
          content: messageContent,
          type: 'text',
          status: 'queued',
        },
      });
      res.json(response);
    } catch (err) {
      logger.error({ err, stack: err.stack }, 'Failed to send message in API');
      next(new Boom(err.message || 'Failed to send message', { statusCode: 500, data: { details: err.message } }));
    }
  }
);

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Retrieve all messages
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   recipient:
 *                     type: string
 *                     example: "+6281234567890@s.whatsapp.net"
 *                   content:
 *                     type: string
 *                     example: "Hello, this is a test message"
 *                   type:
 *                     type: string
 *                     example: "text"
 *                   status:
 *                     type: string
 *                     example: "sent"
 *                   sentAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-06-19T03:20:00Z"
 *       401:
 *         description: Unauthorized
 */
router.get('/messages', authMiddleware, async (req, res, next) => {
  try {
    const messages = await prisma.message.findMany();
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create a message template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Welcome
 *               content:
 *                 type: string
 *                 example: Welcome to our service!
 *     responses:
 *       200:
 *         description: Template created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: Welcome
 *                 content:
 *                   type: string
 *                   example: Welcome to our service!
 *       401:
 *         description: Unauthorized
 */
router.post('/templates', authMiddleware, async (req, res, next) => {
  try {
    const { name, content } = req.body;
    const template = await prisma.template.create({ data: { name, content } });
    res.json(template);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Retrieve all templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: Welcome
 *                   content:
 *                     type: string
 *                     example: Welcome to our service!
 *       401:
 *         description: Unauthorized
 */
router.get('/templates', authMiddleware, async (req, res, next) => {
  try {
    const templates = await prisma.template.findMany();
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auto-replies:
 *   post:
 *     summary: Create an auto-reply rule
 *     tags: [AutoReplies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *                 example: hello
 *               response:
 *                 type: string
 *                 example: Hi there!
 *     responses:
 *       200:
 *         description: Auto-reply created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 keyword:
 *                   type: string
 *                   example: hello
 *                 response:
 *                   type: string
 *                   example: Hi there!
 *       401:
 *         description: Unauthorized
 */
router.post('/auto-replies', authMiddleware, async (req, res, next) => {
  try {
    const { keyword, response } = req.body;
    const autoReply = await prisma.autoReply.create({ data: { keyword, response } });
    res.json(autoReply);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auto-replies:
 *   get:
 *     summary: Retrieve all auto-reply rules
 *     tags: [AutoReplies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of auto-replies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   keyword:
 *                     type: string
 *                     example: hello
 *                   response:
 *                     type: string
 *                     example: Hi there!
 *       401:
 *         description: Unauthorized
 */
router.get('/auto-replies', authMiddleware, async (req, res, next) => {
  try {
    const autoReplies = await prisma.autoReply.findMany();
    res.json(autoReplies);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password
 *     responses:
 *       200:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *       400:
 *         description: Invalid input or email already exists
 */
router.post('/auth/signup', [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword } });
    res.json({ message: 'User created', user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Unauthorized
 */
router.post('/auth/refresh', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/whatsapp/qr:
 *   get:
 *     summary: Get WhatsApp QR code
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: qr
 *                 qr:
 *                   type: string
 *                   example: data:image/png;base64,...
 *                 message:
 *                   type: string
 *                   example: Scan this QR code with WhatsApp.
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch QR code
 */
router.get('/whatsapp/qr', authMiddleware, async (req, res, next) => {
  try {
    const qr = await whatsappService.getQrCode();
    res.json(qr);
  } catch (err) {
    logger.error({ err, stack: err.stack }, 'Failed to fetch QR code');
    next(new Boom(err.message || 'Failed to fetch QR code', { statusCode: 500 }));
  }
});

/**
 * @swagger
 * /api/whatsapp/status:
 *   get:
 *     summary: Get WhatsApp connection status
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isConnected:
 *                   type: boolean
 *                   example: true
 *                 hasQr:
 *                   type: boolean
 *                   example: false
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch status
 */
router.get('/whatsapp/status', authMiddleware, (req, res, next) => {
  try {
    const status = whatsappService.getClientStatus();
    res.json(status);
  } catch (err) {
    logger.error({ err, stack: err.stack }, 'Failed to fetch status');
    next(new Boom(err.message || 'Failed to fetch status', { statusCode: 500 }));
  }
});

/**
 * @swagger
 * /api/whatsapp/disconnect:
 *   post:
 *     summary: Disconnect WhatsApp account
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WhatsApp disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: WhatsApp disconnected successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/whatsapp/disconnect', authMiddleware, async (req, res, next) => {
  try {
    if (whatsappService.sock) {
      await whatsappService.sock.logout();
      whatsappService.sock.ws.close();
      whatsappService.sock = null;
    }
    whatsappService.qrCode = null;
    whatsappService.isConnected = false;
    await whatsappService.initialize();
    res.json({ message: 'WhatsApp disconnected successfully' });
  } catch (err) {
    logger.error({ err, stack: err.stack }, 'Failed to disconnect WhatsApp');
    next(new Boom(err.message || 'Failed to disconnect WhatsApp', { statusCode: 500 }));
  }
});

router.use((err, req, res, next) => {
  logger.error({ err, stack: err.stack }, 'Internal server error');
  res.status(500).json({ error: 'Internal server error' });
});

export default router;