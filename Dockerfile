# syntax=docker/dockerfile:1
FROM node:24-alpine

WORKDIR /app

# Capa de dependencias separada (cache + menos re-descargas)
COPY backend/package.json backend/package-lock.json ./backend/

WORKDIR /app/backend

# ECONNRESET en Docker Desktop: menos sockets paralelos y más reintentos
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 10 \
    fetch-retry-mintimeout 30000 \
    fetch-retry-maxtimeout 300000 \
    maxsockets 3 \
    && npm ci --omit=dev --loglevel verbose

WORKDIR /app

# Resto del repo (landing, admin, checkout, backend/src, etc.)
COPY . .

WORKDIR /app/backend

ENV NODE_ENV=production \
    SERVIR_ESTATICOS=true \
    PUERTO=3000

EXPOSE 3000

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp \
    && chown -R nodeapp:nodeapp /app

USER nodeapp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
