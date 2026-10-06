# Docker — Uniautónoma Fest 2026

Guía para ejecutar la plataforma completa (landing, checkout Wompi, registro de eventos en Firestore y correos vía Resend o SMTP) usando Docker.

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
| Admin (`/admin`) | Resend o servidor SMTP (correos) |
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
              ┌───────────────────────────────┼───────────────────────────────┬───────────────┐
              │                               │                               │               │
              ▼                               ▼                               ▼               ▼
        ┌──────────┐                   ┌──────────┐                   ┌──────────┐   ┌──────────┐
        │ Firestore│                   │  Wompi   │                   │  Resend  │   │   SMTP   │
        └──────────┘                   └──────────┘                   └──────────┘   └──────────┘
```

---

## Requisitos previos

1. **Docker Desktop** (Windows/Mac) o **Docker Engine + Compose v2** (Linux).
2. Archivo `backend/.env` completo (copiar de `backend/.env.example`).
3. Reglas Firestore desplegadas: `firebase deploy --only firestore`.
4. Cuenta Wompi con llaves y webhook configurado.
5. Proveedor de correo configurado: Resend (API) o SMTP (universidad / Mailtrap para pruebas).

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
| `EMAIL_DRIVER` | Canal de correo: `resend` o `smtp` (tiene prioridad sobre `USO_RESEND`) |
| `RESEND_API_KEY`, `CORREO_REMITENTE` | Envío vía Resend (cuando `EMAIL_DRIVER=resend`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Envío vía SMTP (cuando `EMAIL_DRIVER=smtp`) |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Remitente SMTP |
| `ENABLE_EMAIL_FALLBACK` | Si el canal principal falla, intenta el otro (`true`/`false`) |
| `URL_BASE` | URL pública del sitio (enlaces en correos y callbacks) |
| `PUERTO` | Puerto interno (3000 por defecto) |

**Ejemplo SMTP (Mailtrap / universidad):**

```env
EMAIL_DRIVER=smtp
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_usuario
SMTP_PASS=tu_password
EMAIL_FROM_ADDRESS=no-reply@uniautonoma.edu.co
EMAIL_FROM_NAME=Uniautónoma Fest
```

**Ejemplo Resend:**

```env
EMAIL_DRIVER=resend
RESEND_API_KEY=re_...
CORREO_REMITENTE=Uniautónoma Fest <fest@tudominio.com>
```

> Las variables SMTP se inyectan automáticamente vía `env_file: ./backend/.env` en `docker-compose.yml`. No hace falta modificar el Dockerfile ni abrir puertos adicionales (SMTP es conexión saliente).

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
| `docker compose exec app npm run probar-webhook` | Simular webhook Wompi firmado (entorno de pruebas) |
| `docker compose exec app npm run probar-webhook-sin-firma` | Verificar que el webhook rechaza peticiones sin firma (401) |
| `NODE_ENV=development docker compose up -d` | Levantar con logs de desarrollo (usa solo `backend/.env`) |

---

## Prueba del webhook Wompi (sandbox + ngrok)

Usa **solo** `backend/.env` del entorno de pruebas. **Nunca** montes ni copies `backend/.env.real`.

### Checklist previo

- [ ] `backend/.env` con credenciales de **sandbox/test** (Firebase de pruebas, llaves Wompi test)
- [ ] `WOMPI_EVENTS_SECRET` coincide con el Events Secret del dashboard Wompi (sandbox)
- [ ] `WOMPI_PUBLIC_KEY` y `WOMPI_INTEGRITY_SECRET` del mismo entorno sandbox
- [ ] Contenedor levantado: `docker compose up --build -d`
- [ ] Health OK: `curl http://localhost:3000/api/health`

### 1. Prueba automatizada local (sin ngrok)

Desde el contenedor o con `npm run dev` en `backend/`:

```bash
# Rechazo sin firma (debe responder 401)
docker compose exec app npm run probar-webhook-sin-firma

# Flujo completo: crea PENDING → webhook APPROVED → consulta estado
docker compose exec app npm run probar-webhook
```

Verifica en Firestore de **pruebas**: `status=APPROVED`, `uniqueClaimCode` presente, `emailEnviadoEn` o `emailError`.

### 2. Exponer el webhook a Wompi con ngrok

```bash
ngrok http 3000
```

