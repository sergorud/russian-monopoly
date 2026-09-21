import { Cell, PropertyCell } from './types';

/**
 * Классическое поле Монополии - 40 клеток
 * Нумерация от 0 до 39, начиная со СТАРТа
 */
export const BOARD: Cell[] = [
  // 0 - СТАРТ
  { id: 0, name: 'СТАРТ', type: 'go' },
  
  // 1 - Коричневые
  { id: 1, name: 'Житная ул.', type: 'property', color: 'brown', price: 60, rent: [4, 40, 120, 360, 640, 1000], houseCost: 50, mortgageValue: 30 } as PropertyCell,
  { id: 2, name: 'Общественная казна', type: 'community' },
  { id: 3, name: 'Нагатинская ул.', type: 'property', color: 'brown', price: 60, rent: [8, 80, 240, 720, 1280, 1800], houseCost: 50, mortgageValue: 30 } as PropertyCell,
  { id: 4, name: 'Подоходный налог', type: 'tax', price: 200 },
  { id: 5, name: 'Рижская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [50, 100, 200, 400], houseCost: 0, mortgageValue: 100 } as PropertyCell,
  
  // 6 - Голубые
  { id: 6, name: 'Волховская ул.', type: 'property', color: 'lightblue', price: 100, rent: [12, 120, 360, 1080, 1600, 2200], houseCost: 50, mortgageValue: 50 } as PropertyCell,
  { id: 7, name: 'Шанс', type: 'chance' },
  { id: 8, name: 'Первая Парковая ул.', type: 'property', color: 'lightblue', price: 100, rent: [12, 120, 360, 1080, 1600, 2200], houseCost: 50, mortgageValue: 50 } as PropertyCell,
  { id: 9, name: 'Второй Парковой ул.', type: 'property', color: 'lightblue', price: 120, rent: [16, 160, 400, 1200, 1800, 2400], houseCost: 50, mortgageValue: 60 } as PropertyCell,
  { id: 10, name: 'Тюрьма', type: 'jail' },
  
  // 11 - Розовые
  { id: 11, name: 'Ул. Полянка', type: 'property', color: 'pink', price: 140, rent: [20, 200, 600, 1800, 2500, 3000], houseCost: 100, mortgageValue: 70 } as PropertyCell,
  { id: 12, name: 'Электростанция', type: 'utility', color: 'utility', price: 150, rent: [8, 20], houseCost: 0, mortgageValue: 75 } as PropertyCell,
  { id: 13, name: 'Ул. Сретенка', type: 'property', color: 'pink', price: 140, rent: [20, 200, 600, 1800, 2500, 3000], houseCost: 100, mortgageValue: 70 } as PropertyCell,
  { id: 14, name: 'Ростовская наб.', type: 'property', color: 'pink', price: 160, rent: [24, 240, 720, 2000, 2800, 3600], houseCost: 100, mortgageValue: 80 } as PropertyCell,
  { id: 15, name: 'Курская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [50, 100, 200, 400], houseCost: 0, mortgageValue: 100 } as PropertyCell,
  
  // 16 - Оранжевые
  { id: 16, name: 'Ул. Смолянская', type: 'property', color: 'orange', price: 180, rent: [28, 280, 800, 2200, 3000, 3800], houseCost: 100, mortgageValue: 90 } as PropertyCell,
  { id: 17, name: 'Общественная казна', type: 'community' },
  { id: 18, name: 'Ул. Ржевская', type: 'property', color: 'orange', price: 180, rent: [28, 280, 800, 2200, 3000, 3800], houseCost: 100, mortgageValue: 90 } as PropertyCell,
  { id: 19, name: 'Ул. Вавилова', type: 'property', color: 'orange', price: 200, rent: [32, 320, 880, 2400, 3200, 4000], houseCost: 100, mortgageValue: 100 } as PropertyCell,
  { id: 20, name: 'Бесплатная парковка', type: 'free_parking' },
  
  // 21 - Красные
  { id: 21, name: 'Ул. Тверская', type: 'property', color: 'red', price: 220, rent: [36, 360, 1000, 2800, 3500, 4200], houseCost: 150, mortgageValue: 110 } as PropertyCell,
  { id: 22, name: 'Шанс', type: 'chance' },
  { id: 23, name: 'Ул. Пушкинская', type: 'property', color: 'red', price: 220, rent: [36, 360, 1000, 2800, 3500, 4200], houseCost: 150, mortgageValue: 110 } as PropertyCell,
  { id: 24, name: 'Ул. Площадь Победы', type: 'property', color: 'red', price: 240, rent: [40, 400, 1200, 3000, 3700, 4400], houseCost: 150, mortgageValue: 120 } as PropertyCell,
  { id: 25, name: 'Казанская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [50, 100, 200, 400], houseCost: 0, mortgageValue: 100 } as PropertyCell,
  
  // 26 - Желтые
  { id: 26, name: 'Ул. Нижняя Масловка', type: 'property', color: 'yellow', price: 260, rent: [44, 440, 1320, 3200, 3900, 4600], houseCost: 150, mortgageValue: 130 } as PropertyCell,
  { id: 27, name: 'Ул. Верхняя Масловка', type: 'property', color: 'yellow', price: 260, rent: [44, 440, 1320, 3200, 3900, 4600], houseCost: 150, mortgageValue: 130 } as PropertyCell,
  { id: 28, name: 'Водоканал', type: 'utility', color: 'utility', price: 150, rent: [8, 20], houseCost: 0, mortgageValue: 75 } as PropertyCell,
  { id: 29, name: 'Ул. Крестовская', type: 'property', color: 'yellow', price: 280, rent: [48, 480, 1440, 3400, 4100, 4800], houseCost: 150, mortgageValue: 140 } as PropertyCell,
  { id: 30, name: 'Идите в тюрьму', type: 'go_to_jail' },
  
  // 31 - Зеленые
  { id: 31, name: 'Ул. Петровка', type: 'property', color: 'green', price: 300, rent: [52, 520, 1560, 3600, 4400, 5100], houseCost: 200, mortgageValue: 150 } as PropertyCell,
  { id: 32, name: 'Ул. Мясницкая', type: 'property', color: 'green', price: 300, rent: [52, 520, 1560, 3600, 4400, 5100], houseCost: 200, mortgageValue: 150 } as PropertyCell,
  { id: 33, name: 'Общественная казна', type: 'community' },
  { id: 34, name: 'Ул. Покровская', type: 'property', color: 'green', price: 320, rent: [56, 600, 1800, 4000, 4800, 5600], houseCost: 200, mortgageValue: 160 } as PropertyCell,
  { id: 35, name: 'Ленинградская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [50, 100, 200, 400], houseCost: 0, mortgageValue: 100 } as PropertyCell,
  
  // 36 - Шанс
  { id: 36, name: 'Шанс', type: 'chance' },
  
  // 37 - Темно-синие
  { id: 37, name: 'Ул. Арбат', type: 'property', color: 'darkblue', price: 350, rent: [70, 700, 2000, 4400, 5200, 6000], houseCost: 200, mortgageValue: 175 } as PropertyCell,
  { id: 38, name: 'Сверхналог', type: 'tax', price: 100 },
  { id: 39, name: 'Ул. Малая Бронная', type: 'property', color: 'darkblue', price: 400, rent: [100, 800, 2400, 5600, 6800, 8000], houseCost: 200, mortgageValue: 200 } as PropertyCell,
];

/**
 * Карты "Шанс"
 */
export const CHANCE_CARDS = [
  { text: 'Отправляйтесь на СТАРТ. Получите $200.', action: 'move_to', value: 0 },
  { text: 'Отправляйтесь на Ул. Тверская. Если проходите СТАРТ, получите $200.', action: 'move_to', value: 21 },
  { text: 'Отправляйтесь на Рижскую ж/д.', action: 'move_to', value: 5 },
  { text: 'Отправляйтесь в тюрьму. Не проходите СТАРТ.', action: 'go_to_jail' },
  { text: 'Банк платит вам дивиденды $50.', action: 'receive_money', value: 50 },
  { text: 'Вы получили карту "Выход из тюрьмы".', action: 'jail_card' },
  { text: 'Отправляетесь на 3 клетки назад.', action: 'move_back', value: 3 },
  { text: 'Штраф $15 за ремонт.', action: 'pay_money', value: 15 },
  { text: 'Отправляйтесь на Курская ж/д.', action: 'move_to', value: 15 },
  { text: 'Вы избраны председателем совета. Заплатите каждому игроку $50.', action: 'pay_each', value: 50 },
];

/**
 * Карты "Общественная казна"
 */
export const COMMUNITY_CARDS = [
  { text: 'Отправляйтесь на СТАРТ. Получите $200.', action: 'move_to', value: 0 },
  { text: 'Банк ошибся в вашу пользу. Получите $200.', action: 'receive_money', value: 200 },
  { text: 'Оплата услуг врача. Заплатите $50.', action: 'pay_money', value: 50 },
  { text: 'Продажа акций. Получите $50.', action: 'receive_money', value: 50 },
  { text: 'Вы получили карту "Выход из тюрьму".', action: 'jail_card' },
  { text: 'Отправляйтесь в тюрьму.', action: 'go_to_jail' },
  { text: 'Наследство. Получите $100.', action: 'receive_money', value: 100 },
  { text: 'Возврат подоходного налога. Получите $20.', action: 'receive_money', value: 20 },
  { text: 'С день рождения! Каждый игрок платит вам $10.', action: 'receive_from_each', value: 10 },
  { text: 'Страховая премия. Получите $100.', action: 'receive_money', value: 100 },
  { text: 'Оплата услуг доктора. Заплатите $50.', action: 'pay_money', value: 50 },
  { text: 'Штраф за хулиганство. Заплатите $10.', action: 'pay_money', value: 10 },
];

/**
 * Цвета игроков
 */
export const PLAYER_COLORS = [
  { color: '#e74c3c', emoji: '🔴', name: 'Красный' },
  { color: '#3498db', emoji: '🔵', name: 'Синий' },
  { color: '#2ecc71', emoji: '🟢', name: 'Зеленый' },
  { color: '#f39c12', emoji: '🟡', name: 'Желтый' },
];

/**
 * Получить цвет клетки для CSS
 */
export function getColorHex(color: string | null): string {
  const colors: Record<string, string> = {
    'brown': '#8B4513',
    'lightblue': '#87CEEB',
    'pink': '#FF1493',
    'orange': '#FF8C00',
    'red': '#DC143C',
    'yellow': '#FFD700',
    'green': '#228B22',
    'darkblue': '#00008B',
    'railroad': '#333',
    'utility': '#666',
  };
  return colors[color || ''] || '#ccc';
}