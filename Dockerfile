# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY src/public ./src/public
COPY src/views ./src/views
COPY help ./help
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data /app/backups \
  && chown node:node /app/data /app/backups \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PATH=/app/data/models.db
ENV BACKUP_DIR=/app/backups
ENV BACKUP_ENABLED=true
ENV TZ=Europe/Moscow

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
