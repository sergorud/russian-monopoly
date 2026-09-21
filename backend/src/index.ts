import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game/GameManager';
import { GameState, RoomSettings } from './game/types';

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const gameManager = new GameManager();

// Таймеры отложенного удаления игроков (ключ — socket.id)
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_PERIOD = 60000;

/**
 * ГЛАВНОЕ ИСПРАВЛЕНИЕ: Map не переживает JSON.stringify (превращается в {}).
 * Перед отправкой клиенту конвертируем properties из Map в обычный объект.
 */
const serializeState = (state: GameState): any => ({
  ...state,
  properties: state.properties instanceof Map
    ? Object.fromEntries(state.properties)
    : state.properties,
});

/**
 * Приватность: каждый игрок видит только СВОИ деньги и только СВОИ
 * анимации салюта/слёз (positiveEvents/negativeEvents других игроков вообще
 * не долетают до его браузера — не только скрыты в интерфейсе, а
 * отсутствуют в данных).
 */
const maskMoneyForViewer = (state: GameState, viewerId: string): any => {
  const serialized = serializeState(state);
  return {
    ...serialized,
    players: serialized.players.map((p: any) =>
      p.id === viewerId ? p : { ...p, money: null }
    ),
    positiveEvents: (serialized.positiveEvents ?? []).filter((e: any) => e.playerId === viewerId),
    negativeEvents: (serialized.negativeEvents ?? []).filter((e: any) => e.playerId === viewerId),
  };
};

/**
 * Рассылает состояние игры всем сокетам в комнате — каждому персонально,
 * с замаскированными чужими балансами (см. maskMoneyForViewer).
 */
const broadcastGameState = (
  roomId: string,
  state: GameState,
  event: 'game_started' | 'game_state_updated' = 'game_state_updated'
) => {
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    io.to(socketId).emit(event, { gameState: maskMoneyForViewer(state, socketId) });
  }
};

