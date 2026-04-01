import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { getIo } from '../socket.js'; // Нам нужно импортировать io, добавим экспорт в socket.ts

const router = Router();

// 1. СОЗДАНИЕ КОМНАТЫ
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const hostId = req.user?.id; 

    if (!hostId) {
      res.status(401).json({ message: "Пользователь не авторизован" });
      return;
    }

    const room = await prisma.room.create({
      data: {
        title: title || `Комната пользователя`,
        hostId: hostId,
      },
      include: {
        host: { select: { username: true } }
      }
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Ошибка при создании комнаты:", error);
    res.status(500).json({ message: 'Ошибка сервера при создании комнаты' });
  }
});
// 2. ПОЛУЧЕНИЕ ВСЕХ КОМНАТ (ЛОББИ)
router.get('/', async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { host: { select: { username: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Добавляем реальный счетчик онлайна из сокетов
    const io = getIo();
    const roomsWithCount = rooms.map(room => {
      const count = io ? (io.sockets.adapter.rooms.get(room.id)?.size || 0) : 0;
      return { ...room, usersCount: count };
    });

    res.json(roomsWithCount);
  } catch (error) {
    console.error("Ошибка при получении списка комнат:", error);
    res.status(500).json({ message: 'Ошибка при получении комнат' });
  }
});

// 3. ПОЛУЧЕНИЕ ОДНОЙ КОМНАТЫ ПО ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // ГАРАНТИЯ ДЛЯ TYPESCRIPT
    if (!id || id === 'undefined' || id === '[id]') {
      res.status(400).json({ message: 'ID комнаты не указан или неверен: ' + id });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { id: id as string }, 
      include: { host: { select: { username: true } } }
    });

    if (!room) {
      res.status(404).json({ message: 'Комната не найдена' });
      return;
    }

    res.json(room);
  } catch (error: any) {
    console.error("Ошибка при получении комнаты по ID:", error.message || error);
    res.status(500).json({ message: 'Ошибка сервера: ' + (error.message || 'unknown') });
  }
});

// 4. ОБНОВЛЕНИЕ ВИДЕО В КОМНАТЕ (PATCH)
router.patch('/:id/video', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { videoUrl } = req.body; 
    const userId = req.user?.id;

    if (!id || id === 'undefined') {
      res.status(400).json({ message: 'Неверный ID комнаты при обновлении: ' + id });
      return;
    }

    const room = await prisma.room.findUnique({ where: { id: id as string } }); 
    if (!room) { res.status(404).json({ message: 'Комната не найдена' }); return; }

    if (room.hostId !== userId) {
      res.status(403).json({ message: 'Только хост может менять видео' });      
      return;
    }

    const updatedRoom = await prisma.room.update({
      where: { id: id as string },
      data: { videoUrl },
      include: { host: { select: { username: true } } } 
    });

    res.json(updatedRoom);
  } catch (error: any) {
    console.error("Ошибка обновления видео:", error.message || error);
    res.status(500).json({ message: 'Ошибка обновления: ' + (error.message || 'unknown') });
  }
});

export default router;