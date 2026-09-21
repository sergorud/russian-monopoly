import * as fs from 'fs';
import * as path from 'path';
import { Room, Player, GameState, RoomSettings, DEFAULT_ROOM_SETTINGS, Property } from './types';
import { GameEngine } from './GameEngine';
import { PLAYER_COLORS } from './board';

const SAVES_DIR = path.join(__dirname, '..', '..', 'saves');
const MIN_STARTING_MONEY = 200;
const MAX_STARTING_MONEY = 100000;

/** Проверяет и приводит к разумным границам присланные настройки комнаты */
function normalizeSettings(input?: Partial<RoomSettings>): RoomSettings {
  const startingMoneyRaw = input?.startingMoney;
  const startingMoney =
    typeof startingMoneyRaw === 'number' && Number.isFinite(startingMoneyRaw)
      ? Math.round(Math.min(MAX_STARTING_MONEY, Math.max(MIN_STARTING_MONEY, startingMoneyRaw)))
      : DEFAULT_ROOM_SETTINGS.startingMoney;

  const auctionEnabled = typeof input?.auctionEnabled === 'boolean' ? input.auctionEnabled : DEFAULT_ROOM_SETTINGS.auctionEnabled;

  return { startingMoney, auctionEnabled };
}

/**
 * Менеджер игр - управляет всеми активными комнатами
 */
