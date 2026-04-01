import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export let getIo: () => Server | undefined = () => undefined;

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  
  getIo = () => io;

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
      // Рассылаем всем в комнате (включая только что вошедшего) новое количество людей
      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit('room-users-count', roomSize);
    });

    socket.on('play', (roomId, time) => {
      socket.to(roomId).emit('play', time);
    });

    socket.on('pause', (roomId, time) => {
      socket.to(roomId).emit('pause', time);
    });

    socket.on('seek', (roomId, time) => {
      socket.to(roomId).emit('seek', time);
    });

    socket.on('video-change', (roomId, url) => {
      socket.to(roomId).emit('video-change', url);
    });

    socket.on('chat-message', (roomId, msg) => {
      console.log(`Chat message in ${roomId}:`, msg);
      socket.to(roomId).emit('chat-message', msg);
    });

    // Отслеживаем отключение от комнат, чтобы обновить счетчик онлайна
    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 1;
          socket.to(roomId).emit('room-users-count', roomSize - 1);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}