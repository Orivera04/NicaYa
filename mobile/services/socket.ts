import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants/endpoints';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  const baseUrl = API_BASE_URL.replace('/api', '');

  socket = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
