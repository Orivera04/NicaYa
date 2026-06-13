import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../db';
import { logger } from '../utils/logger';

let ioInstance: Server | null = null;

export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket.io not initialized');
  return ioInstance;
}

export function initSocket(io: Server): void {
  ioInstance = io;

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { userId: string; role: string }).userId = payload.userId;
      (socket.data as { userId: string; role: string }).role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };
    logger.info('Socket connected', { userId, role, socketId: socket.id });

    // Rider sends location updates
    socket.on('rider:location', async (data: { lat: number; lng: number }) => {
      if (role !== 'RIDER') return;
      try {
        await prisma.riderProfile.update({
          where: { userId },
          data: { latitude: data.lat, longitude: data.lng },
        });
        // Broadcast to clients (for map markers)
        socket.broadcast.emit('rider:location', { riderId: userId, ...data });
      } catch (err) {
        logger.error('Failed to update rider location', { userId, error: (err as Error).message });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId, socketId: socket.id });
    });
  });
}
