import pino from 'pino';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';

import app from './app.js';
import { WhatsAppService } from './services/whatsapp.js';

const logger = pino({ level: 'info' }); // Global logger
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173' }, // Match frontend URL
});

/**
 * @type {WhatsAppService}
 * @description Singleton instance of WhatsAppService for managing WhatsApp connections and messaging.
 * @note Only one instance should exist to avoid session conflicts with WhatsApp's multi-device API.
 */
const whatsappService = new WhatsAppService(io);

/**
 * @function
 * @name initializeServer
 * @description Initializes the server, WhatsAppService, and starts listening on the specified port.
 * @returns {Promise<void>}
 */
async function initializeServer() {
  try {
    await whatsappService.initialize();
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`API Docs available at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    logger.error({ err, stack: err.stack }, 'Failed to start server or initialize WhatsApp service');
    process.exit(1); // Exit on failure to ensure a clean restart
  }
}

initializeServer();

export { whatsappService, io };