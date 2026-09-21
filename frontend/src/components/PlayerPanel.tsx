import { useState } from 'react';
import { GameState } from '../types';
import { BOARD, PropertyCell, getColorHex } from '../board';

interface PlayerPanelProps {
  gameState: GameState;
  currentPlayerId: string;
  onMortgage: (propertyId: number) => void;
  onUnmortgage: (propertyId: number) => void;
}

export default function PlayerPanel({ gameState, currentPlayerId, onMortgage, onUnmortgage }: PlayerPanelProps) {
  // ID игрока, чьё окно имущества открыто (null — окно закрыто)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const selectedPlayer = gameState.players.find(p => p.id === selectedPlayerId) ?? null;
  const isMyTurn = currentPlayerId === gameState.players[gameState.currentPlayerIndex]?.id;
  // Управлять залогом можно только своей недвижимостью, в свой ход и не во время аукциона
  const canManageMortgages = selectedPlayer?.id === currentPlayerId && isMyTurn && gameState.phase !== 'auction';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
      <h3 style={{ margin: 0, color: '#333', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', flexShrink: 0 }}>
        👥 Игроки
      </h3>

      {/* Все игроки в одну строку; содержимое карточки — тоже в одну строку */}
      <div style={{ display: 'flex', gap: '6px', flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        {gameState.players.map(player => (
          <div
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            title={`${player.name} — нажмите, чтобы посмотреть имущество`}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: player.id === currentPlayerId ? '#fff9c4' : '#f8f9fa',
              border: player.id === currentPlayerId ? '2px solid gold' : '2px solid #e0e0e0',
              borderRadius: '8px',
              opacity: player.isBankrupt ? 0.5 : 1,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* 1. Цвет фишки */}
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: player.color,
              border: '2px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}>
              {player.emoji}
            </div>

            {/* 2. Имя */}
            <div style={{
              fontWeight: 'bold',
              fontSize: '12px',
              color: '#333',
              minWidth: 0,
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {player.name}
              {player.id === currentPlayerId && ' 👑'}
              {player.isInJail && ' 🔒'}
              {player.isBankrupt && ' 💀'}
            </div>

            {/* 3. Баланс — свой виден числом, чужой скрыт */}
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: player.money === null ? '#999' : '#2e7d32', flexShrink: 0 }}>
              {player.money === null ? '🔒' : `$${player.money}`}
            </div>

            {/* 4. Количество недвижимости */}
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#1976d2', flexShrink: 0 }}>
              🏠{player.properties.length}
            </div>
          </div>
        ))}
      </div>

      {/* ВСПЛЫВАЮЩЕЕ ОКНО СО СПИСКОМ НЕДВИЖИМОСТИ ИГРОКА */}
      {selectedPlayer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedPlayerId(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '420px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка окна */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
                {selectedPlayer.emoji} {selectedPlayer.name}
              </h3>
              <button
                onClick={() => setSelectedPlayerId(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ✕
              </button>
            </div>

            {/* Сводка по игроку */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '13px', color: '#555', flexWrap: 'wrap' }}>
              <span>💰 Деньги: <b style={{ color: selectedPlayer.money === null ? '#999' : '#2e7d32' }}>{selectedPlayer.money === null ? '🔒 скрыто' : `$${selectedPlayer.money}`}</b></span>
              <span>🏠 Имущество: <b style={{ color: '#1976d2' }}>{selectedPlayer.properties.length}</b></span>
              {selectedPlayer.getOutOfJailCards > 0 && (
                <span>🎫 Карты тюрьмы: <b>{selectedPlayer.getOutOfJailCards}</b></span>
              )}
              {selectedPlayer.isInJail && <span style={{ color: '#c62828', fontWeight: 'bold' }}>🔒 В тюрьме</span>}
              {selectedPlayer.isBankrupt && <span style={{ color: '#666', fontWeight: 'bold' }}>💀 Банкрот</span>}
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>🏘️ Недвижимость:</h4>

            {selectedPlayer.properties.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic', fontSize: '13px', margin: 0 }}>
                Нет собственности
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedPlayer.properties.map(propId => {
                  const cell = BOARD[propId] as PropertyCell;
                  const property = gameState.properties[propId];
                  if (!cell) return null;
                  const unmortgageCost = Math.ceil((cell.mortgageValue ?? 0) * 1.1);
                  return (
                    <div
                      key={propId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '8px 10px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        border: '1px solid #eee',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        {/* Цвет группы + название */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            background: getColorHex(cell.color),
                            border: '1px solid #333',
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {cell.name}
                          </span>
                        </div>

                        {/* Цена, постройки, залог */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#666', flexShrink: 0 }}>
                          <span>${cell.price}</span>
                          {property && property.houses > 0 && (
                          <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>
                          {property.houses === 5 ? '🏨 Отель' : `${property.houses}🏠`}
                        </span>
                       )}
                      {property?.isMortgaged && (
                      <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>📜 Залог</span>
                       )}
                      </div>
                      </div>

                      {/* Кнопки управления залогом — только для владельца, в его ход */}
                      {canManageMortgages && property && (() => {
                        // canManageMortgages гарантирует, что это САМ игрок — его баланс всегда виден (не null)
                        const myMoney = selectedPlayer.money ?? 0;
                        return property.isMortgaged ? (
                          <button
                            onClick={() => onUnmortgage(propId)}
                            disabled={myMoney < unmortgageCost}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '4px 10px',
                              background: myMoney < unmortgageCost ? '#aaa' : '#2e7d32',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: myMoney < unmortgageCost ? 'not-allowed' : 'pointer',
                            }}
                          >
                            💵 Выкупить за ${unmortgageCost}
                          </button>
                        ) : (
                          property.houses === 0 && (
                            <button
                              onClick={() => onMortgage(propId)}
                              style={{
                                alignSelf: 'flex-start',
                                padding: '4px 10px',
                                background: '#757575',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                              }}
                            >
                              📜 Заложить за ${cell.mortgageValue}
                            </button>
                          )
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setSelectedPlayerId(null)}
              style={{
                width: '100%',
                marginTop: '14px',
                padding: '10px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}