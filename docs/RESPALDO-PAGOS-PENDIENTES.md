# Respaldo operativo — pagos PENDING y correos fallidos

Guía para el equipo cuando un usuario pagó en Wompi pero no recibió código, o el pago quedó en `PENDING` en Firestore.

Usa **solo** [`backend/.env`](../backend/.env) en pruebas locales. **Nunca** uses [`backend/.env.real`](../backend/.env.real) en tu máquina.

---

## Cómo funciona la confirmación (referencia rápida)

| Vía | Cuándo ocurre | ¿Requiere que el usuario vuelva al sitio? |
|-----|---------------|---------------------------------------------|
| **Webhook Wompi** (`POST /api/payments/webhook`) | Segundos después de que Wompi aprueba | **No** |
| Confirmación navegador (`POST /api/checkout/confirmar`) | Usuario vuelve o cierra el widget | Sí |
| Polling (`GET /api/checkout/estado`) | Solo lee estado; no aprueba solo | Parcial |

**Si el webhook no está registrado en Wompi**, un usuario que paga y cierra el navegador quedará en `PENDING` aunque Wompi haya cobrado. Solución: [ACTIVAR-WEBHOOK-WOMPI.md](./ACTIVAR-WEBHOOK-WOMPI.md).

---

## Escenario 1 — Pago en `PENDING` pero Wompi sí cobró

### Síntomas

- Firestore: `status = PENDING`, sin `uniqueClaimCode`
- Usuario tiene comprobante de Wompi aprobado
- Logs del servidor sin línea `[webhook wompi]` para esa referencia

### Diagnóstico

1. Busca en Firestore la colección `payments` por `reference` o correo del usuario.
2. Revisa logs del servidor:
   ```bash
   docker compose logs -f app | findstr webhook
   ```
3. Verifica configuración:
   ```bash
   cd backend
   npm run verificar-webhook
   ```

### Acciones

| Prioridad | Acción |
|-----------|--------|
| 1 | Confirmar que el webhook esté registrado en Wompi con URL correcta y `WOMPI_EVENTS_SECRET` coincidente |
| 2 | Si tienes el `transactionId` de Wompi (comprobante), el usuario puede volver al sitio con el redirect o un admin puede consultar Wompi |
| 3 | Reenviar evento desde dashboard Wompi (si disponible) o contactar soporte Wompi con referencia + transaction ID |
| 4 | **Prevención:** activar webhook en producción antes de campañas masivas |

### Campos Firestore a revisar

| Campo | PENDING sin webhook | APPROVED correcto |
|-------|---------------------|-------------------|
| `status` | `PENDING` | `APPROVED` |
| `transactionId` | vacío o antiguo | ID Wompi |
| `uniqueClaimCode` | vacío | `UAF26-XXXXX` |
| `emailEnviadoEn` | vacío | timestamp |
| `emailError` | vacío | solo si falló correo |

---

## Escenario 2 — Pago `APPROVED` pero sin correo

### Síntomas

- Firestore: `status = APPROVED`, `uniqueClaimCode` presente
- `emailEnviadoEn` vacío y `emailError` con mensaje, **o** usuario no recibió el correo

### Diagnóstico

1. Revisa `emailError` en el documento de Firestore.
2. Consulta tabla de diagnóstico en [`backend/README.md`](../backend/README.md) (Resend / SMTP).
3. El sistema reintenta automáticamente en:
   - Nuevo webhook idempotente
   - `GET /api/checkout/estado` (polling del usuario)
   - `POST /api/checkout/confirmar`

### Acciones

#### Desde el panel admin

1. Entra a `/admin/login.html`
2. Filtra por estado **Aprobado**
3. Localiza la fila del usuario
4. Pulsa **Enviar correo** o **Reenviar correo**

#### Desde terminal (referencia conocida)

```bash
cd backend
npm run reenviar-correo -- Unifest26-PAY-XXXXXXXX
```

#### Entregar código manualmente

Si el correo sigue fallando, comunica al usuario el `uniqueClaimCode` de Firestore por canal seguro (presencial en sede con documento + comprobante Wompi).

---

## Escenario 3 — Monitoreo de pagos `PENDING` antiguos

### Cuándo preocuparse

- Pago `PENDING` con más de **30 minutos** desde `createdAt`
- Coincide con quejas de usuarios que pagaron en Wompi

### Revisión periódica (admin)

1. Panel admin → filtro **Pendiente**
2. Ordena por fecha de creación
3. Si hay muchos PENDING recientes tras una campaña → **webhook probablemente caído o mal configurado**

### Checklist semanal (producción)

- [ ] `npm run verificar-webhook` en servidor (variables OK)
- [ ] Webhook URL activa en dashboard Wompi producción
- [ ] Cero o muy pocos PENDING > 24 h
- [ ] Logs sin errores 500 repetidos en `[webhook wompi]`
- [ ] Prueba sandbox ocasional: pagar y cerrar navegador → APPROVED + correo

---

## Comandos de referencia

| Comando | Uso |
|---------|-----|
| `npm run verificar-webhook` | Variables `.env` y health local |
| `npm run simular-pago-sin-retorno` | Prueba “pagó y no volvió” sin navegador |
| `npm run probar-webhook` | Webhook firmado → APPROVED |
| `npm run reenviar-correo -- <ref>` | Reenvío manual de código |
| `npm run probar-correo -- email@...` | Prueba SMTP/Resend sin pago |

---

## Mensaje para el usuario final

> Cuando completas el pago en Wompi, nuestro sistema recibe la confirmación al instante y te envía el código por correo. No necesitas volver al sitio ni pulsar «Regresar al comercio». Si no ves el correo en 10 minutos, revisa spam o acércate a sede con tu comprobante de pago.
