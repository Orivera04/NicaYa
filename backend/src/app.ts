import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './middleware/error.middleware';
import routes from './routes';
import { logger } from './utils/logger';

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Routes
app.use('/api', routes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
});

// Error handler (must be last)
app.use(errorMiddleware);

export default app;
