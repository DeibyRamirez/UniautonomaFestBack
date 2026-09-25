# Docker — Uniautónoma Fest 2026

Guía para ejecutar la plataforma completa (landing, checkout Wompi, registro de eventos en Firestore y correos con Resend) usando Docker.

---

## ¿Por qué Dockerizar?

| Beneficio | Descripción |
|-----------|-------------|
| **Reproducibilidad** | El mismo entorno en desarrollo, pruebas y producción. Elimina el "en mi máquina sí funciona". |
| **Un solo comando** | `docker compose up -d` levanta landing + API + checkout + admin + eventos. |
| **Dependencias fijas** | Node.js 24 en Alpine, sin depender de lo instalado en el host. |
| **Entrega portable** | La imagen se despliega en cualquier VPS, Railway, DigitalOcean, etc. |

---

## Arquitectura

### ¿Un solo contenedor?

**Sí.** La aplicación es un monolito en ejecución: un proceso Express sirve la API (`/api/*`) y los archivos estáticos (landing, checkout, admin, eventos). No hay base de datos local ni build separado de frontend que justifique más contenedores.

### Qué va dentro y qué queda fuera

| Dentro del contenedor | Fuera (servicios externos) |
|-----------------------|----------------------------|
| Node.js + Express | Firestore (Firebase) |
| Landing (`index.html`, `js/`, `img/`) | Firebase Auth |
| Checkout (`/checkout`) | Wompi (pagos + webhooks) |
| Admin (`/admin`) | Resend (correos) |
| Eventos (`/eventos`) | Reglas Firestore (desplegadas con Firebase CLI) |
| API REST (`/api/*`) | |

```
┌─────────────────────────────────────────────────────────┐
│  Contenedor Docker (puerto 3000)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Landing   │  │   Checkout   │  │  API Express  │  │
│  │  index.html │  │   /checkout  │  │    /api/*     │  │
│  └─────────────┘  └──────────────┘  └───────┬───────┘  │
└─────────────────────────────────────────────┼──────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              │                               │                               │
              ▼                               ▼                               ▼
        ┌──────────┐                   ┌──────────┐                   ┌──────────┐
        │ Firestore│                   │  Wompi   │                   │  Resend  │
        └──────────┘                   └──────────┘                   └──────────┘
```

---

## Requisitos previos

1. **Docker Desktop** (Windows/Mac) o **Docker Engine + Compose v2** (Linux).
2. Archivo `backend/.env` completo (copiar de `backend/.env.example`).
3. Reglas Firestore desplegadas: `firebase deploy --only firestore`.
4. Cuenta Wompi con llaves y webhook configurado.
5. Cuenta Resend con dominio verificado (producción) o sandbox (pruebas).

---

## Paso a paso

### 1. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` con tus credenciales reales. Variables críticas:

| Variable | Uso |
|----------|-----|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Conexión a Firestore |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` | Login del panel admin |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Pagos y webhooks |
| `RESEND_API_KEY`, `CORREO_REMITENTE` | Envío de correos |
| `URL_BASE` | URL pública del sitio (enlaces en correos y callbacks) |
| `PUERTO` | Puerto interno (3000 por defecto) |

> **Importante:** En producción, `URL_BASE` debe ser la URL pública real (ej. `https://fest.uniautonoma.edu.co`), no `http://localhost:3000`.

### 2. Construir la imagen

```bash
docker compose build
```

### 3. Levantar el servicio

```bash
docker compose up -d
```

### 4. Verificar que funciona

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{"ok":true,"servicio":"uniautonoma-fest-api"}
```

Abre en el navegador:

- Landing: http://localhost:3000
- Checkout: http://localhost:3000/checkout
- Admin: http://localhost:3000/admin
- Eventos: http://localhost:3000/eventos

---

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose up -d` | Levantar en segundo plano |
| `docker compose down` | Detener y eliminar contenedores |
| `docker compose up --build -d` | Reconstruir imagen tras cambios de código |
| `docker compose logs -f app` | Ver logs en tiempo real |
| `docker compose ps` | Estado del contenedor y healthcheck |
| `docker compose exec app npm run semilla-admin` | Crear admin semilla dentro del contenedor |
| `docker compose exec app npm run probar-correo` | Probar envío de correo |

---

## Decisiones de diseño del Dockerfile

### 1. Imagen base `node:24-alpine`

Coincide con `"node": "24.x"` en `backend/package.json`. Alpine reduce el tamaño de la imagen (~50 MB vs ~350 MB de la variante completa).

### 2. Copiar todo el repositorio

Los HTML/JS/CSS viven en la raíz del repo (`index.html`, `checkout/`, `admin/`, `eventos/`). El backend resuelve la raíz del proyecto como `backend/src/../..`. Si solo copiáramos `backend/`, la landing no cargaría.

### 3. Solo dependencias del backend

El `package.json` de la raíz es para CI/Vercel. En Docker solo se instalan las de `backend/` con `npm ci --omit=dev`.

### 4. Secretos en runtime, no en build

Las credenciales (`FIREBASE_PRIVATE_KEY`, `WOMPI_*`, `RESEND_API_KEY`) se inyectan vía `env_file` en `docker-compose.yml`. Nunca se copian al build (`.dockerignore` excluye `.env`).

