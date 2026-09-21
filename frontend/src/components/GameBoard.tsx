import { useEffect, useRef, useState } from 'react';
import { GameState, Cell, Property } from '../types';
import { BOARD, getColorHex } from '../board';

interface GameBoardProps {
  gameState: GameState;
  currentPlayerId: string;
  onCellClick?: (cellId: number) => void;
}

/**
 * Тематические иконки для клеток-улиц, подобранные по смыслу названия
 * (историческая специализация улицы, топоним, известный объект и т.д.).
 * Ключ ищется как подстрока в названии клетки.
 */
const PROPERTY_ICON_BY_KEYWORD: [string, string][] = [
  ['Житная', '🌾'],
  ['Нагатин', '🏘️'],
  ['Волхов', '🌊'],
  ['Парков', '🌳'],
  ['Полянка', '🌿'],
  ['Сретенка', '🏛️'],
  ['Ростовская', '🚤'],
  ['Смолян', '🏙️'],
  ['Ржевская', '🏢'],
  ['Вавилова', '🔬'],
  ['Тверская', '🏬'],
  ['Пушкин', '📖'],
  ['Победы', '🎖️'],
  ['Маслов', '🏘️'],
  ['Крестов', '⛪'],
  ['Петровка', '🛍️'],
  ['Мясницкая', '🥩'],
  ['Покров', '⛪'],
  ['Арбат', '🎨'],
  ['Бронная', '🎭'],
];

// Запасной набор для любых улиц без явного ключевого слова (например, добавленных позже)
const FALLBACK_PROPERTY_ICONS = ['🏠', '🏡', '🏘️', '🏢', '🏛️', '🏙️'];

function getPropertyIcon(name: string): string {
  for (const [keyword, icon] of PROPERTY_ICON_BY_KEYWORD) {
    if (name.includes(keyword)) return icon;
  }
  // Детерминированный хэш названия -> всегда одна и та же иконка для одной улицы
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_PROPERTY_ICONS[hash % FALLBACK_PROPERTY_ICONS.length];
}

/**
 * Анимация салюта поверх игрового поля. Показывается локально на клиенте
 * ТОЛЬКО у игрока, с которым произошло положительное событие — сервер
 * присылает positiveEvents уже отфильтрованными персонально под каждого
 * зрителя, так что достаточно один раз отрисовать её при появлении события.
 */
function Fireworks() {
  const bursts = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: 12 + Math.random() * 76, // %
      top: 10 + Math.random() * 55, // %
      delay: i * 0.16 + Math.random() * 0.12,
      hue: Math.floor(Math.random() * 360),
      particles: Array.from({ length: 14 }, (_, p) => {
        const angle = (p / 14) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 36 + Math.random() * 34;
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, hueShift: p * 7 };
      }),
    }))
  )[0];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 80, overflow: 'hidden' }}>
      {bursts.map(b => (
        <div key={b.id} style={{ position: 'absolute', left: `${b.left}%`, top: `${b.top}%`, width: 0, height: 0 }}>
          {b.particles.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: `hsl(${b.hue + p.hueShift}, 95%, 62%)`,
                boxShadow: `0 0 7px hsl(${b.hue + p.hueShift}, 95%, 65%)`,
                animation: `fireworkParticle 1.15s ease-out ${b.delay}s forwards`,
                ['--dx' as any]: `${p.dx}px`,
                ['--dy' as any]: `${p.dy}px`,
              }}
            />
          ))}
          <span style={{
            position: 'absolute',
            fontSize: '22px',
            transform: 'translate(-50%, -50%)',
            animation: `fireworkFlash 0.5s ease-out ${b.delay}s forwards`,
            opacity: 0,
          }}>✨</span>
        </div>
      ))}
    </div>
  );
}

