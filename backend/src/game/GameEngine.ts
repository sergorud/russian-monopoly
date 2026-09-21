import { GameState, Player, Property, GamePhase, PropertyCell, Cell, RoomSettings, DEFAULT_ROOM_SETTINGS, PositiveEventType, NegativeEventType } from './types';
import { BOARD, CHANCE_CARDS, COMMUNITY_CARDS, PLAYER_COLORS } from './board';

/**
 * Игровой движок - обрабатывает всю логику игры
 */
export class GameEngine {
  private state: GameState;
  private settings: RoomSettings;
  private chanceDeck: number[] = [];
  private communityDeck: number[] = [];
  // Счётчик для timestamp'ов событий салюта/слёз — просто монотонно
  // возрастающее число, уникальности в пределах одной игры достаточно.
  private eventSeq = 0;

  // Вероятность дубля при броске двух кубиков. У честных кубиков она
  // естественным образом равна 1/6 (~16.7%) — по отзывам игроков это
  // ощущается как "слишком часто", поэтому здесь она искусственно занижена.
  private static readonly DOUBLES_PROBABILITY = 0.1;

  constructor(playerNames: string[], settings: RoomSettings = DEFAULT_ROOM_SETTINGS) {
    this.settings = settings;
    this.state = {
      roomId: '',
      players: playerNames.map((name, index) => ({
        id: `player_${index}`,
        name,
        money: settings.startingMoney,
        position: 0,
        color: PLAYER_COLORS[index].color,
        emoji: PLAYER_COLORS[index].emoji,
        isInJail: false,
        jailTurns: 0,
        doublesCount: 0,
        isBankrupt: false,
        properties: [],
        getOutOfJailCards: 0,
      })),
      currentPlayerIndex: 0,
      properties: new Map(),
      phase: 'rolling',
      dice: [1, 1],
      lastDiceRoll: null,
      message: 'Игра началась! Бросайте кубики.',
      winner: null,
      turnCount: 0,
      auction: null,
      settings,
      positiveEvents: [],
      negativeEvents: [],
    };

    // Инициализация всех свойств
    BOARD.forEach(cell => {
      if (cell.type === 'property' || cell.type === 'railroad' || cell.type === 'utility') {
        this.state.properties.set(cell.id, {
          cellId: cell.id,
          ownerId: null,
          houses: 0,
          isMortgaged: false,
        });
      }
    });

    // Перемешиваем колоды карт
    this.chanceDeck = GameEngine.shuffle([...Array(CHANCE_CARDS.length).keys()]);
    this.communityDeck = GameEngine.shuffle([...Array(COMMUNITY_CARDS.length).keys()]);
  }

  /**
   * Восстанавливает движок из ранее сохранённого состояния (например, после
   * перезапуска сервера). Колоды карт при этом перемешиваются заново —
   * порядок карт не сохраняется, это не влияет на баланс игры.
   */
  static fromSavedState(savedState: GameState, settings: RoomSettings): GameEngine {
    const engine = Object.create(GameEngine.prototype) as GameEngine;
    const rawProperties = savedState.properties as unknown;
    const propertiesMap = rawProperties instanceof Map
      ? rawProperties
      : new Map(Object.entries(rawProperties as Record<string, Property>).map(([k, v]) => [Number(k), v]));

    engine.settings = settings;
    engine.state = {
      ...savedState,
      properties: propertiesMap,
      settings,
      // Старые сохранения могли быть сделаны до появления анимаций салюта/слёз
      positiveEvents: savedState.positiveEvents ?? [],
      negativeEvents: savedState.negativeEvents ?? [],
    };
    engine.chanceDeck = GameEngine.shuffle([...Array(CHANCE_CARDS.length).keys()]);
    engine.communityDeck = GameEngine.shuffle([...Array(COMMUNITY_CARDS.length).keys()]);
    return engine;
  }

  /**
   * Перемешивание массива (алгоритм Фишера-Йетса)
   */
  private static shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Получить текущее состояние игры
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Сбрасывает события салюта/слёз — вызывается в начале обработки каждого
   * игрового действия, чтобы клиент видел только события ИМЕННО этого
   * действия (а не накопленную с прошлого раза историю).
   */
  private clearEvents(): void {
    this.state.positiveEvents = [];
    this.state.negativeEvents = [];
  }

  /**
   * Регистрирует положительное событие для игрока — вызывает у него
   * анимацию салюта на игровом поле (см. GameBoard.tsx на клиенте).
   */
  private addPositiveEvent(playerId: string, type: PositiveEventType): void {
    this.state.positiveEvents.push({ playerId, type, timestamp: ++this.eventSeq });
  }

  /**
   * Регистрирует отрицательное событие для игрока — вызывает у него
   * всплывающий плачущий смайл в углу экрана (см. GameRoom.tsx на клиенте).
   */
  private addNegativeEvent(playerId: string, type: NegativeEventType): void {
    this.state.negativeEvents.push({ playerId, type, timestamp: ++this.eventSeq });
  }

  /**
   * Установить ID комнаты
   */
  setRoomId(roomId: string): void {
    this.state.roomId = roomId;
  }

  /**
   * Бросок двух кубиков с искусственно заниженной вероятностью дубля
   * (см. DOUBLES_PROBABILITY). Первый кубик всегда честный 1-6; второй —
   * с вероятностью DOUBLES_PROBABILITY специально совпадает с первым,
   * иначе выбирается равновероятно из оставшихся 5 значений (то есть
   * гарантированно НЕ дубль). Итоговая вероятность дубля получается
   * ровно равной DOUBLES_PROBABILITY, а не 1/6, как было бы у честных
   * кубиков.
   */
  private rollTwoDice(): [number, number] {
    const d1 = Math.floor(Math.random() * 6) + 1;
    let d2: number;
    if (Math.random() < GameEngine.DOUBLES_PROBABILITY) {
      d2 = d1;
    } else {
      do {
        d2 = Math.floor(Math.random() * 6) + 1;
      } while (d2 === d1);
    }
    return [d1, d2];
  }