### 5. Usuario no-root

El proceso corre como `nodeapp`, no como root. Reduce el riesgo si alguien explota una vulnerabilidad en la app.

### 6. Healthcheck

Docker consulta `GET /api/health` cada 30 segundos. Si falla 3 veces seguidas, marca el contenedor como unhealthy.

---

## Qué tener siempre en cuenta al dockerizar

Principios que aplican a cualquier aplicación, hoy y siempre:

1. **Un proceso por contenedor** — Aquí: un Node que sirve API + estáticos. No mezclar nginx + Node + cron en el mismo contenedor.

2. **Stateless** — No guardar datos en el filesystem del contenedor. Firestore es la base de datos; el contenedor es efímero.

3. **Secretos fuera de la imagen** — Usar `.env`, Docker secrets o variables del orquestador. Nunca `COPY .env` ni `ARG` con claves en el Dockerfile.

4. **`.dockerignore` obligatorio** — Evita filtrar credenciales al contexto de build y acelera las construcciones.

5. **Imagen mínima y versión fijada** — `node:24-alpine`, no `node:latest`. Las versiones `latest` cambian sin aviso.

6. **Usuario no-root** — Reduce la superficie de ataque si hay una vulnerabilidad.

7. **Healthcheck** — Detecta contenedores "zombies" que responden al proceso pero no al servicio.

8. **Puertos explícitos** — `EXPOSE` en Dockerfile + mapeo en compose (`3000:3000`).

9. **Logs a stdout** — Docker captura `console.log`. No escribir logs a archivos dentro del contenedor.

10. **Rebuild vs restart** — Cambios de código → `docker compose up --build -d`. Solo cambios en `.env` → `docker compose up -d` (recreate).

11. **URL pública y webhooks** — Servicios externos (Wompi) deben alcanzar tu host. En local, usa ngrok o similar para probar webhooks.

12. **No dockerizar lo que ya es SaaS** — Firestore, Resend y Wompi siguen siendo externos. Docker solo empaqueta tu código.

---

## Producción

### Webhook de Wompi

Configura en el dashboard de Wompi:

```
https://<tu-dominio>/api/payments/webhook
```

Y asegúrate de que `URL_BASE` en `.env` coincida con ese dominio.

### HTTPS (recomendado)

Opciones:

- **Reverse proxy en el host** — nginx o Caddy delante del contenedor, manejando TLS.
- **Segundo contenedor** — Añadir nginx/Caddy en `docker-compose.yml` (no incluido por defecto).
- **PaaS** — Railway, Fly.io, etc. inyectan HTTPS automáticamente.

### Checklist de producción

- [ ] `URL_BASE` = URL canónica del sitio en producción
- [ ] Wompi: llaves de producción y webhook apuntando al dominio real
- [ ] Resend: dominio verificado y `CORREO_REMITENTE` con ese dominio
- [ ] Firestore: reglas e índices desplegados
- [ ] `FIREBASE_PRIVATE_KEY` con saltos de línea correctos (`\n` en el `.env`)
- [ ] Firewall: solo puertos 80/443 expuestos (no 3000 directamente)

---

## Troubleshooting

### El contenedor reinicia constantemente

```bash
docker compose logs app
```

Causas comunes:

- `FIREBASE_PRIVATE_KEY` mal formateada (faltan `\n` o comillas).
- `FIREBASE_PROJECT_ID` vacío o incorrecto.
- Puerto 3000 ya ocupado en el host.

### Webhook de Wompi no llega

- Verifica que `URL_BASE` apunte al dominio público, no a `localhost`.
- En local, expón el puerto con ngrok: `ngrok http 3000`.
- Confirma que `WOMPI_EVENTS_SECRET` coincide con el dashboard de Wompi.

### Los correos no se envían

- Revisa que `RESEND_API_KEY` esté configurada (sin ella verás un warning al arrancar).
- En sandbox (`onboarding@resend.dev`), solo envía a correos permitidos (`RESEND_CORREO_SANDBOX`).
- En producción, el dominio de `CORREO_REMITENTE` debe estar verificado en Resend.

### La landing carga pero la API falla

```bash
curl http://localhost:3000/api/health
```

Si devuelve error, revisa logs y variables Firebase. Si devuelve `{"ok":true}`, el problema puede ser de configuración del frontend (llaves Wompi/Firebase públicas).

### Cambié el código pero no se refleja

```bash
docker compose up --build -d
```

Docker usa la imagen cacheada. Hay que reconstruir tras cambios en el código fuente.

### Cambié el `.env` pero no se aplica

```bash
docker compose up -d
```

Compose recrea el contenedor con las nuevas variables. Un simple `restart` no recarga `env_file`.

---

## Archivos de Docker en este repositorio

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Define la imagen de producción |
| `docker-compose.yml` | Orquesta el servicio `app` |
| `.dockerignore` | Excluye secretos y archivos innecesarios del build |
| `docs/DOCKER.md` | Esta guía |

---

## Referencias

- Documentación general del proyecto: [`../README.md`](../README.md)
- Variables de entorno: [`../backend/.env.example`](../backend/.env.example)
- API y endpoints: [`../backend/README.md`](../backend/README.md)
