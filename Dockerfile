FROM node:24-alpine

WORKDIR /app

# Copiar todo el repositorio (landing, checkout, admin, eventos + backend)
COPY . .

WORKDIR /app/backend

RUN npm ci --omit=dev

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
