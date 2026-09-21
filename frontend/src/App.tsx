import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

const BACKEND_URL = window.location.origin;
const SESSION_KEY = 'monopoly_session';

interface SavedSession {
  roomId: string;
  playerName: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');

  // Восстановление сессии при загрузке
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session: SavedSession = JSON.parse(saved);
        if (session.roomId && session.playerName) {
          setCurrentRoom(session.roomId);
          setPlayerName(session.playerName);
          console.log('🔄 Восстановлена сессия:', session);
        }
      }
    } catch (e) {
      console.error('Ошибка восстановления сессии:', e);
    }
  }, []);

  // Сохранение сессии при изменении
  useEffect(() => {
    if (currentRoom && playerName) {
      const session: SavedSession = { roomId: currentRoom, playerName };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentRoom, playerName]);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('✅ Подключено к серверу');
      setIsConnected(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения:', error);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Отключено от сервера');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', color: 'white' }}>
        <h1>Подключение к серверу...</h1>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <Lobby
        socket={socket!}
        onRoomCreated={(roomId, name) => {
          setCurrentRoom(roomId);
          setPlayerName(name);
        }}
        onRoomJoined={(roomId, name) => {
          setCurrentRoom(roomId);
          setPlayerName(name);
        }}
      />
    );
  }

  return (
    <GameRoom
      socket={socket!}
      roomId={currentRoom}
      playerName={playerName}
      onLeaveRoom={() => {
        localStorage.removeItem(SESSION_KEY);
        setCurrentRoom(null);
        setPlayerName('');
      }}
    />
  );
}

export default App;