import { useEffect, useState } from 'react';
import { GameState } from '../types';
import { BOARD, PropertyCell } from '../board';

interface ActionPanelProps {
  gameState: GameState;
  currentPlayerId: string;
  onRollDice: () => void;
  onBuyProperty: () => void;
  onDeclineBuy: () => void;
  onEndTurn: () => void;
  onPayFine: () => void;
  onUseJailCard: () => void;
  onBuildHouse: (propertyId: number) => void;
  onPlaceBid: (amount: number) => void;
  onPassAuction: () => void;
  onProposeAuction: () => void;
  onLeaveRoom: () => void;
  onShowRules: () => void;
  onSaveGame: () => void;
}

const DICE_COLORS = ['#e74c3c', '#3498db'];

/** Кубик с выпавшим ЧИСЛОМ */
function Die({ value, color }: { value: number | null; color: string }) {
  return (
    <div style={{
      width: '34px',
      height: '34px',
      background: color,
      border: '2px solid #333',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#ffffff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      flexShrink: 0,
    }}>
      {value ?? '–'}
    </div>
  );
}

export default function ActionPanel({
  gameState,
  currentPlayerId,
  onRollDice,
  onBuyProperty,
  onDeclineBuy,
  onEndTurn,
  onPayFine,
  onUseJailCard,
  onBuildHouse,
  onPlaceBid,
  onPassAuction,
  onProposeAuction,
  onLeaveRoom,
  onShowRules,
  onSaveGame,
}: ActionPanelProps) {
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);

  const auction = gameState.auction;
  const auctionCell = auction ? (BOARD[auction.cellId] as PropertyCell) : null;
  const isMyBidTurn = !!auction && auction.biddersOrder[auction.currentBidderIndex] === currentPlayerId;
  // Торги стартуют с 80% цены клетки, шаг повышения — 10% цены (значения приходят с сервера)
  const minBid = auction ? (auction.highestBid > 0 ? auction.highestBid + auction.bidStep : auction.startingBid) : 1;
  const [bidAmount, setBidAmount] = useState(minBid);

  // Держим введённую ставку не меньше минимально допустимой при её изменении
  useEffect(() => {
    setBidAmount(prev => Math.max(prev, minBid));
  }, [minBid]);

  if (!currentPlayer) return null;

  const isMyTurn = currentPlayer.id === gameState.players[gameState.currentPlayerIndex]?.id;
  const currentCell = BOARD[currentPlayer.position];
  // currentPlayer — это всегда сам зритель (найден по currentPlayerId), сервер никогда
  // не маскирует его собственный баланс, поэтому здесь он всегда настоящее число.
  const myMoney = currentPlayer.money ?? 0;

  // Можно ли предложить аукцион по клетке, на которой сейчас стоит игрок:
  // чужая, не в залоге, без домов/отеля недвижимость/ж/д/предприятие
  const currentCellProperty = gameState.properties[currentPlayer.position];
  const canChallengeAuction = !!(
    currentCellProperty &&
    currentCellProperty.ownerId &&
    currentCellProperty.ownerId !== currentPlayer.id &&
    !currentCellProperty.isMortgaged &&
    currentCellProperty.houses === 0 &&
    !gameState.players.find(p => p.id === currentCellProperty.ownerId)?.isBankrupt
  );

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '8px 10px',
    background: color,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    flex: '1 1 auto',
  });

  const smallBtnStyle = (color: string): React.CSSProperties => ({
    padding: '4px 8px',
    background: color,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '11px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  });

  const buildable = currentPlayer.properties.filter(propId => {
    const cell = BOARD[propId] as PropertyCell;
    const property = gameState.properties[propId];
    if (!property || cell.type !== 'property' || property.houses >= 5 || property.isMortgaged) return false;
    const colorCells = BOARD.filter(c => c.type === 'property' && c.color === cell.color);
    const hasMonopoly = colorCells.every(c => {
      const p = gameState.properties[c.id];
      return p && p.ownerId === currentPlayer.id && !p.isMortgaged;
    });
    if (!hasMonopoly) return false;
    const minHouses = Math.min(...colorCells.map(c => gameState.properties[c.id]?.houses || 0));
    if (property.houses > minHouses) return false;
    return myMoney >= cell.houseCost;
  });

  const [d1, d2] = gameState.lastDiceRoll ?? [null, null];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
      {/* Шапка: заголовок слева, ПРАВИЛА и ВЫХОД справа */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <h3 style={{ margin: 0, color: '#333', fontSize: '13px', fontWeight: 'bold' }}>
          {gameState.phase === 'auction' ? '🔨 Аукцион' : '🎲 Бросить кости'}
        </h3>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={onSaveGame} style={smallBtnStyle('#2e7d32')}>💾 Сохранить</button>
          <button onClick={onShowRules} style={smallBtnStyle('#667eea')}>📜 Правила</button>
          <button onClick={onLeaveRoom} style={smallBtnStyle('#e74c3c')}>🚪 Выйти</button>
        </div>
      </div>

      {/* ВСЁ В ОДНУ СТРОКУ: кубики | кнопки | клетка */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <Die value={d1} color={DICE_COLORS[0]} />
          <Die value={d2} color={DICE_COLORS[1]} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, flexWrap: 'nowrap' }}>
          {gameState.phase === 'auction' && auction && auctionCell && (
            <>
              <div style={{ flexShrink: 0, fontSize: '11px', color: '#333', whiteSpace: 'nowrap' }}>
                <b>{auctionCell.name}</b>
                {auction.originalOwnerId && (
                  <> · продавец <b>{gameState.players.find(p => p.id === auction.originalOwnerId)?.name}</b></>
                )}
                {' · '}
                {auction.highestBid > 0 ? (
                  <>лидер <b style={{ color: '#2e7d32' }}>${auction.highestBid}</b></>
                ) : (
                  <>ставок ещё нет</>
                )}
              </div>

              {isMyBidTurn ? (
                <>
                  <input
                    type="number"
                    min={minBid}
                    step={1}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(Math.max(minBid, Number(e.target.value) || minBid))}
                    style={{ width: '64px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '12px', flexShrink: 0 }}
                  />
                  <button
                    onClick={() => onPlaceBid(bidAmount)}
                    disabled={myMoney < bidAmount}
                    style={{ ...btnStyle(myMoney < bidAmount ? '#aaa' : '#2e7d32'), cursor: myMoney < bidAmount ? 'not-allowed' : 'pointer' }}
                  >
                    🔨 Ставка ${bidAmount}
                  </button>
                  <button onClick={onPassAuction} style={btnStyle('#757575')}>❌ Пас</button>
                </>
              ) : (
                <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '12px', color: '#666', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ⏳ Ставит: {gameState.players.find(p => p.id === auction.biddersOrder[auction.currentBidderIndex])?.name}
                </div>
              )}
            </>
          )}

          {gameState.phase === 'rolling' && isMyTurn && (
            <button onClick={onRollDice} style={btnStyle('#667eea')}>🎲 Бросить</button>
          )}

          {gameState.phase === 'buying' && isMyTurn && (
            <>
              <button onClick={onBuyProperty} style={btnStyle('#2e7d32')}>
                💰 Купить ${(currentCell as PropertyCell).price}
              </button>
              <button onClick={onDeclineBuy} style={btnStyle('#757575')}>❌ Отказ</button>
            </>
          )}

          {gameState.phase === 'end_turn' && isMyTurn && (
            <button onClick={onEndTurn} style={btnStyle('#f57c00')}>✅ Завершить ход</button>
          )}

          {gameState.phase === 'end_turn' && isMyTurn && gameState.settings.auctionEnabled && canChallengeAuction && (
            <button onClick={onProposeAuction} style={btnStyle('#8e24aa')}>
              🔨 Аукцион на «{currentCell.name}» (от ${(currentCell as PropertyCell).price * 2})
            </button>
          )}

          {currentPlayer.isInJail && isMyTurn && gameState.phase === 'rolling' && (
            <>
              <div style={{ flexShrink: 0, fontSize: '11px', fontWeight: 'bold', color: '#c62828', whiteSpace: 'nowrap' }}>
                🔒 {currentPlayer.jailTurns}/3
              </div>
              {myMoney >= 50 && (
                <button onClick={onPayFine} style={btnStyle('#d32f2f')}>💵 $50</button>
              )}
              {currentPlayer.getOutOfJailCards > 0 && (
                <button onClick={onUseJailCard} style={btnStyle('#7b1fa2')}>🎫 Карта</button>
              )}
            </>
          )}

          {isMyTurn && (gameState.phase === 'end_turn' || gameState.phase === 'rolling') &&
            buildable.map(propId => {
              const cell = BOARD[propId] as PropertyCell;
              const property = gameState.properties[propId];
              return (
                <button key={propId} onClick={() => onBuildHouse(propId)} style={btnStyle('#388e3c')}>
                  🏗️ {cell.name} (${cell.houseCost}){property.houses > 0 ? ` [${property.houses}/5]` : ''}
                </button>
              );
            })}

          {gameState.phase !== 'auction' && !isMyTurn && (
            <div style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'center',
              fontSize: '12px',
              color: '#666',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              ⏳ Ходит: {gameState.players[gameState.currentPlayerIndex]?.name}
            </div>
          )}
        </div>

        <div style={{
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '30%',
          padding: '5px 8px',
          background: '#f5f5f5',
          borderRadius: '6px',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '9px', color: '#666', whiteSpace: 'nowrap' }}>Вы на:</div>
          <div style={{
            fontWeight: 'bold',
            fontSize: '11px',
            color: '#333',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {currentCell.name}
          </div>
        </div>
      </div>
    </div>
  );
}