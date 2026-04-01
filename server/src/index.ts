import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5177'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5177'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log('User joined room', roomId);
  });

  socket.on('play', (roomId) => {
    socket.to(roomId).emit('play');
  });

  socket.on('pause', (roomId) => {
    socket.to(roomId).emit('pause');
  });

  socket.on('video-change', (roomId, url) => {
    socket.to(roomId).emit('video-change', url);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

app.use(express.json());

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {    
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send({});
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Сервер запущен на http://0.0.0.0:' + PORT);
});