  /**
   * Получить текущего игрока
   */
  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  /**
   * Бросок кубиков
   */
  rollDice(): { dice: [number, number]; isDouble: boolean } {
    if (this.state.phase !== 'rolling') {
      throw new Error('Сейчас нельзя бросать кубики');
    }

    this.clearEvents();
    const player = this.getCurrentPlayer();
    const [d1, d2] = this.rollTwoDice();
    const isDouble = d1 === d2;

    this.state.dice = [d1, d2];
    this.state.lastDiceRoll = [d1, d2];

    // Если игрок в тюрьме
    if (player.isInJail) {
      return this.handleJailRoll(d1, d2, isDouble);
    }

    // Если выпал дубль
    if (isDouble) {
      player.doublesCount++;
      // 3 дубля подряд - в тюрьму
      if (player.doublesCount >= 3) {
        this.sendToJail(player);
        this.state.message = `${player.name} выбросил 3 дубля подряд и отправляется в тюрьму!`;
        this.state.phase = 'end_turn';
        return { dice: [d1, d2], isDouble };
      }
    } else {
      player.doublesCount = 0;
    }

    // Двигаем игрока
    const oldPosition = player.position;
    player.position = (player.position + d1 + d2) % 40;

    // Проверяем, прошел ли игрок СТАРТ (в том числе если попал ровно на
    // клетку СТАРТ — раньше это ошибочно не засчитывалось из-за лишней
    // проверки "!== 0", хотя одним броском кубиков полный круг по полю
    // сделать невозможно, так что сравнения позиций достаточно самого по себе)
    if (player.position < oldPosition) {
      player.money += 200;
      this.addPositiveEvent(player.id, 'pass_go');
      this.state.message = `${player.name} прошел СТАРТ и получил $200!`;
    } else {
      this.state.message = `${player.name} выбросил ${d1}+${d2}=${d1+d2}`;
    }

    // Обрабатываем клетку, на которую попал игрок
    this.handleLanding(player);

    // После того как обычные действия на клетке полностью завершены (аренда,
    // налог, карта, покупка и т.д.), с небольшим шансом происходит случайное
    // событие (пожар, клад и т.д.) — см. maybeTriggerRandomEvent.
    this.maybeTriggerRandomEvent(player);

    return { dice: [d1, d2], isDouble };
  }

  /**
   * Обработка броска в тюрьме
   */
  private handleJailRoll(d1: number, d2: number, isDouble: boolean): { dice: [number, number]; isDouble: boolean } {
    const player = this.getCurrentPlayer();
    
    if (isDouble) {
      // Дубль - выход из тюрьмы
      player.isInJail = false;
      player.jailTurns = 0;
      player.doublesCount = 1; // Этот дубль считается
      this.state.message = `${player.name} выбросил дубль и выходит из тюрьмы!`;
      
      // Двигаем игрока
      const oldPosition = player.position;
      player.position = (player.position + d1 + d2) % 40;
      
      if (player.position < oldPosition) {
        player.money += 200;
        this.addPositiveEvent(player.id, 'pass_go');
        this.state.message += ` Прошел СТАРТ и получил $200!`;
      }
      
      this.handleLanding(player);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= 3) {
        // 3 хода без дубля - платит штраф $50
        if (player.money >= 50) {
          player.money -= 50;
          player.isInJail = false;
          player.jailTurns = 0;
          this.state.message = `${player.name} платит штраф $50 и выходит из тюрьмы.`;
          
          // Двигаем игрока
          const oldPosition = player.position;
          player.position = (player.position + d1 + d2) % 40;
          
          if (player.position < oldPosition) {
            player.money += 200;
            this.addPositiveEvent(player.id, 'pass_go');
          }
          
          this.handleLanding(player);
        } else {
          // Нет денег - остается в тюрьме
          this.state.message = `${player.name} не может заплатить штраф и остается в тюрьме.`;
          this.state.phase = 'end_turn';
        }
      } else {
        this.state.message = `${player.name} не выбросил дубль и остается в тюрьме (ход ${player.jailTurns}/3).`;
        this.state.phase = 'end_turn';
      }
    }

    // Сработает, только если игрок в итоге вышел из тюрьмы и куда-то сходил
    // (внутри метода есть проверка на !player.isInJail и phase === 'end_turn').
    this.maybeTriggerRandomEvent(player);