export default function GameBoard({ gameState, currentPlayerId, onCellClick }: GameBoardProps) {
  // Замеряем РЕАЛЬНЫЙ размер контейнера в пикселях (а не проценты/vw/vh) —
  // так поле физически не может оказаться больше, чем доступное место,
  // ни при каком сочетании размеров окна, панелей и масштаба браузера.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Салют: сервер присылает positiveEvents уже отфильтрованными — только
  // события ЭТОГО зрителя (см. maskMoneyForViewer на бэкенде), поэтому
  // достаточно показать анимацию, как только массив стал непустым.
  // Ключ по timestamp'ам нужен, чтобы отличать новую пачку событий от уже
  // показанной (positiveEvents сбрасывается на сервере в начале каждого
  // действия, поэтому одинаковый timestamp дважды не встретится).
  const [fireworksKey, setFireworksKey] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);
  const lastEventSignatureRef = useRef<string>('');

  useEffect(() => {
    if (gameState.positiveEvents.length === 0) return;
    const signature = gameState.positiveEvents.map(e => `${e.type}:${e.timestamp}`).join('|');
    if (signature === lastEventSignatureRef.current) return;
    lastEventSignatureRef.current = signature;

    setFireworksKey(k => k + 1);
    setShowFireworks(true);
    const timer = setTimeout(() => setShowFireworks(false), 2200);
    return () => clearTimeout(timer);
  }, [gameState.positiveEvents]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Поле не обязано быть квадратным: ширина и высота сетки — это ровно
  // измеренные ширина/высота контейнера (минус небольшой отступ).
  const boardW = Math.max(0, stageSize.w - 8);
  const boardH = Math.max(0, stageSize.h - 8);
  // Размер одной клетки внешнего кольца (11 ячеек по каждой стороне) —
  // используется, чтобы шрифт/иконки всегда точно умещались в клетке
  // независимо от пропорций экрана.
  const cellW = boardW / 11;
  const cellH = boardH / 11;
  const cellMin = Math.max(1, Math.min(cellW, cellH));

  const getPlayersOnCell = (cellId: number) => gameState.players.filter(p => p.position === cellId && !p.isBankrupt);
  const getProperty = (cellId: number): Property | undefined => gameState.properties[cellId];

  const renderCell = (cell: Cell, size: 'small' | 'medium' | 'large') => {
    const players = getPlayersOnCell(cell.id);
    const property = getProperty(cell.id);

    // Множители размера шрифта/иконок относительно наименьшей стороны клетки,
    // с абсолютными мин/макс ограничениями в пикселях для читаемости.
    const mult = { small: 1, medium: 1.15, large: 1.3 }[size];
    const clampPx = (base: number, min: number, max: number) => `${Math.min(max, Math.max(min, base))}px`;

    const sizeConfig = {
      fontSize: clampPx(cellMin * 0.16 * mult, 7, 16),
      padding: `${Math.min(6, Math.max(1, cellMin * 0.04))}px`,
      iconSize: clampPx(cellMin * 0.22 * mult, 9, 24),
      playerSize: clampPx(cellMin * 0.26, 12, 30),
      playerFontSize: clampPx(cellMin * 0.16, 7, 18),
    };

    const config = sizeConfig;
    
    const cellStyle: React.CSSProperties = {
      border: '1px solid #333',
      padding: config.padding,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      fontSize: config.fontSize,
      position: 'relative',
      background: '#f0f0f0',
      cursor: onCellClick ? 'pointer' : 'default',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
    };

    let colorBar = null;
    if (cell.color && (cell.type === 'property' || cell.type === 'railroad' || cell.type === 'utility')) {
      colorBar = (
        <div style={{
          height: clampPx(cellH * 0.14, 6, 30),
          background: getColorHex(cell.color),
          margin: `-${config.padding} -${config.padding} ${config.padding} -${config.padding}`,
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }} />
      );
    }

    let icon = '';
    if (cell.type === 'go') icon = '➡️';
    else if (cell.type === 'jail') icon = '🔒';
    else if (cell.type === 'go_to_jail') icon = '👮';
    else if (cell.type === 'free_parking') icon = '🅿️';
    else if (cell.type === 'chance') icon = '❓';
    else if (cell.type === 'community') icon = '💰';
    else if (cell.type === 'tax') icon = '💸';
    else if (cell.type === 'railroad') icon = '🚂';
    else if (cell.type === 'utility') icon = cell.name.includes('Электр') ? '💡' : '💧';
    else if (cell.type === 'property') icon = getPropertyIcon(cell.name);

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    return (
      <div key={cell.id} style={cellStyle} onClick={() => onCellClick?.(cell.id)}>
        {colorBar}
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden' }}>
          {icon && <div style={{ fontSize: config.iconSize, marginBottom: '2px', textAlign: 'center' }}>{icon}</div>}
          <div style={{ fontWeight: 'bold', fontSize: config.fontSize, wordBreak: 'break-word', lineHeight: 1.2, textAlign: 'center', width: '100%' }}>{cell.name}</div>
          {cell.price && size !== 'small' && <div style={{ fontSize: config.fontSize, color: '#e30613', fontWeight: 'bold', marginTop: '2px', textAlign: 'center', width: '100%' }}>${cell.price}</div>}
        </div>

        {property && property.houses > 0 && (
          <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '1px' }}>
            {property.houses === 5 ? (
              <div style={{ fontSize: size === 'small' ? 'clamp(8px, 1vw, 12px)' : 'clamp(10px, 1.2vw, 16px)' }}>🏨</div>
            ) : (
              Array(property.houses).fill(0).map((_, i) => (
                <div key={i} style={{ width: size === 'small' ? 'clamp(3px, 0.4vw, 6px)' : 'clamp(4px, 0.5vw, 8px)', height: size === 'small' ? 'clamp(3px, 0.4vw, 6px)' : 'clamp(4px, 0.5vw, 8px)', background: '#2ecc71', border: '1px solid #27ae60' }} />
              ))
            )}
          </div>
        )}

        {property?.isMortgaged && <div style={{ position: 'absolute', top: '2px', right: '2px', fontSize: size === 'small' ? 'clamp(8px, 1vw, 12px)' : 'clamp(10px, 1.2vw, 14px)' }}>📜</div>}

        {property?.ownerId && (
          <div style={{ position: 'absolute', top: '2px', left: '2px', width: size === 'small' ? 'clamp(4px, 0.5vw, 7px)' : 'clamp(5px, 0.6vw, 9px)', height: size === 'small' ? 'clamp(4px, 0.5vw, 7px)' : 'clamp(5px, 0.6vw, 9px)', borderRadius: '50%', background: gameState.players.find(p => p.id === property.ownerId)?.color || '#999', border: '1px solid #333' }} />
        )}

        {players.length > 0 && (
          <div style={{ position: 'absolute', bottom: '2px', right: '2px', display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '100%', zIndex: 10 }}>
            {players.map(player => {
              const isCurrent = player.id === currentPlayer?.id;
              return (
                <div key={player.id} title={player.money === null ? player.name : `${player.name} ($${player.money})`} style={{
                  width: config.playerSize,
                  height: config.playerSize,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: `3px solid ${player.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: config.playerFontSize,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  animation: isCurrent ? 'tokenBounce 1s infinite ease-in-out' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}>
                  {player.emoji}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Раскладка клеток на сетке 11x11. Зеркально отражена по горизонтали
  // относительно порядка позиций 0..39, чтобы фишки двигались ПО ЧАСОВОЙ
  // стрелке (номер позиции не менялся — меняется только то, в какую
  // физическую ячейку сетки он попадает).
  const boardCells: (Cell | null)[][] = [
    [BOARD[29], BOARD[30], BOARD[31], BOARD[32], BOARD[33], BOARD[34], BOARD[35], BOARD[36], BOARD[37], BOARD[38], BOARD[39]],
    [BOARD[28], null, null, null, null, null, null, null, null, null, BOARD[0]],
    [BOARD[27], null, null, null, null, null, null, null, null, null, BOARD[1]],
    [BOARD[26], null, null, null, null, null, null, null, null, null, BOARD[2]],
    [BOARD[25], null, null, null, null, null, null, null, null, null, BOARD[3]],
    [BOARD[24], null, null, null, null, null, null, null, null, null, BOARD[4]],
    [BOARD[23], null, null, null, null, null, null, null, null, null, BOARD[5]],
    [BOARD[22], null, null, null, null, null, null, null, null, null, BOARD[6]],
    [BOARD[21], null, null, null, null, null, null, null, null, null, BOARD[7]],
    [BOARD[20], null, null, null, null, null, null, null, null, null, BOARD[8]],
    [BOARD[19], BOARD[18], BOARD[17], BOARD[16], BOARD[15], BOARD[14], BOARD[13], BOARD[12], BOARD[11], BOARD[10], BOARD[9]],
  ];

  return (
    <div ref={stageRef} style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '4px', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes tokenBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fireworkParticle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          65% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.25); opacity: 0; }
        }
        @keyframes fireworkFlash {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); }
        }
      `}</style>

      {showFireworks && <Fireworks key={fireworksKey} />}

      {/* Поле не обязано быть квадратным: ширина/высота сетки — это ТОЧНЫЕ
          измеренные в пикселях размеры контейнера (boardW/boardH, через
          ResizeObserver выше). Это гарантирует, что поле ВСЕГДА целиком
          помещается на экране без прокрутки, при любом соотношении
          сторон и любом масштабе окна браузера. */}
      {boardW > 0 && boardH > 0 && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(11, 1fr)',
        gridTemplateRows: 'repeat(11, 1fr)',
        gap: '0',
        width: `${boardW}px`,
        height: `${boardH}px`,
        background: '#c8e6c9',
        border: '4px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {boardCells.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            if (cell) {
              const isCorner = (rowIndex === 0 || rowIndex === 10) && (colIndex === 0 || colIndex === 10);
              const isEdge = rowIndex === 0 || rowIndex === 10 || colIndex === 0 || colIndex === 10;
              const size = isCorner ? 'large' : isEdge ? 'medium' : 'small';
              return (
                <div key={`${rowIndex}-${colIndex}`} style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                  {renderCell(cell, size as 'small' | 'medium' | 'large')}
                </div>
              );
            }
            return <div key={`${rowIndex}-${colIndex}`} style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 1, background: '#c8e6c9' }} />;
          })
        )}
        
        <div style={{ gridColumn: '2 / 11', gridRow: '2 / 11', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#c8e6c9', padding: 'clamp(10px, 2vw, 30px)' }}>
          <div style={{
            fontSize: 'clamp(14px, 2vw, 22px)',
            color: '#333',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.95)',
            padding: 'clamp(12px, 2vw, 24px) clamp(20px, 3vw, 40px)',
            borderRadius: '16px',
            maxWidth: '80%',
            wordBreak: 'break-word',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            fontWeight: '600',
            lineHeight: 1.5,
            border: '2px solid rgba(0,0,0,0.08)',
          }}>
            {gameState.message}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}