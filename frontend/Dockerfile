# Этап 1: Сборка приложения
FROM node:18-alpine as build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Этап 2: Продакшн образ с nginx
FROM nginx:alpine

# Копируем собранные файлы в nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]