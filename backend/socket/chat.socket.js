const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt.util');
const chatService = require('../services/chat.service');
const prisma = require('../config/db.config');
const logger = require('../utils/logger');

let io;

const setupSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Set to specific frontend origin in production
      methods: ['GET', 'POST'],
    },
  });

  // Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = verifyToken(token, false);
      socket.user = decoded; // Attach user to socket
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected to chat socket: ${socket.user.id}`);

    // Join per-user room for in-app notifications
    socket.join(`user:${socket.user.id}`);

    // chat:join
    socket.on('chat:join', async ({ swapId }) => {
      try {
        const swap = await prisma.swap.findUnique({
          where: { id: swapId },
        });

        if (!swap) return socket.emit('chat:error', { code: 'NOT_FOUND', message: 'Swap not found' });
        
        if (swap.initiatorId !== socket.user.id && swap.receiverId !== socket.user.id) {
          return socket.emit('chat:error', { code: 'FORBIDDEN', message: 'Not a participant of this swap' });
        }

        const room = `swap:${swapId}`;
        socket.join(room);
        logger.info(`User ${socket.user.id} joined room ${room}`);
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // chat:message
    socket.on('chat:message', async (data) => {
      const { swapId, content, msgType } = data;
      try {
        const room = `swap:${swapId}`;
        
        // Find chat by swapId. If doesn't exist, create it.
        let chat = await prisma.chat.findUnique({ where: { swapId } });
        if (!chat) {
            chat = await chatService.createChatForSwap(swapId);
        }

        const message = await chatService.sendMessage(chat.id, socket.user.id, { content, msgType });
        
        // Broadcast to room
        io.to(room).emit('chat:message', message);
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // chat:typing
    socket.on('chat:typing', ({ swapId }) => {
      const room = `swap:${swapId}`;
      socket.to(room).emit('chat:typing', {
        userId: socket.user.id,
        // Optional: Send display name but usually client resolves from userId
      });
    });

    // chat:read
    socket.on('chat:read', async ({ swapId }) => {
      try {
        const chat = await prisma.chat.findUnique({ where: { swapId } });
        if (chat) {
          await chatService.markMessagesRead(chat.id, socket.user.id);
          
          const room = `swap:${swapId}`;
          // Emit read receipt to the room
          io.to(room).emit('chat:read-receipt', {
            userId: socket.user.id,
            readAt: new Date(),
          });
        }
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // chat:leave
    socket.on('chat:leave', ({ swapId }) => {
      const room = `swap:${swapId}`;
      socket.leave(room);
      logger.info(`User ${socket.user.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected from chat socket: ${socket.user.id}`);
    });
  });

  return io;
};

// Export the setup function and possibly the io instance getter if we need to emit outside
module.exports = {
  setupSocket,
  getIo: () => io,
};
