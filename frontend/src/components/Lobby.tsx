import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { DEFAULT_ROOM_SETTINGS } from '../types';

interface LobbyProps {
  socket: Socket;
  onRoomCreated: (roomId: string, playerName: string) => void;
  onRoomJoined: (roomId: string, playerName: string) => void;
}

const SESSION_KEY = 'monopoly_session';

export default function Lobby({ socket, onRoomCreated, onRoomJoined }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [startingMoney, setStartingMoney] = useState(DEFAULT_ROOM_SETTINGS.startingMoney);
  const [auctionEnabled, setAuctionEnabled] = useState(DEFAULT_ROOM_SETTINGS.auctionEnabled);

  // Сохранение сессии в localStorage
  const saveSession = (roomId: string, playerName: string) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerName }));
    } catch (e) {
      console.error('Не удалось сохранить сессию:', e);
    }
  };

  // Создание новой комнаты
  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }

    if (playerName.trim().length < 2) {
      setError('Имя должно содержать минимум 2 символа');
      return;
    }

    setLoading(true);
    setError('');

    socket.emit(
      'create_room',
      { playerName: playerName.trim(), settings: { startingMoney, auctionEnabled } },
      (createdRoomId: string) => {
        setLoading(false);
        // Сохраняем сессию ПЕРЕД переходом
        saveSession(createdRoomId, playerName.trim());
        onRoomCreated(createdRoomId, playerName.trim());
      }
    );
  };

  // Присоединение к существующей комнате
  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }

    if (playerName.trim().length < 2) {
      setError('Имя должно содержать минимум 2 символа');
      return;
    }

    if (!roomId.trim()) {
      setError('Введите код комнаты');
      return;
    }

    if (roomId.trim().length !== 6) {
      setError('Код комнаты должен содержать 6 символов');
      return;
    }

    setLoading(true);
    setError('');

    const normalizedRoomId = roomId.trim().toUpperCase();

    socket.emit(
      'join_room',
      { roomId: normalizedRoomId, playerName: playerName.trim() },
      (success: boolean, errorMessage?: string) => {
        setLoading(false);
        if (success) {
          // Сохраняем сессию ПЕРЕД переходом
          saveSession(normalizedRoomId, playerName.trim());
          onRoomJoined(normalizedRoomId, playerName.trim());
        } else {
          setError(errorMessage || 'Не удалось присоединиться к комнате');
        }
      }
    );
  };

  // Обработка Enter в полях ввода
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (roomId.trim()) {
        handleJoinRoom();
      } else {
        handleCreateRoom();
      }
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: 'clamp(20px, 4vw, 40px)',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            marginBottom: '25px',
            color: '#333',
            fontSize: 'clamp(22px, 4vw, 28px)',
            margin: '0 0 25px 0',
          }}
        >
           Онлайн Монополия
        </h1>

        {error && (
          <div
            style={{
              background: '#fee',
              color: '#c33',
              padding: '10px 15px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Поле ввода имени */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555',
              fontSize: '14px',
            }}
          >
            👤 Ваше имя:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Введите имя"
            maxLength={20}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 15px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#667eea')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#ddd')}
          />
        </div>

        {/* Настройки новой комнаты */}
        <div style={{ marginBottom: '15px' }}>
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: '#f8f9fa',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
            }}
          >
            <span>⚙️ Настройки новой комнаты</span>
            <span>{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div style={{ padding: '14px 12px', background: '#f8f9fa', borderRadius: '8px', marginTop: '8px', border: '1px solid #eee' }}>
              {/* Стартовый капитал */}
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#555', fontSize: '13px' }}>
                💵 Стартовый капитал игрока:
              </label>
              <input
                type="number"
                min={200}
                max={100000}
                step={100}
                value={startingMoney}
                onChange={(e) => setStartingMoney(Math.max(200, Math.min(100000, Number(e.target.value) || DEFAULT_ROOM_SETTINGS.startingMoney)))}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  marginBottom: '14px',
                }}
              />

              {/* Играть с аукционом */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={auctionEnabled}
                  onChange={(e) => setAuctionEnabled(e.target.checked)}
                  disabled={loading}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>
                  🔨 Играть с аукционом
                  <br />
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    Если отключено — при отказе от покупки или нехватке денег клетка просто остаётся у банка
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Кнопка создания комнаты */}
        <button
          onClick={handleCreateRoom}
          disabled={loading || !playerName.trim()}
          style={{
            width: '100%',
            padding: '14px',
            background: loading || !playerName.trim() ? '#a0aec0' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading || !playerName.trim() ? 'not-allowed' : 'pointer',
            marginBottom: '20px',
            transition: 'background 0.2s',
          }}
        >
          {loading ? '⏳ Создание...' : ' Создать комнату'}
        </button>

        {/* Разделитель */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            color: '#999',
            fontSize: '13px',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
          <span style={{ padding: '0 15px' }}>или</span>
          <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
        </div>

        {/* Поле ввода кода комнаты */}
        <div style={{ marginBottom: '15px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555',
              fontSize: '14px',
            }}
          >
             Код комнаты:
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="ABC123"
            maxLength={6}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 15px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '20px',
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: '4px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#764ba2')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#ddd')}
          />
        </div>

        {/* Кнопка входа в комнату */}
        <button
          onClick={handleJoinRoom}
          disabled={loading || !playerName.trim() || roomId.trim().length !== 6}
          style={{
            width: '100%',
            padding: '14px',
            background:
              loading || !playerName.trim() || roomId.trim().length !== 6
                ? '#a0aec0'
                : '#764ba2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor:
              loading || !playerName.trim() || roomId.trim().length !== 6
                ? 'not-allowed'
                : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? ' Подключение...' : '🚪 Войти в комнату'}
        </button>

        {/* Подсказка */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            background: '#f0f4ff',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          💡 <b>Совет:</b> Создайте комнату и отправьте код друзьям,
          <br />
          чтобы играть вместе по сети.
          <br />
          💾 Игра сохраняется автоматически — введите тот же код,
          чтобы продолжить её позже, даже после перезапуска сервера.
        </div>
      </div>
    </div>
  );
}