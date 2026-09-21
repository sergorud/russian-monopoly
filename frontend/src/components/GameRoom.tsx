import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, Player, RoomSettings, DEFAULT_ROOM_SETTINGS } from '../types';
import { BOARD } from '../board';
import GameBoard from './GameBoard';
import PlayerPanel from './PlayerPanel';
import ActionPanel from './ActionPanel';
import { CellInfoModal, PropertyInfoModal, RulesModal, CELL_DESCRIPTIONS } from './InfoModals';

interface GameRoomProps {
  socket: Socket;
  roomId: string;
  playerName: string;
  onLeaveRoom: () => void;
}

const AVAILABLE_TOKENS = ['🚗', '🎩', '🐕', '⚓', '👞', '🐈', '🚂', '🐘', '🦖', '👑'];

/**
 * Крупный всплывающий плачущий смайл в правом нижнем углу ЭКРАНА (а не
 * игрового поля) — показывается локально у игрока, с которым произошло
 * отрицательное событие (попал в тюрьму, заплатил аренду/налог, банкротство
 * и т.д.). Сервер присылает negativeEvents уже отфильтрованными персонально
 * под каждого зрителя (см. maskMoneyForViewer на бэкенде), так что здесь
 * достаточно один раз отрисовать анимацию при появлении события.
 */
function CryingEmojiPopup() {
  const drops = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      left: 8 + Math.random() * 70,
      delay: 0.35 + i * 0.15 + Math.random() * 0.15,
    }))
  )[0];

  return (
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 4000, pointerEvents: 'none', width: 'clamp(90px, 14vw, 150px)', height: 'clamp(90px, 14vw, 150px)' }}>
      {drops.map(d => (
        <span
          key={d.id}
          style={{
            position: 'absolute',
            left: `${d.left}%`,
            top: '20%',
            fontSize: 'clamp(14px, 2vw, 20px)',
            opacity: 0,
            animation: `tearFall 1.2s ease-in ${d.delay}s forwards`,
          }}
        >
          💧
        </span>
      ))}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          fontSize: 'clamp(64px, 10vw, 110px)',
          filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.4))',
          animation: 'cryPop 2.2s ease-in-out forwards',
        }}
      >
        😢
      </div>
    </div>
  );
}

