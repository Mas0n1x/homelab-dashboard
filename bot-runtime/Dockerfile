# Homelab Dashboard — Bot-Runtime
# Copyright (c) 2024-2026 DEV Mas0n1x. MIT License.
FROM node:20-alpine

# better-sqlite3 braucht Build-Tools auf Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3200
ENV BOT_DB_PATH=/app/data/bots.db

EXPOSE 3200

CMD ["node", "src/index.js"]