    return { dice: [d1, d2], isDouble };
  }

  /**
   * Обработка попадания на клетку
   */
  private handleLanding(player: Player): void {
    const cell = BOARD[player.position];

    switch (cell.type) {
      case 'property':
      case 'railroad':
      case 'utility':
        this.handlePropertyLanding(player, cell as PropertyCell);
        break;
      
      case 'tax':
        const taxAmount = cell.price || 0;
        player.money -= taxAmount;
        this.addNegativeEvent(player.id, 'pay_tax');
        this.state.message += ` Платит налог $${taxAmount}.`;
        this.checkBankruptcy(player, null);
        this.state.phase = 'end_turn';
        break;
      
      case 'chance':
        this.drawCard(player, 'chance');
        break;
      
      case 'community':
        this.drawCard(player, 'community');
        break;
      
      case 'go_to_jail':
        this.sendToJail(player);
        this.state.message += ` Отправляется в тюрьму!`;
        this.state.phase = 'end_turn';
        break;

      case 'jail':
        // Попадание на клетку "Тюрьма" обычным ходом теперь тоже отправляет в тюрьму
        // (правило "просто в гостях" отключено). Правила выхода не меняются.
        this.sendToJail(player);
        this.state.message += ` Попадает на клетку "Тюрьма" и остаётся в ней!`;
        this.state.phase = 'end_turn';
        break;

      case 'go':
      case 'free_parking':
        // Ничего не происходит
        this.state.phase = 'end_turn';
        break;
    }

    this.checkWinner();
  }

  /**
   * Обработка попадания на собственность
   */
  private handlePropertyLanding(player: Player, cell: PropertyCell): void {
    const property = this.state.properties.get(cell.id);
    if (!property) {
      this.state.phase = 'end_turn';
      return;
    }

    if (property.ownerId === null) {
      // Свободная собственность - можно купить, иначе (если включены аукционы) идёт на аукцион
      if (player.money >= cell.price) {
        this.state.phase = 'buying';
        this.state.message += ` Может купить ${cell.name} за $${cell.price}.`;
      } else if (this.settings.auctionEnabled) {
        this.state.message += ` Недостаточно денег для покупки ${cell.name}. Объявляется аукцион!`;
        this.startAuction(cell.id);
      } else {
        this.state.message += ` Недостаточно денег для покупки ${cell.name}.`;
        this.state.phase = 'end_turn';
      }
    } else if (property.ownerId === player.id) {
      // Своя собственность
      this.state.message += ` Это ваша собственность.`;
      this.state.phase = 'end_turn';
    } else {
      // Чужая собственность - платим аренду
      const owner = this.state.players.find(p => p.id === property.ownerId);
      if (!owner || owner.isBankrupt) {
        this.state.phase = 'end_turn';
        return;
      }

      const rent = this.calculateRent(cell, property);
      player.money -= rent;
      owner.money += rent;
      this.addNegativeEvent(player.id, 'pay_rent');
      this.addPositiveEvent(owner.id, 'receive_rent');
      this.state.message += ` Платит аренду $${rent} игроку ${owner.name}.`;
      
      this.checkBankruptcy(player, owner);
      this.state.phase = 'end_turn';
    }
  }

  /**
   * Расчет аренды
   */
  private calculateRent(cell: PropertyCell, property: Property): number {
    if (property.isMortgaged) return 0;

    // Землетрясение временно лишает недвижимость дохода
    if (property.incomeBlockedUntilTurn && this.state.turnCount < property.incomeBlockedUntilTurn) {
      return 0;
    }

    if (cell.type === 'railroad') {
      // Аренда ж/д зависит от количества ж/д у владельца
      const owner = this.state.players.find(p => p.id === property.ownerId);
      if (!owner) return 0;
      
      const railroadsOwned = owner.properties.filter(pid => {
        const prop = this.state.properties.get(pid);
        const c = BOARD[pid] as PropertyCell;
        return prop && c.type === 'railroad' && !prop.isMortgaged;
      }).length;
      
      return cell.rent[railroadsOwned - 1] || 50;
    }

    if (cell.type === 'utility') {
      // Аренда коммунальных услуг зависит от броска кубиков и количества
      const owner = this.state.players.find(p => p.id === property.ownerId);
      if (!owner) return 0;
      
      const utilitiesOwned = owner.properties.filter(pid => {
        const prop = this.state.properties.get(pid);
        const c = BOARD[pid] as PropertyCell;
        return prop && c.type === 'utility' && !prop.isMortgaged;
      }).length;
      
      const diceSum = this.state.dice[0] + this.state.dice[1];
      // Множители удвоены вместе с остальной арендой (было 4 / 10)
      const multiplier = utilitiesOwned === 2 ? 20 : 8;
      return diceSum * multiplier;
    }

    // Обычная недвижимость
    if (property.houses === 0) {
      // Проверка монополии (все клетки цвета у одного игрока)
      const owner = this.state.players.find(p => p.id === property.ownerId);
      if (!owner) return cell.rent[0];
      
      const hasMonopoly = this.checkMonopoly(owner, cell.color!);
      return hasMonopoly ? cell.rent[0] * 2 : cell.rent[0];
    }

    return cell.rent[property.houses] || cell.rent[0];
  }

  /**
   * Проверка монополии (все клетки цвета у одного игрока)
   */
  private checkMonopoly(player: Player, color: string): boolean {
    const colorCells = BOARD.filter(c => c.type === 'property' && c.color === color);
    return colorCells.every(c => {
      const prop = this.state.properties.get(c.id);
      return prop && prop.ownerId === player.id && !prop.isMortgaged;
    });
  }

  /**
   * Покупка собственности
   */
  buyProperty(): void {
    if (this.state.phase !== 'buying') {
      throw new Error('Сейчас нельзя покупать');
    }

    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[player.position] as PropertyCell;
    const property = this.state.properties.get(cell.id);

    if (!property || property.ownerId !== null) {
      throw new Error('Эту собственность нельзя купить');
    }

    if (player.money < cell.price) {
      throw new Error('Недостаточно денег');
    }

    player.money -= cell.price;
    property.ownerId = player.id;
    player.properties.push(cell.id);
    this.addPositiveEvent(player.id, 'buy_property');

    this.state.message = `${player.name} купил ${cell.name} за $${cell.price}!`;
    this.state.phase = 'end_turn';
    this.maybeTriggerRandomEvent(player);
  }

  /**
   * Отказ от покупки — если включены аукционы, недвижимость выставляется на
   * торги между всеми игроками; иначе клетка просто остаётся у банка
   */
  declineBuy(): void {
    if (this.state.phase !== 'buying') {
      throw new Error('Сейчас нельзя отказаться');
    }

    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[player.position] as PropertyCell;

    if (this.settings.auctionEnabled) {
      this.state.message = `${player.name} отказался от покупки ${cell.name}. Объявляется аукцион!`;
      this.startAuction(cell.id);
    } else {
      this.state.message = `${player.name} отказался от покупки ${cell.name}.`;
      this.state.phase = 'end_turn';
    }

    // Сработает только в ветке без аукциона (см. guard внутри метода)
    this.maybeTriggerRandomEvent(player);
  }

  /**
   * ===================== АУКЦИОН =====================
   * Запускается, когда игрок отказался от покупки или не может себе её
   * позволить. Торги идут по кругу, начиная со следующего после текущего
   * игрока (сам текущий игрок тоже может участвовать и ходит последним).
   */
  private startAuction(cellId: number): void {
    const active = this.state.players.filter(p => !p.isBankrupt).map(p => p.id);

    // Меньше 2 участников — аукцион не имеет смысла, собственность остаётся у банка
    if (active.length < 2) {
      this.state.phase = 'end_turn';
      return;
    }

    const currentId = this.getCurrentPlayer().id;
    const idx = active.indexOf(currentId);
    const biddersOrder = idx === -1 ? active : [...active.slice(idx + 1), ...active.slice(0, idx + 1)];

    const cell = BOARD[cellId] as PropertyCell;
    // Стартовая ставка — 80% от цены клетки, шаг повышения — 10% от цены (минимум $1)
    const startingBid = Math.max(1, Math.round(cell.price * 0.8));
    const bidStep = Math.max(1, Math.round(cell.price * 0.1));

    this.state.auction = {
      cellId,
      startingBid,
      bidStep,
      highestBid: 0,
      highestBidderId: null,
      biddersOrder,
      currentBidderIndex: 0,
      originalOwnerId: null,
    };
    this.state.phase = 'auction';

    const firstBidder = this.state.players.find(p => p.id === biddersOrder[0]);
    this.state.message += ` Аукцион по лоту «${cell.name}» (старт $${startingBid}, шаг $${bidStep}): право хода — ${firstBidder?.name}.`;
  }

  /**
   * ===================== ВЫЗОВ НА АУКЦИОН ЧУЖОЙ СОБСТВЕННОСТИ =====================
   * Когда игрок попадает на клетку, принадлежащую другому игроку, он может
   * (после оплаты аренды, до конца своего хода) предложить аукцион по этой
   * собственности. Стартовая цена — 200% от обычной цены клетки, шаг — 20%.
   * В торгах участвуют все игроки, включая текущего владельца (он может
   * "отбиться", сделав наивысшую ставку — тогда деньги никуда не уходят).
   * Если выигрывает кто-то другой — он платит выигранную сумму НЕ банку,
   * а прежнему владельцу, и получает собственность.
   */
  proposeAuction(): void {
    if (!this.settings.auctionEnabled) {
      throw new Error('Аукционы отключены в этой комнате');
    }

    if (this.state.phase !== 'end_turn') {
      throw new Error('Предложить аукцион можно только после завершения обычных действий на клетке');
    }

    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[player.position];

    if (cell.type !== 'property' && cell.type !== 'railroad' && cell.type !== 'utility') {
      throw new Error('На этой клетке нет недвижимости');
    }

    const property = this.state.properties.get(cell.id);
    if (!property || !property.ownerId) {
      throw new Error('Эта клетка никому не принадлежит');
    }

    if (property.ownerId === player.id) {
      throw new Error('Вы не можете предложить аукцион по своей собственности');
    }

    if (property.isMortgaged) {
      throw new Error('Эта собственность в залоге — вызов на аукцион невозможен');
    }

    if (property.houses > 0) {
      throw new Error('На этой собственности есть дома/отель — сначала владелец должен их продать');
    }

    const owner = this.state.players.find(p => p.id === property.ownerId);
    if (!owner || owner.isBankrupt) {
      throw new Error('Владелец не найден');
    }

    const active = this.state.players.filter(p => !p.isBankrupt).map(p => p.id);
    if (active.length < 2) {
      throw new Error('Недостаточно игроков для аукциона');
    }

    const idx = active.indexOf(player.id);
    const biddersOrder = idx === -1 ? active : [...active.slice(idx + 1), ...active.slice(0, idx + 1)];

    const propCell = cell as PropertyCell;
    // Вызов на аукцион: старт — 200% цены клетки, шаг — 20% цены (минимум $1)
    const startingBid = Math.max(1, Math.round(propCell.price * 2));
    const bidStep = Math.max(1, Math.round(propCell.price * 0.2));

    this.state.auction = {
      cellId: cell.id,
      startingBid,
      bidStep,
      highestBid: 0,
      highestBidderId: null,
      biddersOrder,
      currentBidderIndex: 0,
      originalOwnerId: owner.id,
    };
    this.state.phase = 'auction';

    const firstBidder = this.state.players.find(p => p.id === biddersOrder[0]);
    this.state.message = `${player.name} предлагает аукцион по «${propCell.name}» (владелец: ${owner.name})! Старт $${startingBid}, шаг $${bidStep}. Право хода — ${firstBidder?.name}.`;
  }

  /**
   * ID игрока, чья сейчас очередь ставить/пасовать на аукционе (для проверки на сервере)
   */
  getAuctionCurrentBidderId(): string | null {
    const auction = this.state.auction;
    if (!auction) return null;
    return auction.biddersOrder[auction.currentBidderIndex] ?? null;
  }

  /**
   * Минимальная допустимая ставка на аукционе прямо сейчас:
   * 80% от цены клетки, если ставок ещё не было, иначе текущая наивысшая + шаг (10% от цены)
   */
  getMinAuctionBid(): number {
    const auction = this.state.auction;
    if (!auction) return 0;
    return auction.highestBid > 0 ? auction.highestBid + auction.bidStep : auction.startingBid;
  }

  /**
   * Сделать ставку на аукционе
   */
  placeBid(amount: number): void {
    const auction = this.state.auction;
    if (this.state.phase !== 'auction' || !auction) {
      throw new Error('Сейчас нет аукциона');
    }

    this.clearEvents();
    const bidderId = auction.biddersOrder[auction.currentBidderIndex];
    const player = this.state.players.find(p => p.id === bidderId);
    if (!player) {
      throw new Error('Игрок не найден');
    }

    const minBid = this.getMinAuctionBid();
    if (amount < minBid) {
      throw new Error(`Ставка должна быть не меньше $${minBid}`);
    }

    if (player.money < amount) {
      throw new Error('Недостаточно денег для такой ставки');
    }

    auction.highestBid = amount;
    auction.highestBidderId = player.id;
    this.state.message = `${player.name} ставит $${amount} на аукционе.`;

    this.advanceAuctionOrResolve();
  }

  /**
   * Пас на аукционе — игрок выбывает из торгов по этому лоту
   */
  passAuction(): void {
    const auction = this.state.auction;
    if (this.state.phase !== 'auction' || !auction) {
      throw new Error('Сейчас нет аукциона');
    }

    this.clearEvents();
    const bidderId = auction.biddersOrder[auction.currentBidderIndex];
    const player = this.state.players.find(p => p.id === bidderId);

    auction.biddersOrder.splice(auction.currentBidderIndex, 1);
    if (auction.currentBidderIndex >= auction.biddersOrder.length) {
      auction.currentBidderIndex = 0;
    }

    this.state.message = `${player?.name ?? 'Игрок'} пасует на аукционе.`;

    this.resolveAuctionIfNeeded();
  }

  /**
   * После ставки просто передаёт ход следующему в очереди и проверяет,
   * не остался ли всего один участник (тогда торги завершаются сразу).
   */
  private advanceAuctionOrResolve(): void {
    const auction = this.state.auction!;

    if (auction.biddersOrder.length <= 1) {
      this.finishAuction();
      return;
    }

    auction.currentBidderIndex = (auction.currentBidderIndex + 1) % auction.biddersOrder.length;
  }

  /**
   * Проверяет после паса, нужно ли завершать аукцион.
   */
  private resolveAuctionIfNeeded(): void {
    const auction = this.state.auction!;

    if (auction.biddersOrder.length === 0) {
      // Все спасовали, ставок не было (или последний тоже спасовал) — лот остаётся у банка
      this.finishAuction();
      return;
    }

    if (auction.biddersOrder.length === 1) {
      const soleId = auction.biddersOrder[0];
      if (auction.highestBidderId === soleId) {
        // Единственный оставшийся уже лидирует по ставке — он выигрывает немедленно
        this.finishAuction();
        return;
      }
      // Иначе даём единственному оставшемуся последний шанс сделать ставку или тоже спасовать
      auction.currentBidderIndex = 0;
      return;
    }
  }

  /**
   * Завершение аукциона: передаёт собственность победителю (если он есть) и списывает деньги.
   * Для "вызова на аукцион" (originalOwnerId задан) деньги идут прежнему владельцу,
   * а не банку, и если побеждает сам владелец — сделка не происходит вовсе.
   */
  private finishAuction(): void {
    const auction = this.state.auction;
    if (!auction) return;

    const cell = BOARD[auction.cellId] as PropertyCell;
    const property = this.state.properties.get(auction.cellId);
    const isChallenge = auction.originalOwnerId !== null;

    if (isChallenge) {
      const originalOwner = this.state.players.find(p => p.id === auction.originalOwnerId);

      if (!auction.highestBidderId || auction.highestBidderId === auction.originalOwnerId) {
        // Никто не перебил владельца (или он сам победил в защите) — ничего не меняется, деньги не переходят
        this.state.message = `🔨 ${originalOwner?.name ?? 'Владелец'} отстоял «${cell.name}» — собственность остаётся при нём.`;
      } else if (property) {
        const winner = this.state.players.find(p => p.id === auction.highestBidderId);
        if (winner && originalOwner) {
          winner.money -= auction.highestBid;
          originalOwner.money += auction.highestBid;

          originalOwner.properties = originalOwner.properties.filter(id => id !== auction.cellId);
          winner.properties.push(auction.cellId);
          property.ownerId = winner.id;

          this.addPositiveEvent(winner.id, 'win_auction');
          this.addPositiveEvent(originalOwner.id, 'sale_proceeds');

          this.state.message = `🔨 Аукцион завершён: ${winner.name} перекупает «${cell.name}» у ${originalOwner.name} за $${auction.highestBid}!`;
          this.checkBankruptcy(winner, null);
          this.checkBankruptcy(originalOwner, null);
        }
      }
    } else if (auction.highestBidderId && property) {
      const winner = this.state.players.find(p => p.id === auction.highestBidderId);
      if (winner) {
        winner.money -= auction.highestBid;
        property.ownerId = winner.id;
        winner.properties.push(auction.cellId);
        this.addPositiveEvent(winner.id, 'win_auction');
        this.state.message = `🔨 Аукцион завершён: ${winner.name} выигрывает «${cell.name}» за $${auction.highestBid}!`;
        this.checkBankruptcy(winner, null);
      }
    } else {
      this.state.message = `🔨 Аукцион завершён: никто не сделал ставку, «${cell.name}» остаётся у банка.`;
    }

    this.state.auction = null;
    this.state.phase = 'end_turn';
    this.checkWinner();
  }

  /**
   * ===================== ЗАЛОГ НЕДВИЖИМОСТИ =====================
   * Игрок закладывает собственность банку и немедленно получает залоговую
   * стоимость наличными. Заложенная недвижимость не приносит аренду и на
   * ней нельзя строить, пока залог не выкуплен обратно.
   */
  mortgageProperty(propertyId: number): void {
    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[propertyId] as PropertyCell;
    const property = this.state.properties.get(propertyId);

    if (!property || property.ownerId !== player.id) {
      throw new Error('Вы не владеете этой собственностью');
    }

    if (property.isMortgaged) {
      throw new Error('Собственность уже в залоге');
    }

    if (property.houses > 0) {
      throw new Error('Сначала продайте дома/отель на этой улице');
    }

    property.isMortgaged = true;
    player.money += cell.mortgageValue;
    this.addPositiveEvent(player.id, 'mortgage_income');
    this.state.message = `${player.name} заложил ${cell.name} и получил $${cell.mortgageValue}.`;
  }

  /**
   * Выкуп собственности из залога: залоговая стоимость + 10% процентов банку
   */
  unmortgageProperty(propertyId: number): void {
    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[propertyId] as PropertyCell;
    const property = this.state.properties.get(propertyId);

    if (!property || property.ownerId !== player.id) {
      throw new Error('Вы не владеете этой собственностью');
    }

    if (!property.isMortgaged) {
      throw new Error('Эта собственность не в залоге');
    }

    const cost = this.getUnmortgageCost(propertyId);
    if (player.money < cost) {
      throw new Error('Недостаточно денег для выкупа из залога');
    }

    player.money -= cost;
    property.isMortgaged = false;
    this.state.message = `${player.name} выкупил ${cell.name} из залога за $${cost}.`;
  }

  /**
   * Стоимость выкупа из залога: залоговая стоимость + 10% процентов (округление вверх)
   */
  getUnmortgageCost(propertyId: number): number {
    const cell = BOARD[propertyId] as PropertyCell;
    return Math.ceil(cell.mortgageValue * 1.1);
  }

  /**
   * Постройка дома
   */
  buildHouse(propertyId: number): void {
    this.clearEvents();
    const player = this.getCurrentPlayer();
    const cell = BOARD[propertyId] as PropertyCell;
    const property = this.state.properties.get(propertyId);

    if (!property || property.ownerId !== player.id) {
      throw new Error('Вы не владеете этой собственностью');
    }

    if (cell.type !== 'property') {
      throw new Error('На этой клетке нельзя строить');
    }

    if (property.isMortgaged) {
      throw new Error('Собственность в залоге');
    }

    if (!this.checkMonopoly(player, cell.color!)) {
      throw new Error('Нужно владеть всеми клетками этого цвета');
    }

    if (property.houses >= 5) {
      throw new Error('Максимум построек достигнут');
    }

    // Правило равномерного строительства
    const colorCells = BOARD.filter(c => c.type === 'property' && c.color === cell.color);
    const minHouses = Math.min(...colorCells.map(c => {
      const p = this.state.properties.get(c.id);
      return p ? p.houses : 0;
    }));

    if (property.houses > minHouses) {
      throw new Error('Сначала нужно строить равномерно');
    }

    if (player.money < cell.houseCost) {
      throw new Error('Недостаточно денег для постройки');
    }

    player.money -= cell.houseCost;
    property.houses++;

    const houseName = property.houses === 5 ? 'отель' : `${property.houses} дом(а)`;
    this.state.message = `${player.name} построил ${houseName} на ${cell.name}!`;
  }

  /**
   * Оплата штрафа за выход из тюрьмы
   */
  payFine(): void {
    this.clearEvents();
    const player = this.getCurrentPlayer();
    
    if (!player.isInJail) {
      throw new Error('Вы не в тюрьме');
    }

    if (player.money < 50) {
      throw new Error('Недостаточно денег для оплаты штрафа');
    }

    player.money -= 50;
    player.isInJail = false;
    player.jailTurns = 0;
    this.state.message = `${player.name} заплатил $50 и вышел из тюрьмы.`;
  }

  /**
   * Использование карты выхода из тюрьмы
   */
  useJailCard(): void {
    this.clearEvents();
    const player = this.getCurrentPlayer();
    
    if (!player.isInJail) {
      throw new Error('Вы не в тюрьме');
    }

    if (player.getOutOfJailCards <= 0) {
      throw new Error('У вас нет карт выхода из тюрьмы');
    }

    player.getOutOfJailCards--;
    player.isInJail = false;
    player.jailTurns = 0;
    this.state.message = `${player.name} использовал карту выхода из тюрьмы.`;
  }

  /**
   * Отправка игрока в тюрьму
   */
  private sendToJail(player: Player): void {
    player.position = 10;
    player.isInJail = true;
    player.jailTurns = 0;
    player.doublesCount = 0;
    this.state.phase = 'end_turn';
    this.addNegativeEvent(player.id, 'sent_to_jail');
  }

  /**
   * Взятие карты из колоды
   */
  private drawCard(player: Player, type: 'chance' | 'community'): void {
    const deck = type === 'chance' ? this.chanceDeck : this.communityDeck;
    const cards = type === 'chance' ? CHANCE_CARDS : COMMUNITY_CARDS;

    if (deck.length === 0) {
      // Перемешиваем колоду заново
      if (type === 'chance') {
        this.chanceDeck = GameEngine.shuffle([...Array(CHANCE_CARDS.length).keys()]);
      } else {
        this.communityDeck = GameEngine.shuffle([...Array(COMMUNITY_CARDS.length).keys()]);
      }
    }

    const cardIndex = deck.pop()!;
    const card = cards[cardIndex];

    this.state.message += ` Карта: "${card.text}"`;

    this.executeCardAction(player, card);
  }

  /**
   * Выполнение действия карты
   */
  private executeCardAction(player: Player, card: any): void {
    switch (card.action) {
      case 'move_to':
        const oldPos = player.position;
        player.position = card.value;
        if (player.position < oldPos) {
          player.money += 200;
          this.addPositiveEvent(player.id, 'pass_go');
        }
        this.handleLanding(player);
        return;
      
      case 'move_back':
        player.position = (player.position - card.value + 40) % 40;
        this.handleLanding(player);
        return;
      
      case 'receive_money':
        player.money += card.value;
        this.addPositiveEvent(player.id, 'card_income');
        this.state.phase = 'end_turn';
        break;
      
      case 'pay_money':
        player.money -= card.value;
        this.addNegativeEvent(player.id, 'card_expense');
        this.checkBankruptcy(player, null);
        this.state.phase = 'end_turn';
        break;
      
      case 'go_to_jail':
        this.sendToJail(player);
        break;
      
      case 'jail_card':
        player.getOutOfJailCards++;
        this.addPositiveEvent(player.id, 'card_income');
        this.state.phase = 'end_turn';
        break;
      
      case 'pay_each':
        this.state.players.forEach(p => {
          if (p.id !== player.id && !p.isBankrupt) {
            p.money += card.value;
            this.addPositiveEvent(p.id, 'card_income');
          }
        });
        player.money -= card.value * (this.state.players.filter(p => !p.isBankrupt).length - 1);
        this.addNegativeEvent(player.id, 'card_expense');
        this.checkBankruptcy(player, null);
        this.state.phase = 'end_turn';
        break;
      
      case 'receive_from_each': {
        const payerCount = this.state.players.filter(p => p.id !== player.id && !p.isBankrupt).length;
        this.state.players.forEach(p => {
          if (p.id !== player.id && !p.isBankrupt) {
            p.money -= card.value;
            this.addNegativeEvent(p.id, 'card_expense');
            this.checkBankruptcy(p, player);
          }
        });
        player.money += card.value * payerCount;
        this.addPositiveEvent(player.id, 'card_income');
        this.state.phase = 'end_turn';
        break;
      }
    }
  }

  /**
   * Проверка на банкротство
   */
  private checkBankruptcy(player: Player, creditor: Player | null): void {
    if (player.money < 0) {
      // Пытаемся продать имущество
      const canPay = this.trySellAssets(player);
      
      if (player.money < 0) {
        player.isBankrupt = true;
        this.addNegativeEvent(player.id, 'bankruptcy');
        this.state.message += ` ${player.name} обанкротился!`;
        
        // Передаем имущество кредитору или в банк
        if (creditor) {
          player.properties.forEach(propId => {
            const prop = this.state.properties.get(propId);
            if (prop) {
              prop.ownerId = creditor.id;
              creditor.properties.push(propId);
            }
          });
          if (player.properties.length > 0) {
            this.addPositiveEvent(creditor.id, 'inherit_property');
          }
        } else {
          // В банк - освобождаем собственность
          player.properties.forEach(propId => {
            const prop = this.state.properties.get(propId);
            if (prop) {
              prop.ownerId = null;
              prop.houses = 0;
              prop.isMortgaged = false;
            }
          });
        }
        
        player.properties = [];
      }
    }
  }

  /**
   * Попытка продать имущество для покрытия долга
   */
  private trySellAssets(player: Player): boolean {
    // Упрощенная версия - продаем дома и закладываем собственность
    for (const propId of player.properties) {
      const prop = this.state.properties.get(propId);
      const cell = BOARD[propId] as PropertyCell;
      
      if (!prop) continue;

      // Продаем дома
      while (prop.houses > 0 && player.money < 0) {
        prop.houses--;
        player.money += cell.houseCost / 2;
      }

      // Закладываем собственность
      if (!prop.isMortgaged && player.money < 0) {
        prop.isMortgaged = true;
        player.money += cell.mortgageValue;
      }

      if (player.money >= 0) return true;
    }

    return player.money >= 0;
  }

  /**
   * ===================== СЛУЧАЙНЫЕ СОБЫТИЯ =====================
   * После того как игрок доиграл свой ход до конца (бросил кубики, сходил,
   * заплатил аренду/налог, купил недвижимость и т.п. — то есть фаза снова
   * стала 'end_turn'), с небольшим шансом с ним происходит одно случайное
   * событие: пожар, наводнение, налоговая проверка, грабёж, землетрясение,
   * клад, наследство, полезная находка или инопланетяне.
   */
  private static readonly RANDOM_EVENT_CHANCE = 0.25;

  private maybeTriggerRandomEvent(player: Player): void {
    // Событие уместно только сразу после того, как обычные действия на
    // клетке полностью завершились — не во время нахождения в тюрьме
    // (только что отправлен туда), не во время ожидания решения о покупке
    // или аукциона, и не после завершения игры.
    if (this.state.phase !== 'end_turn') return;
    if (player.isInJail || player.isBankrupt || this.state.winner) return;
    if (Math.random() > GameEngine.RANDOM_EVENT_CHANCE) return;

    type RandomEventKey =
      | 'fire' | 'flood' | 'tax_audit' | 'robbery' | 'earthquake'
      | 'treasure' | 'inheritance' | 'lucky_find' | 'aliens';

    // Недвижимость игрока, которой можно "рискнуть" (в залоге — уже итак
    // ничего не приносит и не может быть заложена повторно).
    const ownedProps = player.properties
      .map(id => this.state.properties.get(id))
      .filter((p): p is Property => !!p && !p.isMortgaged);

    const currentCell = BOARD[player.position];
    const isPropertyCell = currentCell.type === 'property' || currentCell.type === 'railroad' || currentCell.type === 'utility';
    const currentProperty = isPropertyCell ? this.state.properties.get(currentCell.id) : undefined;
    const standsOnOwnProperty = !!currentProperty && currentProperty.ownerId === player.id;

    // Цели для "инопланетян": недвижимость (улицы, не ж/д и не коммунальные
    // услуги) любого игрока без домов и отелей.
    const alienTargets = BOARD.filter(c => {
      if (c.type !== 'property') return false;
      const prop = this.state.properties.get(c.id);
      return !!prop && prop.ownerId !== null && prop.houses === 0;
    }) as PropertyCell[];

    const candidates: RandomEventKey[] = [];
    if (ownedProps.length > 0) {
      candidates.push('fire', 'flood', 'tax_audit', 'robbery', 'earthquake', 'inheritance');
    }
    if (standsOnOwnProperty) {
      candidates.push('treasure');
    }
    if (isPropertyCell) {
      candidates.push('lucky_find');
    }
    if (alienTargets.length > 0) {
      candidates.push('aliens');
    }

    if (candidates.length === 0) return;

    const event = candidates[Math.floor(Math.random() * candidates.length)];
    this.applyRandomEvent(player, event, ownedProps, currentCell as PropertyCell, alienTargets);
  }

  private applyRandomEvent(
    player: Player,
    event: 'fire' | 'flood' | 'tax_audit' | 'robbery' | 'earthquake' | 'treasure' | 'inheritance' | 'lucky_find' | 'aliens',
    ownedProps: Property[],
    currentCell: PropertyCell,
    alienTargets: PropertyCell[]
  ): void {
    const randomOwned = (): { cell: PropertyCell; prop: Property } => {
      const prop = ownedProps[Math.floor(Math.random() * ownedProps.length)];
      return { cell: BOARD[prop.cellId] as PropertyCell, prop };
    };

    switch (event) {
      case 'fire': {
        const { cell } = randomOwned();
        const amount = Math.round(cell.price * 0.5);
        player.money -= amount;
        this.addNegativeEvent(player.id, 'random_fire');
        this.state.message += ` 🔥 Случайное событие: произошел пожар на "${cell.name}", заплати $${amount} за ремонт.`;
        this.checkBankruptcy(player, null);
        break;
      }

      case 'flood': {
        const { cell } = randomOwned();
        const amount = Math.round(cell.price * 0.25);
        player.money -= amount;
        this.addNegativeEvent(player.id, 'random_flood');
        this.state.message += ` 🌊 Случайное событие: произошло наводнение на "${cell.name}", заплати $${amount} за ремонт.`;
        this.checkBankruptcy(player, null);
        break;
      }

      case 'tax_audit': {
        const { cell } = randomOwned();
        const amount = Math.round(cell.price / 3);
        player.money -= amount;
        this.addNegativeEvent(player.id, 'random_tax_audit');
        this.state.message += ` 🕵️ Случайное событие: налоговая проверка на "${cell.name}" выявила нарушения, заплати $${amount} штрафов.`;
        this.checkBankruptcy(player, null);
        break;
      }

      case 'robbery': {
        const { cell } = randomOwned();
        const percent = 0.25 + Math.random() * 0.25; // 25%–50%
        const amount = Math.round(cell.price * percent);
        player.money -= amount;
        this.addNegativeEvent(player.id, 'random_robbery');
        this.state.message += ` 🥷 Случайное событие: тебя ограбили, заплати $${amount}.`;
        this.checkBankruptcy(player, null);
        break;
      }

      case 'earthquake': {
        const { cell, prop } = randomOwned();
        const amount = cell.price;
        player.money -= amount;
        // Недвижимость не приносит доход в течение следующих 3 ходов
        prop.incomeBlockedUntilTurn = this.state.turnCount + 3;
        this.addNegativeEvent(player.id, 'random_earthquake');
        this.state.message += ` 🌍 Случайное событие: "${cell.name}" разрушена землетрясением, заплати $${amount}. Три хода не будет приносить доход.`;
        this.checkBankruptcy(player, null);
        break;
      }

      case 'treasure': {
        const percent = 0.1 + Math.random() * 0.4; // 10%–50%
        const amount = Math.round(currentCell.price * percent);
        player.money += amount;
        this.addPositiveEvent(player.id, 'random_treasure');
        this.state.message += ` 💰 Случайное событие: ты нашел клад, получи $${amount}.`;
        break;
      }

      case 'inheritance': {
        const richest = ownedProps
          .map(p => BOARD[p.cellId] as PropertyCell)
          .reduce((max, c) => (c.price > max.price ? c : max));
        const amount = Math.round(richest.price * 0.4);
        player.money += amount;
        this.addPositiveEvent(player.id, 'random_inheritance');
        this.state.message += ` 🎁 Случайное событие: тебе пришло наследство, получи $${amount}.`;
        break;
      }

      case 'lucky_find': {
        const amount = Math.round(currentCell.price * 0.15);
        player.money += amount;
        this.addPositiveEvent(player.id, 'random_lucky_find');
        this.state.message += ` 🔍 Случайное событие: полезная находка! Ты нашел $${amount}.`;
        break;
      }

      case 'aliens': {
        const targetCell = alienTargets[Math.floor(Math.random() * alienTargets.length)];
        const targetProp = this.state.properties.get(targetCell.id)!;
        const owner = this.state.players.find(p => p.id === targetProp.ownerId);

        targetProp.ownerId = null;
        targetProp.houses = 0;
        targetProp.isMortgaged = false;
        if (owner) {
          owner.properties = owner.properties.filter(id => id !== targetCell.id);
          this.addNegativeEvent(owner.id, 'random_alien_theft');
        }
        this.state.message += ` 👽 Случайное событие: "${targetCell.name}" похитили инопланетяне${owner ? ` у ${owner.name}` : ''}!`;
        break;
      }
    }

    this.checkWinner();
  }

  /**
   * Проверка победителя
   */
  private checkWinner(): void {
    const activePlayers = this.state.players.filter(p => !p.isBankrupt);
    
    if (activePlayers.length === 1) {
      this.state.winner = activePlayers[0].name;
      this.state.phase = 'game_over';
      this.state.message = `🎉 ${activePlayers[0].name} победил!`;
    }
  }

  /**
   * Завершение хода
   */
  endTurn(): void {
    if (this.state.phase !== 'end_turn') {
      throw new Error('Сейчас нельзя завершить ход');
    }

    const currentPlayer = this.getCurrentPlayer();
    const isDouble = this.state.lastDiceRoll && this.state.lastDiceRoll[0] === this.state.lastDiceRoll[1];

    // Если выпал дубль и игрок не в тюрьме - ходит еще раз
    if (isDouble && !currentPlayer.isInJail && !currentPlayer.isBankrupt) {
      this.state.phase = 'rolling';
      this.state.message = `${currentPlayer.name} выбросил дубль и ходит еще раз!`;
      return;
    }

    // Переход к следующему игроку
    do {
      this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    } while (this.state.players[this.state.currentPlayerIndex].isBankrupt);

    this.state.phase = 'rolling';
    this.state.turnCount++;
    
    const nextPlayer = this.getCurrentPlayer();
    this.state.message = `Ход игрока ${nextPlayer.name}.`;
  }

  /**
   * Можно ли бросить кубики
   */
  canRollDice(): boolean {
    return this.state.phase === 'rolling';
  }

  /**
   * Можно ли завершить ход
   */
  canEndTurn(): boolean {
    return this.state.phase === 'end_turn';
  }
}