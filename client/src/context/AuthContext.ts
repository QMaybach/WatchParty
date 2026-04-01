import { createContext, useContext } from 'react';

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

// Создаем ОДИН единственный экземпляр контекста
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Создаем хук, который будет работать ТОЛЬКО с этим контекстом
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};