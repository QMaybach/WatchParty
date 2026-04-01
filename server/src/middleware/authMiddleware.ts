import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ВАЖНО: Секрет должен быть ИДЕНТИЧЕН тому, что в auth.ts
const JWT_SECRET = process.env.JWT_SECRET || 'watch-party-super-secret-2025';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("[AUTH MW] Нет заголовка Authorization");
    res.status(401).json({ message: 'Токен отсутствует' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Проверка
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = decoded;
    console.log(`[AUTH MW] Токен валиден для юзера: ${decoded.id}`);
    next(); 
  } catch (error: any) {
    console.error("[AUTH MW] Ошибка валидации токена:", error.message);
    console.log("[AUTH MW] Используемый секрет (первые 3 символа):", JWT_SECRET.substring(0, 3));
    
    // 403 вылетает здесь
    res.status(403).json({ message: 'Невалидный токен' });
  }
};