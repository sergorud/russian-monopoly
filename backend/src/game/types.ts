/**
 * Типы данных для игры Монополия
 */

// Типы клеток на поле
export type CellType = 
  | 'property'      // Недвижимость (улица)
  | 'railroad'      // Железная дорога
  | 'utility'       // Коммунальное предприятие
  | 'tax'           // Налог
  | 'chance'        // Шанс
  | 'community'     // Общественная казна
  | 'go'            // Старт
  | 'jail'          // Тюрьма (посещение)
  | 'go_to_jail'    // В тюрьму
  | 'free_parking'  // Бесплатная парковка

// Цветовая группа недвижимости
export type PropertyColor = 
  | 'brown' | 'lightblue' | 'pink' | 'orange' 
  | 'red' | 'yellow' | 'green' | 'darkblue'
  | 'railroad' | 'utility' | null;

// Базовая клетка
export interface Cell {
  id: number;
  name: string;
  type: CellType;
  color?: PropertyColor;
  price?: number;
  rent?: number[]; // Аренда: [без домов, 1 дом, 2 дома, 3 дома, 4 дома, отель]
  houseCost?: number; // Стоимость дома
  mortgageValue?: number; // Залоговая стоимость
}

// Клетка "Шанс" или "Общественная казна"
export interface CardCell extends Cell {
  type: 'chance' | 'community';
}

// Клетка недвижимости
export interface PropertyCell extends Cell {
  type: 'property' | 'railroad' | 'utility';
  color: PropertyColor;
  price: number;
  rent: number[];
  houseCost: number;
  mortgageValue: number;
}

// Состояние собственности
export interface Property {
  cellId: number;
  ownerId: string | null;
  houses: number; // 0-4 дома, 5 = отель
  isMortgaged: boolean;
  // Если задано — аренда с этой недвижимости не взимается (равна $0), пока
  // turnCount игры не достигнет этого значения. Используется событием
  // "землетрясение" (недвижимость не приносит доход 3 хода).
  incomeBlockedUntilTurn?: number;
}

// Игрок
export interface Player {
  id: string;
  name: string;
  money: number;
  position: number;
  color: string;
  emoji: string;
  isInJail: boolean;
  jailTurns: number; // Сколько ходов в тюрьме
  doublesCount: number; // Количество дублей подряд
  isBankrupt: boolean;
  properties: number[]; // ID клеток, которыми владеет
  getOutOfJailCards: number; // Карты "выход из тюрьмы"
}

// Настройки комнаты/игры, задаются при создании комнаты
export interface RoomSettings {
  startingMoney: number;  // Стартовый капитал каждого игрока (по умолчанию 1500)
  auctionEnabled: boolean; // Играть ли с аукционом при отказе от покупки / нехватке денег
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  startingMoney: 1500,
  auctionEnabled: true,
};

// Состояние аукциона
export interface AuctionState {
  cellId: number; // Клетка, выставленная на аукцион
  startingBid: number; // Стартовая ставка (80% цены — обычный аукцион; 200% цены — вызов на аукцион чужой собственности)
  bidStep: number; // Минимальный шаг повышения ставки (10% цены — обычный; 20% цены — вызов)
  highestBid: number; // Текущая наивысшая ставка (0, если ставок ещё не было)
  highestBidderId: string | null; // Кто её сделал
  biddersOrder: string[]; // ID игроков, всё ещё участвующих в торгах (по кругу)
  currentBidderIndex: number; // Чья сейчас очередь ставить/пасовать (индекс в biddersOrder)
  originalOwnerId: string | null; // null — обычный аукцион (лот у банка); иначе — ID текущего владельца при "вызове на аукцион"
}

// Тип положительного события — вызывает анимацию салюта на клиенте
// ТОЛЬКО у того игрока, с которым это произошло (остальным событие
// вообще не отправляется, см. maskMoneyForViewer в index.ts).
export type PositiveEventType =
  | 'buy_property'      // Купил недвижимость
  | 'win_auction'        // Выиграл аукцион (обычный или вызов чужой собственности)
  | 'receive_rent'       // Получил аренду от другого игрока
  | 'sale_proceeds'      // Получил деньги, продав недвижимость через "вызов на аукцион"
  | 'pass_go'            // Прошёл СТАРТ, получил $200
  | 'card_income'        // Положительная карта "Шанс"/"Казна" (или карта выхода из тюрьмы)
  | 'mortgage_income'    // Получил деньги за залог недвижимости
  | 'inherit_property'   // Получил недвижимость банкрота как кредитор
  // Случайные события (см. GameEngine.maybeTriggerRandomEvent)
  | 'random_treasure'    // Клад на своей недвижимости
  | 'random_inheritance' // Наследство
  | 'random_lucky_find'; // Полезная находка