export class GameManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private engines: Map<string, GameEngine> = new Map();

  constructor() {
    try {
      fs.mkdirSync(SAVES_DIR, { recursive: true });
    } catch (e) {
      console.error('Не удалось создать папку сохранений:', e);
    }
  }

  /**
   * Создает новую комнату
   */
  createRoom(playerName: string, socketId: string, settings?: Partial<RoomSettings>): string {
    const roomId = this.generateRoomId();
    const roomSettings = normalizeSettings(settings);

    const player: Player = {
      id: socketId,
      name: playerName,
      money: roomSettings.startingMoney,
      position: 0,
      color: PLAYER_COLORS[0].color,
      emoji: PLAYER_COLORS[0].emoji,
      isInJail: false,
      jailTurns: 0,
      doublesCount: 0,
      isBankrupt: false,
      properties: [],
      getOutOfJailCards: 0,
    };

    const room: Room = {
      id: roomId,
      players: [player],
      hostId: socketId,
      status: 'waiting',
      createdAt: Date.now(),
      gameState: null,
      settings: roomSettings,
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(socketId, roomId);

    return roomId;
  }

  /**
   * Присоединяет игрока к комнате.
   * ИДЕМПОТЕНТНО: если этот сокет уже в комнате — игрок не дублируется.
   * Также запрещает два активных игрока с одинаковым именем.
   */
  joinRoom(roomId: string, playerName: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);

    if (!room || room.players.length >= 4) {
      return false;
    }

    // FIX БАГА №1: сокет уже в комнате — не добавляем дубликат
    if (room.players.some(p => p.id === socketId)) {
      return true;
    }

    // Имя уже занято активным (или offline) игроком — дубликаты имён запрещены
    if (room.players.some(p => p.name === playerName)) {
      return false;
    }

    const playerIndex = room.players.length;
    const player: Player = {
      id: socketId,
      name: playerName,
      money: room.settings.startingMoney,
      position: 0,
      color: PLAYER_COLORS[playerIndex].color,
      emoji: PLAYER_COLORS[playerIndex].emoji,
      isInJail: false,
      jailTurns: 0,
      doublesCount: 0,
      isBankrupt: false,
      properties: [],
      getOutOfJailCards: 0,
    };

    room.players.push(player);
    this.playerToRoom.set(socketId, roomId);

    return true;
  }

  /**
   * Начинает игру
   */
  startGame(roomId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length < 2) {
      return null;
    }

    const playerNames = room.players.map(p => p.name);
    const engine = new GameEngine(playerNames, room.settings);
    engine.setRoomId(roomId);

    const gameState = engine.getState();
    gameState.players.forEach((p, index) => {
      p.id = room.players[index].id;
    });

    gameState.phase = 'rolling';
    gameState.message = `Ход игрока ${gameState.players[0].name}. Бросайте кубики!`;

    this.engines.set(roomId, engine);
    room.status = 'playing';
    room.gameState = gameState;

    this.persistRoom(roomId);

    return gameState;
  }

  /**
   * Получает движок игры
   */
  getEngine(roomId: string): GameEngine | null {
    return this.engines.get(roomId) || null;
  }

  /**
   * Удаляет игрока из комнаты
   */
  removePlayer(socketId: string): string | null {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return null;

    const playerName = room.players[playerIndex].name;
    room.players.splice(playerIndex, 1);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.engines.delete(roomId);
    } else if (room.hostId === socketId) {
      room.hostId = room.players[0].id;
    }

    this.playerToRoom.delete(socketId);
    return playerName;
  }

  /**
   * Получает комнату игрока
   */
  getPlayerRoom(socketId: string): string | null {
    return this.playerToRoom.get(socketId) || null;
  }

  /**
   * Получает список игроков в комнате
   */
  getRoomPlayers(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    return room ? room.players : [];
  }

  /**
   * Получает комнату
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Получает количество активных комнат
   */
  getActiveRoomsCount(): number {
    return this.rooms.size;
  }

  /**
   * Перепривязывает socket.id к комнате
   */
  rebindPlayer(newSocketId: string, roomId: string): void {
    this.playerToRoom.set(newSocketId, roomId);
  }

  /**
   * Помечает игрока как отключенного (без удаления из комнаты)
   */
  markPlayerDisconnected(socketId: string): void {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socketId);
    if (player) {
      (player as any).disconnected = true;
    }
  }

  /**
   * Находит игрока по имени в комнате
   */
  findPlayerByName(roomId: string, playerName: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.players.find(p => p.name === playerName) || null;
  }

  /**
   * FIX БАГА №2: обновляет socket.id игрока ВО ВСЕХ местах:
   * - в списке игроков комнаты
   * - в hostId комнаты
   * - в игровом движке (players)
   * - во владельцах собственности (properties.ownerId)
   */
  updatePlayerSocketId(roomId: string, playerName: string, newSocketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.find(p => p.name === playerName);
    if (!player) return false;

    const oldId = player.id;

    // Обновляем игрока в комнате
    player.id = newSocketId;
    (player as any).disconnected = false;

    // Обновляем хоста, если это он
    if (room.hostId === oldId) {
      room.hostId = newSocketId;
    }

    // Обновляем привязку сокет -> комната
    this.playerToRoom.delete(oldId);
    this.playerToRoom.set(newSocketId, roomId);

    // Синхронизируем игровой движок
    const engine = this.engines.get(roomId);
    if (engine) {
      const state = engine.getState();

      // Обновляем id игрока в движке
      const enginePlayer = state.players.find(p => p.id === oldId);
      if (enginePlayer) {
        enginePlayer.id = newSocketId;
      }

      // Обновляем владельцев собственности
      state.properties.forEach(prop => {
        if (prop.ownerId === oldId) {
          prop.ownerId = newSocketId;
        }
      });
    }

    return true;
  }

  /**
   * Генерирует уникальный ID комнаты
   */
  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (this.rooms.has(roomId)) {
      return this.generateRoomId();
    }

    return roomId;
  }

  /**
   * ===================== СОХРАНЕНИЕ / ВОССТАНОВЛЕНИЕ ИГРЫ =====================
   * Игра автоматически сохраняется на диск при каждом изменении состояния,
   * поэтому комнату можно продолжить позже по тому же коду — даже если
   * сервер был перезапущен (при условии, что папка saves сохраняется на
   * постоянном томе, см. docker-compose.yml).
   */

  /** Путь к файлу сохранения комнаты */
  private saveFilePath(roomId: string): string {
    return path.join(SAVES_DIR, `${roomId}.json`);
  }

  /** Сохраняет текущее состояние комнаты (и игры, если она идёт) на диск */
  persistRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const engine = this.engines.get(roomId);
    const gameStateForSave = engine
      ? { ...engine.getState(), properties: Object.fromEntries(engine.getState().properties) }
      : null;

    const payload = {
      id: room.id,
      players: room.players,
      hostId: room.hostId,
      status: room.status,
      createdAt: room.createdAt,
      settings: room.settings,
      gameState: gameStateForSave,
      savedAt: Date.now(),
    };

    try {
      fs.writeFileSync(this.saveFilePath(roomId), JSON.stringify(payload));
    } catch (e) {
      console.error(`Не удалось сохранить комнату ${roomId}:`, e);
    }
  }

  /** Есть ли на диске сохранение для этого кода комнаты */
  hasSavedRoom(roomId: string): boolean {
    try {
      return fs.existsSync(this.saveFilePath(roomId));
    } catch {
      return false;
    }
  }

  /**
   * Пытается восстановить комнату с диска в память (например, после
   * перезапуска сервера). Все игроки помечаются как offline — как только
   * кто-то из них зайдёт под своим именем, сработает обычный механизм
   * восстановления сессии (updatePlayerSocketId).
   * Возвращает true, если комната была восстановлена.
   */
  tryLoadRoom(roomId: string): boolean {
    if (this.rooms.has(roomId)) return true;

    let raw: string;
    try {
      raw = fs.readFileSync(this.saveFilePath(roomId), 'utf-8');
    } catch {
      return false;
    }

    try {
      const data = JSON.parse(raw);
      const settings: RoomSettings = normalizeSettings(data.settings);

      const players: Player[] = (data.players || []).map((p: Player) => ({ ...p, disconnected: true } as any));

      const room: Room = {
        id: data.id,
        players,
        hostId: data.hostId,
        status: data.status,
        createdAt: data.createdAt,
        gameState: null,
        settings,
      };

      this.rooms.set(roomId, room);

      if (data.gameState) {
        const propertiesObj: Record<string, Property> = data.gameState.properties || {};
        const restoredState: GameState = {
          ...data.gameState,
          properties: new Map(Object.entries(propertiesObj).map(([k, v]) => [Number(k), v])),
        };
        const engine = GameEngine.fromSavedState(restoredState, settings);
        engine.setRoomId(roomId);
        this.engines.set(roomId, engine);
        room.gameState = engine.getState();
      }

      console.log(`♻️ Комната ${roomId} восстановлена из сохранения`);
      return true;
    } catch (e) {
      console.error(`Не удалось восстановить комнату ${roomId}:`, e);
      return false;
    }
  }
}