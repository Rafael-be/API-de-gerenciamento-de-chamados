import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { appConfig } from '../config/env';
import type { Notification } from '../domain/models';
import { consumeSocketTicket } from '../services/notification.service';

let socketServer: SocketIOServer | null = null;

export function setSocketServer(server: SocketIOServer | null): void {
  socketServer = server;
}

export function attachSocketServer(httpServer: http.Server): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: appConfig.corsOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const ticket = typeof socket.handshake.auth?.ticket === 'string' ? socket.handshake.auth.ticket : undefined;

    if (!ticket) {
      next(new Error('INVALID_SOCKET_TICKET'));
      return;
    }

    void consumeSocketTicket(ticket).then((userId) => {
      if (userId === null) {
        next(new Error('INVALID_SOCKET_TICKET'));
        return;
      }
      socket.data.userId = userId;
      socket.join(`user:${userId}`);
      next();
    }).catch(next);
  });

  io.on('connection', (socket) => {
    socket.emit('connected', {
      ok: true,
      userId: socket.data.userId,
    });
  });

  setSocketServer(io);
  return io;
}

export function emitNotificationToUser(userId: number, notification: Notification): void {
  if (!socketServer) {
    return;
  }

  socketServer.to(`user:${userId}`).emit('notification:new', notification);
}
