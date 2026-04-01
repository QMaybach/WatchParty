import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getRooms, createRoom } from '../api/rooms';
import axios from 'axios';

// 1. Описываем интерфейс, чтобы уйти от 'any'
interface Room {
  id: string;
  title: string;
  host: {
    username: string;
  };
  usersCount?: number;
}

export const Home = () => {
  const { user, token, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Указываем тип массива: Room[] вместо any[]
  const [rooms, setRooms] = useState<Room[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch (err: unknown) {
      // Используем axios и err, чтобы ESLint не ругался
      if (axios.isAxiosError(err)) {
        console.error("Ошибка API:", err.response?.data?.message || err.message);
      } else {
        console.error("Неизвестная ошибка при загрузке:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const onCreate = async () => {
    if (!token) return;
    try {
      const res = await createRoom(title || "Новая комната", token);
      // Типизируем результат и обновляем список
      setRooms((prev) => [res as Room, ...prev]);
      setTitle('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.message || "Ошибка при создании");
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
        <h1 className="text-5xl font-black mb-8 tracking-tighter italic">WATCHPARTY</h1>
        <button 
          onClick={() => navigate('/login')} 
          className="px-10 py-4 bg-indigo-600 rounded-full font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95"
        >
          Войти в аккаунт
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500">
      <header className="p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-white/5">
        <h1 className="text-xl font-black tracking-tighter text-indigo-500 uppercase">WatchParty</h1>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black uppercase tracking-wider">{user?.username}</p>
            <p className="text-[10px] text-zinc-500 font-bold">{user?.email}</p>
          </div>
          <button 
            onClick={logout} 
            className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-red-500 transition-colors"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Панель создания */}
        <aside className="space-y-6">
          <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-white/5">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-6">Создать комнату</h2>
            <input 
              type="text" 
              placeholder="Название трансляции..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-4 bg-black border border-white/10 rounded-2xl mb-4 focus:border-indigo-500 outline-none text-sm transition-all"
            />
            <button 
              onClick={onCreate}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/10 transition-all active:scale-95"
            >
              Запустить
            </button>
          </div>
        </aside>

        {/* Список комнат */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Активные сессии</h2>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              <p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest animate-pulse">Синхронизация...</p>
            ) : rooms.length > 0 ? (
              rooms.map((room) => (
                <div 
                  key={room.id} 
                  className="p-6 bg-zinc-900/40 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all group backdrop-blur-sm"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-lg">🎬</div>                    <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black text-indigo-300">{room.usersCount || 0} зрителей</span>
                    </div>                  </div>
                  <h3 className="text-lg font-black leading-tight mb-1 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{room.title}</h3>
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-8">Хост: {room.host?.username || 'System'}</p>
                  
                  <button 
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="w-full py-3.5 bg-zinc-800 hover:bg-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/5 active:scale-95"
                  >
                    Присоединиться
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border border-dashed border-zinc-900 rounded-[3rem]">
                <p className="text-zinc-700 font-black uppercase tracking-widest text-[10px]">В эфире пусто. Начни первым!</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};