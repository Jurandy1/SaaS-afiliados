FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY gcp/sync-server.js ./gcp/sync-server.js

ENV NODE_ENV=production
ENV AUTO_SYNC_DISABLE=1
EXPOSE 8080

CMD ["node", "gcp/sync-server.js"]
