# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]