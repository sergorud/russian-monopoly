// Экспортируем все типы из бэкенда
// В реальном проекте лучше использовать общую папку shared

export type CellType = 
  | 'property' | 'railroad' | 'utility' | 'tax' 
  | 'chance' | 'community' | 'go' | 'jail' 
  | 'go_to_jail' | 'free_parking';

export type PropertyColor = 
  | 'brown' | 'lightblue' | 'pink' | 'orange' 
  | 'red' | 'yellow' | 'green' | 'darkblue'
  | 'railroad' | 'utility' | null;

export interface Cell {
  id: number;
  name: string;
  type: CellType;
  color?: PropertyColor;
  price?: number;
  rent?: number[];
  houseCost?: number;
  mortgageValue?: number;
}

export interface Property {
  cellId: number;
  ownerId: string | null;
  houses: number;
  isMortgaged: boolean;
  incomeBlockedUntilTurn?: number;
}

export interface Player {
  id: string;
  name: string;
  money: number | null; // null — чужой баланс, скрыт сервером (виден только свой)
  position: number;
  color: string;
  emoji: string;
  isInJail: boolean;
  jailTurns: number;
  doublesCount: number;
  isBankrupt: boolean;
  properties: number[];
  getOutOfJailCards: number;
}

export type GamePhase = 
  | 'waiting' | 'rolling' | 'landing' | 'buying' | 'auction'
  | 'paying_rent' | 'building' | 'trading' 
  | 'end_turn' | 'game_over';

export interface AuctionState {
  cellId: number;
  startingBid: number; // 80% от цены клетки (обычный) или 200% (вызов на аукцион чужой собственности)
  bidStep: number; // 10% от цены клетки (обычный) или 20% (вызов)
  highestBid: number;
  highestBidderId: string | null;
  biddersOrder: string[];
  currentBidderIndex: number;
  originalOwnerId: string | null; // null — обычный аукцион (лот у банка); иначе — ID владельца при "вызове на аукцион"
}

export interface RoomSettings {
  startingMoney: number;
  auctionEnabled: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  startingMoney: 1500,
  auctionEnabled: true,
};

// Тип положительного события — вызывает анимацию салюта на клиенте
// у ТОГО игрока, с которым это произошло (остальные ничего не видят —
// сервер и так присылает только "свои" события, см. backend/src/index.ts).
export type PositiveEventType =
  | 'buy_property'      // Купил недвижимость
  | 'win_auction'        // Выиграл аукцион (обычный или вызов чужой собственности)
  | 'receive_rent'       // Получил аренду от другого игрока
  | 'sale_proceeds'      // Получил деньги, продав недвижимость через "вызов на аукцион"
  | 'pass_go'            // Прошёл СТАРТ, получил $200
  | 'card_income'        // Положительная карта "Шанс"/"Казна"
  | 'mortgage_income'    // Получил деньги за залог недвижимости
  | 'inherit_property'   // Получил недвижимость банкрота как кредитор
  | 'random_treasure'    // Клад на своей недвижимости
  | 'random_inheritance' // Наследство
  | 'random_lucky_find'; // Полезная находка

export interface PositiveEvent {
  playerId: string;
  type: PositiveEventType;
  timestamp: number;
}

// Тип отрицательного события — вызывает всплывающий плачущий смайл в углу
// экрана у ТОГО игрока, с которым это произошло (сервер и так присылает
// только "свои" события, см. backend/src/index.ts).
export type NegativeEventType =
  | 'sent_to_jail'   // Отправлен в тюрьму
  | 'pay_rent'       // Заплатил аренду другому игроку
  | 'pay_tax'        // Заплатил налог
  | 'card_expense'   // Отрицательная карта "Шанс"/"Казна"
  | 'bankruptcy'     // Обанкротился
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

export interface GameState {
  roomId: string;
  players: Player[];
  currentPlayerIndex: number;
  properties: Record<number, Property>;
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