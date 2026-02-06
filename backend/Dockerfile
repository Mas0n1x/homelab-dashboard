FROM node:20-alpine

# better-sqlite3 needs build tools on Alpine, speedtest-cli and curl for speedtest
RUN apk add --no-cache python3 make g++ py3-pip curl && pip3 install --break-system-packages speedtest-cli || true

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

# Create data directory for database
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/index.js"]
