import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { connectDB } from './db';
import { initSocket } from './sockets/trip.socket';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function bootstrap(): Promise<void> {
  await connectDB();

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  initSocket(io);

  httpServer.listen(PORT, () => {
    logger.info(`MotoYa API running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
