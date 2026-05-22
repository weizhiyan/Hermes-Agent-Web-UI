FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/package.json
RUN npm install --omit=dev && npm --prefix backend install --omit=dev

COPY . .

EXPOSE 3381
CMD ["npm", "start"]

