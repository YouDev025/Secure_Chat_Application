import * as dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app';
import prisma from './lib/prisma';
import { updateProfile } from './lib/profileStore';

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  console.warn('JWT_SECRET is not set. Using a development-only fallback secret.');
}

const socketJwtSecret = JWT_SECRET || 'dev-only-jwt-secret';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware for socket auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, socketJwtSecret) as { userId: string; username: string };
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Store connected users: userId -> socket IDs
const connectedUsers = new Map<string, Set<string>>();

const addConnectedUser = (userId: string, socketId: string) => {
  const sockets = connectedUsers.get(userId) || new Set<string>();
  sockets.add(socketId);
  connectedUsers.set(userId, sockets);
};

const removeConnectedUser = (userId: string, socketId: string) => {
  const sockets = connectedUsers.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    connectedUsers.delete(userId);
  }
};

io.on('connection', (socket: Socket) => {
  const userId = socket.data.user.userId;
  addConnectedUser(userId, socket.id);
  console.log(`User connected: ${socket.id} (User ID: ${userId})`);

  socket.on('disconnect', () => {
    removeConnectedUser(userId, socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('send_message', async (data: { receiverId: string; encryptedContent: string; iv: string }) => {
    try {
      const { receiverId, encryptedContent, iv } = data;

      // Save to database
      const savedMessage = await prisma.message.create({
        data: {
          content: encryptedContent,
          iv: iv,
          senderId: userId,
          receiverId: receiverId,
        }
      });

      // Send to receiver if online
      const receiverSocketIds = connectedUsers.get(receiverId);
      const delivered = Boolean(receiverSocketIds?.size);

      if (receiverSocketIds) {
        receiverSocketIds.forEach((receiverSocketId) => {
          io.to(receiverSocketId).emit('receive_message', savedMessage);
        });
      }
      
      // Also send back to sender to confirm
      socket.emit('message_sent_confirm', { ...savedMessage, delivered });
    } catch (error) {
      console.error('Error saving/sending message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });
  
  socket.on('get_messages', async (data: { withUserId: string }) => {
    try {
      // Get conversation history
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: data.withUserId },
            { senderId: data.withUserId, receiverId: userId }
          ]
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      socket.emit('chat_history', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  });

  socket.on('update_profile', (data: any) => {
    const updatedProfile = updateProfile(userId, {
      username: data.username,
      email: data.email,
      phoneNumber: data.phoneNumber,
      description: data.description,
      status: data.status,
      avatarUrl: data.avatarUrl
    });

    socket.broadcast.emit('user_profile_updated', {
      userId,
      ...updatedProfile
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