En el [dashboard de Wompi](https://comercios.wompi.co) (sandbox):

1. **Desarrolladores → Eventos → URL de eventos**
2. Registrar: `https://<subdominio-ngrok>.ngrok-free.app/api/payments/webhook`
3. Guardar el **Events Secret** en `WOMPI_EVENTS_SECRET` del `.env` de pruebas
4. Reiniciar contenedor: `docker compose up -d`

### 3. Prueba manual end-to-end (simula Instagram)

1. Abre `http://localhost:3000` o la URL ngrok
2. Inicia compra de kit con tarjeta sandbox Wompi
3. **Cierra el navegador o pestaña inmediatamente después de pagar** (no esperes el redirect)
4. En Firestore de pruebas confirma:
   - `payments/{id}.status` = `APPROVED`
   - `uniqueClaimCode` generado (ej. `UAF26-XXXXX`)
   - Correo en Mailtrap / Resend sandbox
5. Revisa logs: `docker compose logs -f app | grep webhook`

### 4. URLs del webhook propio

| Entorno | URL |
|---------|-----|
| Local + ngrok | `https://<ngrok>/api/payments/webhook` |
| Producción universidad | `https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook` |

No uses webhooks de otros proyectos (p. ej. Cloud Functions de `mvp-fast-service`).

### 5. Antes de producción

- [ ] `npm run probar-webhook` pasa en entorno de pruebas
- [ ] Pago sandbox + cierre de browser → APPROVED vía webhook
- [ ] Correo llega al sandbox configurado
- [ ] Registrar webhook en Wompi **producción** con la URL real del servidor
- [ ] `URL_BASE=https://uniautonomafest.uniautonoma.edu.co` solo en el servidor de producción

---

## Decisiones de diseño del Dockerfile

### 1. Imagen base `node:24-alpine`

Coincide con `"node": "24.x"` en `backend/package.json`. Alpine reduce el tamaño de la imagen (~50 MB vs ~350 MB de la variante completa).

### 2. Copiar todo el repositorio

Los HTML/JS/CSS viven en la raíz del repo (`index.html`, `checkout/`, `admin/`, `eventos/`). El backend resuelve la raíz del proyecto como `backend/src/../..`. Si solo copiáramos `backend/`, la landing no cargaría.

### 3. Solo dependencias del backend

El `package.json` de la raíz es para CI/Vercel. En Docker solo se instalan las de `backend/` con `npm ci --omit=dev`.

### 4. Secretos en runtime, no en build

Las credenciales (`FIREBASE_PRIVATE_KEY`, `WOMPI_*`, `RESEND_API_KEY`, `SMTP_*`) se inyectan vía `env_file` en `docker-compose.yml`. Nunca se copian al build (`.dockerignore` excluye `.env`).

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

12. **No dockerizar lo que ya es SaaS** — Firestore, Wompi y el proveedor de correo (Resend o SMTP) siguen siendo externos. Docker solo empaqueta tu código.

13. **SMTP es saliente** — El contenedor no expone puertos SMTP; solo conecta hacia el servidor externo (587, 465 o 2525). Verifica que el firewall del host permita tráfico saliente en esos puertos.

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
- [ ] Correo: si usas Resend, dominio verificado y `CORREO_REMITENTE` con ese dominio; si usas SMTP, credenciales y `EMAIL_FROM_ADDRESS` válidos para el servidor institucional
- [ ] `EMAIL_DRIVER` definido según el canal activo en producción
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

Revisa el driver activo en los logs al arrancar: `[correo] driver activo: smtp` o `resend`.

**Si `EMAIL_DRIVER=resend`:**

- Revisa que `RESEND_API_KEY` esté configurada (sin ella verás un warning al arrancar).
- En sandbox (`onboarding@resend.dev`), solo envía a correos permitidos (`RESEND_CORREO_SANDBOX`).
- En producción, el dominio de `CORREO_REMITENTE` debe estar verificado en Resend.

**Si `EMAIL_DRIVER=smtp`:**

- Confirma `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` en `backend/.env`.
- Puerto 587 o 2525 → `SMTP_SECURE=false`; puerto 465 → `SMTP_SECURE=true`.
- En Mailtrap sandbox los correos no llegan a Gmail/Outlook; revísalos en el panel de Mailtrap.
- Si ves `[correo] SMTP no disponible` al arrancar, el contenedor sigue vivo pero no enviará correos hasta corregir la configuración.

**Probar envío dentro del contenedor:**

```bash
docker compose exec app npm run probar-correo -- tu@email.com
docker compose exec app npm run probar-correo-evento -- tu@email.com Hackton
```

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

- Activar webhook Wompi (sandbox + producción): [`ACTIVAR-WEBHOOK-WOMPI.md`](ACTIVAR-WEBHOOK-WOMPI.md)
- Documentación general del proyecto: [`../README.md`](../README.md)
- Variables de entorno: [`../backend/.env.example`](../backend/.env.example)
- API y endpoints: [`../backend/README.md`](../backend/README.md)