export default function GameRoom({ socket, roomId, playerName, onLeaveRoom }: GameRoomProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [cellModal, setCellModal] = useState<{ id: number; kind: 'info' | 'property' } | null>(null);
  const [saveNotice, setSaveNotice] = useState('');

  // Плачущий смайл: реагируем на negativeEvents из gameState так же, как
  // GameBoard реагирует на positiveEvents для салюта — сравниваем "подпись"
  // массива событий, чтобы не показывать одну и ту же пачку дважды.
  const [showCrying, setShowCrying] = useState(false);
  const [cryingKey, setCryingKey] = useState(0);
  const lastNegativeSignatureRef = useRef('');

  useEffect(() => {
    if (!gameState || gameState.negativeEvents.length === 0) return;
    const signature = gameState.negativeEvents.map(e => `${e.type}:${e.timestamp}`).join('|');
    if (signature === lastNegativeSignatureRef.current) return;
    lastNegativeSignatureRef.current = signature;

    setCryingKey(k => k + 1);
    setShowCrying(true);
    const timer = setTimeout(() => setShowCrying(false), 2200);
    return () => clearTimeout(timer);
  }, [gameState?.negativeEvents]);

  useEffect(() => {
    if (socket.id) setMyPlayerId(socket.id);

    socket.on('player_joined', (data: { players: Player[]; settings?: RoomSettings }) => {
      setPlayers(data.players);
      if (data.settings) setRoomSettings(data.settings);
    });
    socket.on('player_left', (data: { players: Player[] }) => setPlayers(data.players));
    socket.on('game_started', (data: { gameState: GameState }) => setGameState(data.gameState));
    socket.on('game_state_updated', (data: { gameState: GameState }) => setGameState(data.gameState));
    socket.on('game_saved', () => {
      setSaveNotice(`💾 Игра сохранена! Код для возврата: ${roomId}`);
      setTimeout(() => setSaveNotice(''), 5000);
    });
    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    // ВАЖНО: подключаемся к комнате на сервере при каждом заходе в этот экран —
    // это покрывает и обычный вход, и восстановление сессии из localStorage
    // после перезагрузки страницы, и возврат к ранее сохранённой игре по коду
    // (сервер поднимет её с диска, если она не в памяти — см. join_room на бэкенде).
    socket.emit('join_room', { roomId, playerName }, (success: boolean, errorMessage?: string) => {
      if (!success && errorMessage) {
        setError(errorMessage);
      }
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_started');
      socket.off('game_state_updated');
      socket.off('game_saved');
      socket.off('error');
    };
  }, [socket, roomId, playerName]);

  const copyRoomId = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = roomId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert(`Код комнаты: ${roomId}`);
    }
  };

  const handleStartGame = () => socket.emit('start_game', roomId);
  const handleChooseToken = (token: string) => {
    socket.emit('choose_token', { roomId, token });
    setShowTokenPicker(false);
  };
  const handleRollDice = () => socket.emit('roll_dice', roomId);
  const handleBuyProperty = () => socket.emit('buy_property', roomId);
  const handleDeclineBuy = () => socket.emit('decline_buy', roomId);
  const handleEndTurn = () => socket.emit('end_turn', roomId);
  const handlePayFine = () => socket.emit('pay_fine', roomId);
  const handleUseJailCard = () => socket.emit('use_jail_card', roomId);
  const handleBuildHouse = (propertyId: number) => socket.emit('build_house', roomId, propertyId);
  const handlePlaceBid = (amount: number) => socket.emit('place_bid', roomId, amount);
  const handlePassAuction = () => socket.emit('pass_auction', roomId);
  const handleMortgage = (propertyId: number) => socket.emit('mortgage_property', roomId, propertyId);
  const handleUnmortgage = (propertyId: number) => socket.emit('unmortgage_property', roomId, propertyId);
  const handleProposeAuction = () => socket.emit('propose_auction', roomId);
  const handleSaveGame = () => socket.emit('save_game', roomId);

  // Клик по клетке: спецклетка -> описание, улица/ж/д/предприятие -> карточка с ценами
  const handleCellClick = (cellId: number) => {
    if (CELL_DESCRIPTIONS[cellId]) {
      setCellModal({ id: cellId, kind: 'info' });
      return;
    }
    const cell = BOARD[cellId];
    if (cell.type === 'property' || cell.type === 'railroad' || cell.type === 'utility') {
      setCellModal({ id: cellId, kind: 'property' });
    }
  };

  if (!gameState) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ color: '#333', fontSize: '24px', margin: 0 }}>🎮 Комната игры</h1>
            <button onClick={onLeaveRoom} style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Выйти</button>
          </div>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ color: '#666', marginBottom: '8px', fontSize: '14px' }}>Код комнаты:</p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea', letterSpacing: '4px' }}>{roomId}</span>
              <button onClick={copyRoomId} style={{ padding: '8px 16px', background: copied ? '#28a745' : '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                {copied ? '✅ Скопировано' : '📋 Копировать'}
              </button>
            </div>
          </div>

          {/* Настройки комнаты */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ padding: '6px 12px', background: '#e8f5e9', borderRadius: '20px', fontSize: '13px', color: '#2e7d32', fontWeight: 'bold' }}>
              💵 Старт: ${roomSettings.startingMoney}
            </div>
            <div style={{ padding: '6px 12px', background: roomSettings.auctionEnabled ? '#fff3cd' : '#f0f0f0', borderRadius: '20px', fontSize: '13px', color: roomSettings.auctionEnabled ? '#856404' : '#888', fontWeight: 'bold' }}>
              {roomSettings.auctionEnabled ? '🔨 Аукцион включён' : '🔨 Без аукциона'}
            </div>
          </div>

          <div>
            <h2 style={{ color: '#333', marginBottom: '15px', fontSize: '18px' }}>👥 Игроки ({players.length}/4)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
              {players.map((player) => (
                <div key={player.id} style={{ background: player.name === playerName ? '#e8f5e9' : '#f8f9fa', padding: '15px', borderRadius: '12px', border: player.name === playerName ? '2px solid #4caf50' : '2px solid transparent', textAlign: 'center', position: 'relative' }}>
                  <div style={{ fontSize: '36px', marginBottom: '5px', cursor: player.name === playerName ? 'pointer' : 'default' }} onClick={() => player.name === playerName && setShowTokenPicker(true)} title={player.name === playerName ? 'Сменить фишку' : ''}>
                    {player.emoji}
                  </div>
                  <h3 style={{ color: '#333', fontSize: '14px', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.name}{player.name === playerName && ' (Вы)'}
                  </h3>
                  {player.name === playerName && (
                    <button onClick={() => setShowTokenPicker(true)} style={{ fontSize: '11px', padding: '4px 10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Сменить фишку</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {players.length < 2 && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ color: '#856404', fontSize: '16px', margin: 0 }}>⏳ Ожидаем игроков... Минимум 2</p>
            </div>
          )}
          {players.length >= 2 && players[0]?.name === playerName && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#d4edda', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ color: '#155724', fontSize: '16px', margin: '0 0 10px 0' }}>✅ Вы хост. Можно начинать!</p>
              <button onClick={handleStartGame} style={{ padding: '12px 30px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>🎲 Начать игру</button>
            </div>
          )}
          {players.length >= 2 && players[0]?.name !== playerName && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#d1ecf1', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ color: '#0c5460', fontSize: '16px', margin: 0 }}>⏳ Ожидаем начала игры от хоста...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <style>{`
        @keyframes cryPop {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          15% { transform: scale(1.15) rotate(8deg); opacity: 1; }
          25% { transform: scale(1) rotate(-4deg); opacity: 1; }
          35% { transform: scale(1.05) rotate(3deg); opacity: 1; }
          45%, 85% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(0.85) translateY(20px); opacity: 0; }
        }
        @keyframes tearFall {
          0% { opacity: 0; transform: translateY(0) scale(0.6); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translateY(50px) scale(1); }
        }
      `}</style>

      {showCrying && <CryingEmojiPopup key={cryingKey} />}

      {error && (
        <div style={{ background: '#fee', color: '#c33', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>❌ {error}</div>
      )}
      {saveNotice && (
        <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{saveNotice}</div>
      )}

      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
      <div style={{ height: 'clamp(104px, 13vh, 150px)', display: 'flex', gap: '8px', padding: '6px 8px', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.95)', borderRadius: '10px', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <PlayerPanel
            gameState={gameState}
            currentPlayerId={myPlayerId}
            onMortgage={handleMortgage}
            onUnmortgage={handleUnmortgage}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.95)', borderRadius: '10px', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <ActionPanel
            gameState={gameState}
            currentPlayerId={myPlayerId}
            onRollDice={handleRollDice}
            onBuyProperty={handleBuyProperty}
            onDeclineBuy={handleDeclineBuy}
            onEndTurn={handleEndTurn}
            onPayFine={handlePayFine}
            onUseJailCard={handleUseJailCard}
            onBuildHouse={handleBuildHouse}
            onPlaceBid={handlePlaceBid}
            onPassAuction={handlePassAuction}
            onProposeAuction={handleProposeAuction}
            onLeaveRoom={onLeaveRoom}
            onShowRules={() => setShowRules(true)}
            onSaveGame={handleSaveGame}
          />
        </div>
      </div>

      {/* ИГРОВОЕ ПОЛЕ */}
      <div className="board-stage" style={{ flex: 1, minHeight: 0 }}>
        <GameBoard
          gameState={gameState}
          currentPlayerId={myPlayerId}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Экран победы */}
      {gameState.phase === 'game_over' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxWidth: '90%' }}>
            <div style={{ fontSize: '60px', marginBottom: '15px' }}>🏆</div>
            <h1 style={{ fontSize: '36px', color: '#333', marginBottom: '15px' }}>Победа!</h1>
            <p style={{ fontSize: '20px', color: '#666', marginBottom: '25px' }}>{gameState.winner} выиграл игру!</p>
            <button onClick={onLeaveRoom} style={{ padding: '12px 30px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Выйти</button>
          </div>
        </div>
      )}

      {/* Выбор фишки */}
      {showTokenPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowTokenPicker(false)}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Выберите вашу фишку</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {AVAILABLE_TOKENS.map(token => (
                <button key={token} onClick={() => handleChooseToken(token)} style={{ fontSize: '32px', padding: '10px', background: '#f8f9fa', border: '2px solid transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e8f5e9'; e.currentTarget.style.borderColor = '#4caf50'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}>
                  {token}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Справка по специальной клетке */}
      {cellModal?.kind === 'info' && (
        <CellInfoModal cellId={cellModal.id} onClose={() => setCellModal(null)} />
      )}

      {/* Карточка недвижимости с ценами домов/отелей */}
      {cellModal?.kind === 'property' && (
        <PropertyInfoModal cellId={cellModal.id} gameState={gameState} onClose={() => setCellModal(null)} />
      )}

      {/* Правила игры */}
      {showRules && (
        <RulesModal onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}