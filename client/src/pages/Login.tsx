import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext'; // Путь к файлу из Шага 1

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await loginUser(email, password);
      // Вызываем метод нашего "сервиса"
      login(response.token, response.user);
      // Перенаправляем на главную (как Close() текущей формы и Show() главной)
      navigate('/');
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setError(errorResponse.response?.data?.message || 'Ошибка входа. Проверьте данные.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Вход в WatchParty</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-gray-400 mb-1 ml-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="example@mail.com"
              title="Ваш email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-400 mb-1 ml-1">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
              title="Ваш пароль"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all transform active:scale-[0.98]"
          >
            Войти
          </button>
        </form>
        
        <p className="mt-6 text-center text-gray-400">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
};