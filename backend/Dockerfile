FROM node:20-alpine

# better-sqlite3 needs build tools on Alpine
RUN apk add --no-cache python3 make g++

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
