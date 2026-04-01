import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoomById, updateRoomVideo } from '../api/rooms';
import { io, Socket } from 'socket.io-client';
import { VideoPlayer } from '../components/VideoPlayer';
import type Player from 'video.js/dist/types/player';
import './Room.css';

interface RoomData {
  id: string;
  title: string;
  videoUrl: string | null;
  hostId: string;
  host: { username: string };
}

// Функция для определения типа источника
const getVideoSourceParams = (url: string | null | undefined) => {
  if (!url) return [];
  
  // Простая проверка: если ссылка видеохостинга YouTube
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  
  if (isYouTube) {
    return [{
      src: url,
      type: 'video/youtube' // Важный параметр для плагина videojs-youtube
    }];
  }
  
  // Фолбэк на стандартный HTML5 плеер для обычных видео (.mp4)
  return [{
    src: url,
    type: 'video/mp4'
  }];
};

export const Room = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  // Состояние, чтобы гость мог "разблокировать" звук, кликнув по экрану
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Состояния для чата и зрителей
  interface ChatMessage {
    id: string;
    username: string;
    text: string;
    time: string;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [usersCount, setUsersCount] = useState(1); // Иконка людей
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<Player | null>(null); // Ссылка на экземпляр Video.js
  const isHost = user?.id === room?.hostId;

  const isHostRef = useRef(isHost);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Если нет токена — перенаправляем гостя авторизоваться с задержкой или сразу
  useEffect(() => {
    if (!token && roomId) {
      alert("Для входа в комнату нужно быть авторизованным!");
      navigate('/login');
    }
  }, [token, roomId, navigate]);

  // Мемоизируем опции плеера, чтобы он не перерисовывался без необходимости
  const videoJsOptions = useMemo(() => ({
    autoplay: isPlaying,
    controls: isHost, // Гости не видят ползунков, только хост
    responsive: true,
    fluid: true,
    muted: !isHost && !hasInteracted,
    techOrder: ['youtube', 'html5'], // Указываем, какие технологии использовать
    youtube: {
      ytControls: isHost ? 1 : 0, 
      customVars: {
        origin: window.location.origin
      }
    },
    sources: getVideoSourceParams(room?.videoUrl)
  }), [room?.videoUrl, isHost, isPlaying, hasInteracted]);

  const handlePlayerReady = (player: Player) => {
    playerRef.current = player;

    // Подвязываем события плеера к твоим Socket.io функциям
    player.on('play', () => {
      // Исполняется при клике Хоста
      if (isHostRef.current && !isPlayingRef.current) {
        setIsPlaying(true);
        isPlayingRef.current = true;
        socketRef.current?.emit('play', roomId, player.currentTime());
      }
    });

    player.on('pause', () => {
      if (isHostRef.current && isPlayingRef.current) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        socketRef.current?.emit('pause', roomId, player.currentTime());
      }
    });

    player.on('seeked', () => {
      if (isHostRef.current) {
        const time = player.currentTime();
        socketRef.current?.emit('seek', roomId, time);
      }
    });
  };

  // 1. Загрузка данных
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId || !token) return;
      try {
        const data = await getRoomById(roomId, token);
        setRoom(data);
        if (data.videoUrl) setNewUrl(data.videoUrl);
      } catch (err) {
        console.error("Комната не найдена", err);
      }
    };
    fetchRoom();
  }, [roomId, token]);

  // 2. WebSockets
  useEffect(() => {
    if (!roomId) return;
    
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    console.log('Подключение к сокету:', socketUrl);

    const socket = io(socketUrl, {
      withCredentials: true
    });
    socketRef.current = socket;

    const onConnect = () => {
      console.log('Socket успешно подключен! socket.id:', socket.id);
      socket.emit('join-room', roomId);
    };

    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);

    socket.on('connect_error', (err) => {
      console.error('Ошибка подключения Socket.IO:', err);
    });

    // Просто меняем состояние React. Player отреагирует на него автоматически!
    socket.on('play', (time?: number) => {
      console.log('Socket: Получена команда PLAY. Включаю воспроизведение.');
      setIsPlaying(true);
      isPlayingRef.current = true;
      try {
        const p = playerRef.current;
        if (p) {
          if (time !== undefined && Math.abs((p.currentTime() || 0) - time) > 1) {
            p.currentTime(time);
          }
          if (p.paused()) { p.play()?.catch(()=>{}); }
        }
      } catch { console.debug('Игнорируем ошибку play'); }
    });

    socket.on('pause', (time?: number) => {
      console.log('Socket: Получена команда PAUSE. Ставлю на паузу.');
      setIsPlaying(false);
      isPlayingRef.current = false;
      try {
        const p = playerRef.current;
        if (p) {
          if (time !== undefined && Math.abs((p.currentTime() || 0) - time) > 0.5) {
            p.currentTime(time);
          }
          p.pause();
        }
      } catch { console.debug('Игнорируем ошибку pause'); }
    });

    socket.on('video-change', (url: string) => {
      console.log('Socket: Получена команда СМЕНА ВИДЕО, новый URL:', url);
      setRoom((prev) => prev ? ({ ...prev, videoUrl: url }) : null);
      setIsPlaying(false); // Ставим на паузу при смене видео
      isPlayingRef.current = false;
    });

    socket.on('room-users-count', (count: number) => {
      setUsersCount(count);
    });

    // Важно: Чтобы синхронизировать время, добавим событие seek
    socket.on('seek', (time: number) => {
      const p = playerRef.current;
      if (p) {
        try {
          const current = p.currentTime();
          // Чтобы не было зацикливания, меняем время только если разница существенна
          if (Math.abs((current || 0) - time) > 1) {
            p.currentTime(time);
          }
        } catch { console.debug('Игнорируем ошибку seek'); }
      }
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      console.log('Socket: Получено сообщение:', msg);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => { 
      console.log('Отключение сокета');
      socket.disconnect(); 
    };
  }, [roomId]);

  const formatUrl = (url: string) => {
    if (!url) return '';
    let trimmedUrl = url.trim();

    const lowerUrl = trimmedUrl.toLowerCase();
    if (lowerUrl === 'test' || lowerUrl.includes('bunny') || lowerUrl.includes('trailer')) {
      return 'https://media.w3.org/2010/05/sintel/trailer.mp4';
    }

    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('/')) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    const vkRegex = /(?:vk\.com|vkvideo\.ru)\/video(-?\d+)_(\d+)/i;
    const vkMatch = trimmedUrl.match(vkRegex);
    if (vkMatch) {
      const oid = vkMatch[1];
      const vid = vkMatch[2];
      return `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2&autoplay=1`;
    }

    return trimmedUrl;
  };

  const handleUpdateVideo = async () => {
    if (!roomId || !token || !newUrl || !isHost) return;
    
    const formatted = formatUrl(newUrl);
    
    try {
      await updateRoomVideo(roomId, formatted, token);
      setIsPlaying(false);
      setRoom((prev) => prev ? ({ ...prev, videoUrl: formatted }) : null);
      
      if (socketRef.current) {
        socketRef.current.emit('video-change', roomId, formatted);
      }
      
      alert(`Видео успешно обновлено!\n\nНовый URL: ${formatted}`);
    } catch (err) {
      console.error(err);
      alert("Ошибка обновления видео. Проверьте консоль.");
    }
  };

  // Функция для обработки клика гостя по странице (решает проблему автоплея браузера)
  const handleUserInteraction = () => {
    if (!hasInteracted) setHasInteracted(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;
    const currentUsername = user?.username || 'Гость';
    const newMsg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(),
      username: currentUsername,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socketRef.current?.emit('chat-message', roomId, newMsg);
    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <div 
      className="h-screen bg-black text-white flex flex-col font-sans overflow-hidden"
      onClick={handleUserInteraction} // Слушаем клик где угодно на странице
    >
      {/* HEADER */}
      <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            {room?.title?.[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">{room?.title}</h1>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Status: <span className="text-indigo-400 animate-pulse">Live Syncing</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-zinc-900/80 px-4 py-2 rounded-xl border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span className="text-sm font-black text-white px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded-md">
              {usersCount}
            </span>
          </div>

          <button onClick={() => navigate('/')} className="px-8 py-3 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            Покинуть
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* PLAYER SECTION */}
        <div className="flex-[3] p-10 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-950 to-black relative">
          
          {/* Плашка для гостей, просящая кликнуть для активации звука/видео */}
          {!isHost && !hasInteracted && (
             <div className="absolute top-4 z-50 bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold animate-bounce shadow-lg shadow-indigo-500/50 cursor-pointer">
                Кликни в любом месте, чтобы разрешить синхронизацию видео!
             </div>
          )}

          <div className="relative w-full max-w-5xl aspect-video rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.1)] border border-white/5 bg-black">
            {!room?.videoUrl && !isHost ? (
               <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest">
                 Видео не загружено. Ожидание хоста...
               </div>
            ) : room?.videoUrl?.includes('vk.com/video_ext.php') ? (
              // VK Video остается в iframe (синхронизация паузы/плея здесь работать не будет без API ВК)
              <iframe
                key={room.videoUrl}
                title="VK Video Player"
                src={room.videoUrl}
                width="100%"
                height="100%"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture;"
                frameBorder="0"
                allowFullScreen
                className={`w-full h-full object-cover ${isHost ? 'host-video-interaction' : 'guest-video-interaction'}`}
              />
            ) : (
              // VideoPlayer теперь обрабатывает и YouTube, и прямые ссылки
              <VideoPlayer 
                options={videoJsOptions} 
                onReady={handlePlayerReady} 
              />
            )}
          </div>

          {/* Панель управления (только для Хоста) */}
          {isHost && (
            <div className="mt-10 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Вставьте ссылку на YouTube (или введите test)..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-1 px-6 py-4 bg-zinc-900 border border-white/10 rounded-2xl text-[12px] text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={handleUpdateVideo}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                >
                  Обновить видео
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR (ЧАТ) */}
        <aside className="w-[450px] bg-zinc-950/50 border-l border-white/5 flex flex-col p-8">
           <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-10">Room Chat</h2>
           <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 pr-2">
              {messages.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 border-2 border-dashed border-zinc-800 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                    </div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ожидание сообщений...</p>
                 </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.username === user?.username ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-zinc-500 font-bold mb-1">{msg.username} <span className="font-normal opacity-50">{msg.time}</span></span>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${msg.username === user?.username ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
           </div>
           <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto">
             <input 
               type="text" 
               value={chatInput}
               onChange={(e) => setChatInput(e.target.value)}
               placeholder="Написать..." 
               className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
             />
             <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl text-sm font-bold transition-colors">
               &gt;
             </button>
           </form>
        </aside>
      </main>
    </div>
  );
};