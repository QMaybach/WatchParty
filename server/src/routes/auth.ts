import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

const router = Router();

// ВЫНЕСИ СЕКРЕТ В КОНСТАНТУ (для теста)
const JWT_SECRET = process.env.JWT_SECRET || 'watch-party-super-secret-2025';

router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findFirst({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.status(401).json({ error: 'Неверный email или пароль' });
            return;
        }

        // ВАЖНО: Мы кладем "id", а не "userId"
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`[AUTH] Токен создан для ${user.email} с секретом: ${JWT_SECRET.substring(0, 3)}...`);

        res.status(200).json({
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Скопируй ту же логику создания токена в /register, если нужно

router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password } = req.body;
        
        // Проверка, существует ли юзер
        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                username: username || 'Guest',
                email,
                password: hashedPassword,
            }
        });

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`[AUTH] Создан новый пользователь: ${user.email}`);

        res.status(200).json({
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

export default router;