io.on('connection', (socket) => {
  console.log(`🔌 Новый клиент: ${socket.id}`);

  if (disconnectTimers.has(socket.id)) {
    clearTimeout(disconnectTimers.get(socket.id)!);
    disconnectTimers.delete(socket.id);
  }

  // ========== СОЗДАНИЕ КОМНАТЫ ==========
  socket.on('create_room', (data: { playerName: string; settings?: Partial<RoomSettings> } | string, callback: (roomId: string) => void) => {
    // Поддерживаем и старый формат (просто строка с именем) для обратной совместимости
    const playerName = typeof data === 'string' ? data : data.playerName;
    const settings = typeof data === 'string' ? undefined : data.settings;

    const roomId = gameManager.createRoom(playerName, socket.id, settings);
    socket.join(roomId);
    gameManager.persistRoom(roomId);
    console.log(`🏠 Комната ${roomId} создана игроком ${playerName}`);
    callback(roomId);
  });

  // ========== ВХОД В КОМНАТУ (идемпотентный + восстановление сессии + загрузка сохранённой игры) ==========
  socket.on('join_room', (data: { roomId: string; playerName: string }, callback: (success: boolean, error?: string) => void) => {
    // Комнаты нет в памяти — пробуем поднять её с диска (сохранённая ранее игра)
    if (!gameManager.getRoom(data.roomId)) {
      gameManager.tryLoadRoom(data.roomId);
    }

    const room = gameManager.getRoom(data.roomId);

    if (room) {
      // Сокет уже в комнате — не дублируем
      const already = room.players.find(p => p.id === socket.id);
      if (already) {
        socket.join(data.roomId);
        io.to(data.roomId).emit('player_joined', {
          playerName: already.name,
          players: room.players,
          settings: room.settings
        });
        const engine = gameManager.getEngine(data.roomId);
        if (engine) {
          socket.emit('game_started', { gameState: maskMoneyForViewer(engine.getState(), socket.id) });
        }
        callback(true);
        return;
      }

      const existing = gameManager.findPlayerByName(data.roomId, data.playerName);

      // Имя занято активным игроком — отказ
      if (existing && !(existing as any).disconnected) {
        callback(false, 'Игрок с таким именем уже в комнате');
        return;
      }

      // Игрок был offline (обновил страницу) — восстанавливаем
      if (existing && (existing as any).disconnected) {
        const oldId = existing.id;
        const updated = gameManager.updatePlayerSocketId(data.roomId, data.playerName, socket.id);

        if (updated) {
          if (disconnectTimers.has(oldId)) {
            clearTimeout(disconnectTimers.get(oldId)!);
            disconnectTimers.delete(oldId);
          }

          socket.join(data.roomId);
          console.log(`♻️ Сессия восстановлена: ${data.playerName}`);

          io.to(data.roomId).emit('player_joined', {
            playerName: data.playerName,
            players: gameManager.getRoomPlayers(data.roomId),
            settings: room.settings
          });

          const engine = gameManager.getEngine(data.roomId);
          if (engine) {
            socket.emit('game_started', { gameState: maskMoneyForViewer(engine.getState(), socket.id) });
          }

          callback(true);
          return;
        }
      }
    }

    // Обычный вход нового игрока
    const success = gameManager.joinRoom(data.roomId, data.playerName, socket.id);

    if (success) {
      socket.join(data.roomId);
      console.log(`👤 ${data.playerName} присоединился к ${data.roomId}`);

      io.to(data.roomId).emit('player_joined', {
        playerName: data.playerName,
        players: gameManager.getRoomPlayers(data.roomId),
        settings: gameManager.getRoom(data.roomId)?.settings
      });

      callback(true);
    } else {
      callback(false, 'Комната не найдена или заполнена');
    }
  });

  // ========== ВЫБОР ФИШКИ ==========
  socket.on('choose_token', (data: { roomId: string; token: string }) => {
    const room = gameManager.getRoom(data.roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.emoji = data.token;
        io.to(data.roomId).emit('player_joined', {
          playerName: player.name,
          players: room.players,
          settings: room.settings
        });
      }
    }
  });

  // ========== НАЧАЛО ИГРЫ ==========
  socket.on('start_game', (roomId: string) => {
    const room = gameManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) {
      socket.emit('error', { message: 'Только хост может начать игру' });
      return;
    }

    const gameState = gameManager.startGame(roomId);
    if (gameState) {
      broadcastGameState(roomId, gameState, 'game_started');
      console.log(`🎮 Игра началась в комнате ${roomId}`);
    }
  });

  // ========== ИГРОВЫЕ ДЕЙСТВИЯ ==========
  socket.on('roll_dice', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.rollDice();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('buy_property', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.buyProperty();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('decline_buy', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.declineBuy();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('end_turn', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.endTurn();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('pay_fine', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.payFine();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('use_jail_card', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.useJailCard();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('build_house', (roomId: string, propertyId: number) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.buildHouse(propertyId);
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  // ========== АУКЦИОН ==========
  // ВАЖНО: во время аукциона ходит не обязательно "текущий игрок" хода, а тот,
  // чья очередь ставить/пасовать в самом аукционе — проверяем именно это.
  socket.on('place_bid', (roomId: string, amount: number) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const bidderId = engine.getAuctionCurrentBidderId();
    if (bidderId !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваша очередь ставить на аукционе' });
      return;
    }
    try {
      engine.placeBid(amount);
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('pass_auction', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const bidderId = engine.getAuctionCurrentBidderId();
    if (bidderId !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваша очередь на аукционе' });
      return;
    }
    try {
      engine.passAuction();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  // ========== ЗАЛОГ НЕДВИЖИМОСТИ ==========
  socket.on('mortgage_property', (roomId: string, propertyId: number) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.mortgageProperty(propertyId);
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('unmortgage_property', (roomId: string, propertyId: number) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.unmortgageProperty(propertyId);
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  socket.on('propose_auction', (roomId: string) => {
    const engine = gameManager.getEngine(roomId);
    if (!engine) return;
    const currentPlayer = engine.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    try {
      engine.proposeAuction();
      gameManager.persistRoom(roomId);
      broadcastGameState(roomId, engine.getState());
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });

  // ========== СОХРАНЕНИЕ ИГРЫ ==========
  // Игра и так сохраняется автоматически после каждого действия, эта кнопка
  // просто даёт игроку явное подтверждение и повод посмотреть код комнаты.
  socket.on('save_game', (roomId: string) => {
    const room = gameManager.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    gameManager.persistRoom(roomId);
    io.to(roomId).emit('game_saved', { savedAt: Date.now() });
    console.log(`💾 Комната ${roomId} сохранена вручную`);
  });

  // ========== ОТКЛЮЧЕНИЕ (graceful) ==========
  socket.on('disconnect', () => {
    console.log(`⚠️ Клиент отключен: ${socket.id}`);

    const roomId = gameManager.getPlayerRoom(socket.id);
    if (roomId) {
      const room = gameManager.getRoom(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          gameManager.markPlayerDisconnected(socket.id);
          console.log(`💤 ${player.name} помечен как offline`);

          const timer = setTimeout(() => {
            console.log(`🗑️ Удаляем ${player.name} после таймаута`);
            const removedName = gameManager.removePlayer(socket.id);
            if (removedName) {
              io.to(roomId).emit('player_left', {
                playerName: removedName,
                players: gameManager.getRoomPlayers(roomId)
              });
            }
            disconnectTimers.delete(socket.id);
          }, DISCONNECT_GRACE_PERIOD);

          disconnectTimers.set(socket.id, timer);
        }
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: gameManager.getActiveRoomsCount(),
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});