export interface PositiveEvent {
  playerId: string;
  type: PositiveEventType;
  timestamp: number;
}

// Тип отрицательного события — вызывает всплывающий плачущий смайл в углу
// экрана ТОЛЬКО у того игрока, с которым это произошло.
export type NegativeEventType =
  | 'sent_to_jail'   // Отправлен в тюрьму
  | 'pay_rent'       // Заплатил аренду другому игроку
  | 'pay_tax'        // Заплатил налог
  | 'card_expense'   // Отрицательная карта "Шанс"/"Казна"
  | 'bankruptcy'     // Обанкротился
  // Случайные события (см. GameEngine.maybeTriggerRandomEvent)
  | 'random_fire'         // Пожар
  | 'random_flood'        // Наводнение
  | 'random_tax_audit'    // Налоговая проверка
  | 'random_robbery'      // Грабёж
  | 'random_earthquake'   // Землетрясение
  | 'random_alien_theft'; // Недвижимость похитили инопланетяне

export interface NegativeEvent {
  playerId: string;
  type: NegativeEventType;
  timestamp: number;
}

// Состояние игры
export interface GameState {
  roomId: string;
  players: Player[];
  currentPlayerIndex: number;
  properties: Map<number, Property>;
  phase: GamePhase;
  dice: [number, number];
  lastDiceRoll: [number, number] | null;
  message: string;
  winner: string | null;
  turnCount: number;
  auction: AuctionState | null;
  settings: RoomSettings;
  positiveEvents: PositiveEvent[];
  negativeEvents: NegativeEvent[];
}

// Фазы игры
export type GamePhase = 
  | 'waiting'           // Ожидание начала
  | 'rolling'           // Бросок кубиков
  | 'landing'           // Игрок на клетке, принимает решение
  | 'buying'            // Покупка недвижимости
  | 'auction'           // Аукцион по недвижимости
  | 'paying_rent'       // Оплата аренды
  | 'building'          // Постройка домов
  | 'trading'           // Торговля
  | 'end_turn'          // Конец хода
  | 'game_over';        // Игра окончена

// Комната
export interface Room {
  id: string;
  players: Player[];
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  gameState: GameState | null;
  settings: RoomSettings;
}

// События от клиента
export interface ClientEvents {
  'create_room': (data: { playerName: string; settings?: Partial<RoomSettings> }, callback: (roomId: string) => void) => void;
  'join_room': (data: { roomId: string; playerName: string }, callback: (success: boolean, error?: string) => void) => void;
  'start_game': (roomId: string) => void;
  'roll_dice': (roomId: string) => void;
  'buy_property': (roomId: string) => void;
  'decline_buy': (roomId: string) => void;
  'end_turn': (roomId: string) => void;
  'pay_fine': (roomId: string) => void;
  'use_jail_card': (roomId: string) => void;
  'build_house': (roomId: string, propertyId: number) => void;
  'place_bid': (roomId: string, amount: number) => void;
  'pass_auction': (roomId: string) => void;
  'mortgage_property': (roomId: string, propertyId: number) => void;
  'unmortgage_property': (roomId: string, propertyId: number) => void;
  'propose_auction': (roomId: string) => void;
  'save_game': (roomId: string) => void;
}

// События от сервера
export interface ServerEvents {
  'room_created': (data: { roomId: string }) => void;
  'player_joined': (data: { playerName: string; players: Player[]; settings?: RoomSettings }) => void;
  'player_left': (data: { playerName: string; players: Player[] }) => void;
  'game_started': (data: { gameState: GameState }) => void;
  'game_state_updated': (data: { gameState: GameState }) => void;
  'game_saved': (data: { savedAt: number }) => void;
  'error': (data: { message: string }) => void;
}