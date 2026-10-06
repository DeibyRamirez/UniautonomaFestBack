# Activar webhook Wompi — garantía APPROVED + correo

Guía para registrar el webhook propio y validar que un pago completado en Wompi se aprueba en Firestore y envía correo **aunque el usuario cierre el navegador** (Instagram, pestaña, etc.).

Usa **solo** [`backend/.env`](../backend/.env) del entorno de pruebas. **Nunca** uses [`backend/.env.real`](../backend/.env.real).

---

## URLs del webhook propio

| Entorno | URL a registrar en Wompi |
|---------|--------------------------|
| Local + ngrok (pruebas) | `https://<subdominio-ngrok>/api/payments/webhook` |
| Producción universidad | `https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook` |

No uses webhooks de otros proyectos (p. ej. `mvp-fast-service` en Cloud Functions).

---

## Paso 1 — Levantar la API

```bash
# Opción A: Docker
docker compose up --build -d

# Opción B: Node local
cd backend
npm run dev
```

Verifica:

```bash
curl http://localhost:3000/api/health
```

---

## Paso 2 — Exponer el puerto (solo pruebas locales)

```bash
ngrok http 3000
```

Copia la URL HTTPS que muestra ngrok (ej. `https://abc123.ngrok-free.app`).

---

## Paso 3 — Registrar en Wompi sandbox

1. Entra a [comercios.wompi.co](https://comercios.wompi.co) con cuenta **sandbox/test**.
2. **Desarrolladores → Eventos → URL de eventos**.
3. Evento: **`transaction.updated`** (o todos los eventos de transacción, según el panel).
4. Pega:
   ```
   https://<subdominio-ngrok>/api/payments/webhook
   ```
5. Guarda y copia el **Events Secret** (secreto de eventos).
6. Pégalo en `backend/.env`:
   ```env
   WOMPI_EVENTS_SECRET=el_secreto_que_te_dio_wompi
   ```
7. Asegúrate de que `WOMPI_PUBLIC_KEY` y `WOMPI_INTEGRITY_SECRET` sean del **mismo entorno sandbox**.
8. Reinicia:
   ```bash
   docker compose up -d
   # o reinicia npm run dev
   ```

### Checklist de registro (marca al completar)

| Entorno | URL registrada en Wompi | `WOMPI_EVENTS_SECRET` en `.env` | Fecha verificado |
|---------|-------------------------|----------------------------------|------------------|
| Sandbox + ngrok | `https://______.ngrok-free.app/api/payments/webhook` | [ ] coincide con dashboard | |
| Producción | `https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook` | [ ] coincide con dashboard prod | |

Si el secreto del dashboard no coincide con `.env`, Wompi enviará eventos pero el servidor responderá **401** y el pago quedará `PENDING`.

---

## Paso 4 — Verificar configuración

```bash
cd backend
npm run verificar-webhook
```

Debe mostrar todas las variables OK y la URL sugerida para Wompi.

---

## Paso 5 — Prueba automatizada (simula “pagó y se fue”)

Sin abrir el navegador después de pagar — solo servidor:

```bash
cd backend
npm run simular-pago-sin-retorno
```

Esto hace: paso 1 (initiate) → webhook APPROVED → consulta estado. **No** llama a `/confirmar` (como si el usuario nunca volviera).

---

## Paso 6 — Prueba manual real (sandbox + cierre de browser)

1. Abre la landing (localhost o URL ngrok).
2. Completa paso 1 y paga en Wompi con tarjeta sandbox.
3. **Cierra el navegador o la app inmediatamente** al ver que Wompi aprobó — no esperes el redirect.
4. En Firestore de **pruebas**, busca el documento en `payments`:

| Campo | Esperado |
|-------|----------|
| `status` | `APPROVED` |
| `transactionId` | ID de Wompi |
| `uniqueClaimCode` | `UAF26-XXXXX` |
| `emailEnviadoEn` | timestamp (o `emailError` si falló correo) |

5. Revisa logs:
   ```bash
   docker compose logs -f app | findstr webhook
   ```

Si `status` sigue `PENDING` pero Wompi sí cobró → webhook no llegó (URL mal registrada, secreto distinto, ngrok caído).

---

## Paso 7 — Producción (después de validar sandbox)

1. Cambia a llaves **producción** en el `.env` del servidor universidad (no el de pruebas local).
2. En Wompi **producción**, registra:
   ```
   https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook
   ```
3. Copia el Events Secret de **producción** al `.env` del servidor.
4. `URL_BASE=https://uniautonomafest.uniautonoma.edu.co`
5. Reinicia el contenedor en el VPS.
6. Haz **una** compra real de prueba y verifica Firestore + correo antes de anunciar la página.

---

## Comandos útiles

| Comando | Qué valida |
|---------|------------|
| `npm run verificar-webhook` | Variables `.env` y endpoints locales |
| `npm run probar-webhook-sin-firma` | Rechazo 401 sin firma |
| `npm run probar-webhook` | Webhook firmado → APPROVED + código |
| `npm run simular-pago-sin-retorno` | Escenario “pagó y no volvió” sin browser |

---

## Garantías del sistema

- **APPROVED** solo si Wompi envía evento firmado con `status: APPROVED`.
- **Monto** debe coincidir con el registrado en paso 1; si no, queda `PENDING` + alerta.
- **Correo** se envía después de aprobación; si falla, se reintenta (webhook idempotente, polling, admin).
- **Sin webhook registrado**, el escenario “pagó y se fue” **no funciona** aunque Wompi haya cobrado.

Si algo falla en producción, consulta [`RESPALDO-PAGOS-PENDIENTES.md`](./RESPALDO-PAGOS-PENDIENTES.md).
