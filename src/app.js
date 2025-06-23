import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import apiRoutes from './routes/api.js';
import swaggerSpec from './swagger.js';

const app = express();

/**
 * @module app
 * @description Express application setup with middleware, routes, and Swagger documentation.
 */

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @function
 * @name errorHandler
 * @description Global error handler for the Express application.
 * @param {Error} err - The error object.
 * @param {express.Request} req - The request object.
 * @param {express.Response} res - The response object.
 * @param {express.NextFunction} next - The next middleware function.
 */
app.use((err, req, res, next) => {
  // No logger here; assume it's handled in server.js
  res.status(500).json({ error: 'Internal server error' });
});

export default app;