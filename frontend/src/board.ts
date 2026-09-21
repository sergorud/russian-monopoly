import { Cell, PropertyColor } from './types';

/**
 * Тип для клетки недвижимости (экспортируем для компонентов)
 */
export interface PropertyCell extends Cell {
  type: 'property' | 'railroad' | 'utility';
  color: PropertyColor;
  price: number;
  rent: number[];
  houseCost: number;
  mortgageValue: number;
}

/**
 * Данные игрового поля
 */
export const BOARD: Cell[] = [
  { id: 0, name: 'СТАРТ', type: 'go' },
  { id: 1, name: 'Житная ул.', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { id: 2, name: 'Общественная казна', type: 'community' },
  { id: 3, name: 'Нагатинская ул.', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },
  { id: 4, name: 'Подоходный налог', type: 'tax', price: 200 },
  { id: 5, name: 'Рижская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], houseCost: 0, mortgageValue: 100 },
  { id: 6, name: 'Волховская ул.', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 7, name: 'Шанс', type: 'chance' },
  { id: 8, name: 'Первая Парковая ул.', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 9, name: 'Второй Парковой ул.', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { id: 10, name: 'Тюрьма', type: 'jail' },
  { id: 11, name: 'Ул. Полянка', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 12, name: 'Электростанция', type: 'utility', color: 'utility', price: 150, rent: [4, 10], houseCost: 0, mortgageValue: 75 },
  { id: 13, name: 'Ул. Сретенка', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 14, name: 'Ростовская наб.', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { id: 15, name: 'Курская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], houseCost: 0, mortgageValue: 100 },
  { id: 16, name: 'Ул. Смолянская', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 17, name: 'Общественная казна', type: 'community' },
  { id: 18, name: 'Ул. Ржевская', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 19, name: 'Ул. Вавилова', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },
  { id: 20, name: 'Бесплатная парковка', type: 'free_parking' },
  { id: 21, name: 'Ул. Тверская', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 22, name: 'Шанс', type: 'chance' },
  { id: 23, name: 'Ул. Пушкинская', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 24, name: 'Ул. Площадь Победы', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { id: 25, name: 'Казанская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], houseCost: 0, mortgageValue: 100 },
  { id: 26, name: 'Ул. Нижняя Масловка', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 27, name: 'Ул. Верхняя Масловка', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 28, name: 'Водоканал', type: 'utility', color: 'utility', price: 150, rent: [4, 10], houseCost: 0, mortgageValue: 75 },
  { id: 29, name: 'Ул. Крестовская', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  { id: 30, name: 'Идите в тюрьму', type: 'go_to_jail' },
  { id: 31, name: 'Ул. Петровка', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 32, name: 'Ул. Мясницкая', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 33, name: 'Общественная казна', type: 'community' },
  { id: 34, name: 'Ул. Покровская', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },
  { id: 35, name: 'Ленинградская ж/д', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], houseCost: 0, mortgageValue: 100 },
  { id: 36, name: 'Шанс', type: 'chance' },
  { id: 37, name: 'Ул. Арбат', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { id: 38, name: 'Сверхналог', type: 'tax', price: 100 },
  { id: 39, name: 'Ул. Малая Бронная', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
];

export function getColorHex(color: PropertyColor): string {
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