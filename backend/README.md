# API — Uniautónoma Fest 2026

Backend Express con Firebase Admin, Wompi y correo multi-canal (Resend o SMTP) para compra de kits y panel administrativo.

Documentación completa del repositorio (arquitectura, diagramas, instalación, Wompi, ficheros): [`../README.md`](../README.md).

## Requisitos

- Node.js 20+
- Proyecto Firebase (Firestore + Auth)
- Cuenta Wompi (sandbox o producción)
- Cuenta Resend con dominio verificado **o** servidor SMTP de la universidad

## Configuración

1. Copia `.env.example` a `.env` y completa las variables.
2. Instala dependencias:

```bash
cd backend
npm install
```

3. Despliega reglas Firestore desde la carpeta `firebase/` en la consola Firebase o con CLI.

## Desarrollo local

```bash
cd backend
npm run dev
```

Sirve la API en `http://localhost:3000` y también la landing, `/checkout` y `/admin`.

Para probar webhooks Wompi en local, expón el puerto con ngrok y registra la URL en el dashboard de Wompi:

`https://<tu-subdominio>.ngrok.io/api/payments/webhook`

Guía paso a paso (sandbox + producción): [`../docs/ACTIVAR-WEBHOOK-WOMPI.md`](../docs/ACTIVAR-WEBHOOK-WOMPI.md)

Scripts de verificación:

```bash
npm run verificar-webhook          # revisa .env y servidor
npm run simular-pago-sin-retorno   # paso 1 + webhook (usuario no vuelve al sitio)
npm run probar-webhook             # prueba firmada del webhook
```

## Primer super administrador

Define `ADMIN_SEMILLA_CORREO` y `ADMIN_SEMILLA_CONTRASENA` en `.env`, luego:

```bash
cd backend
npm run semilla-admin
```

O manualmente:

```bash
cd backend
npm run crear-super-admin -- correo@uniautonoma.edu.co ContraseñaSegura123
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/checkout/initiate` | Inicia pago (validación + firma Wompi) |
| POST | `/api/checkout/confirmar` | Confirma pago con Wompi y genera código |
| POST | `/api/payments/webhook` | Eventos Wompi (firma SHA256) |
| GET | `/api/admin/students` | Listado (Bearer Firebase) |
| PATCH | `/api/admin/students/:id/deliver` | Marcar kit entregado |
| POST | `/api/admin/students/:id/reenviar-correo` | Reenviar correo de código de reclamo |
| POST | `/api/admin/create-admin` | Crear admin (super admin) |
| GET | `/api/config/publica` | Config Firebase/Wompi pública |
| GET | `/api/checkout/estado?reference=` | Estado del pago y código de reclamo |

## Reintento de pago (correo institucional)

Para kits institucionales (`uniautonomo`, `personalizado` con correo `@uniautonoma.edu.co`):

| Estado en Firestore | Al iniciar checkout |
|---------------------|---------------------|
| `APPROVED` | Rechaza con 409 — el correo ya tiene kit registrado |
| `PENDING` | Reutiliza el pago pendiente más reciente (misma referencia Wompi) y actualiza datos del formulario |
| `REJECTED` o sin registro | Crea un nuevo `PENDING` |

La respuesta de `POST /api/checkout/initiate` incluye `retomandoPagoPendiente: true` cuando se reutiliza un pendiente.

Variables relacionadas en `.env`:

| Variable | Descripción |
|----------|-------------|
| `PENDING_REUTILIZAR_HORAS` | Límite opcional en horas para reutilizar un `PENDING` institucional (vacío = sin límite) |
| `VALIDAR_PAGO_UNICO_INSTITUCIONAL` | Legacy; el bloqueo por `APPROVED` está siempre activo en código |

Kits externos (`general`) siguen usando la ventana de 30 minutos con `buscarPendienteReciente`.

## Correos y confirmación de pago

Tras pagar en el widget, el front llama a `POST /api/checkout/confirmar` con la `transactionId` de Wompi; el servidor consulta Wompi, genera **UAF26-XXXXX**, lo guarda en Firestore y envía el correo por el canal configurado (Resend o SMTP).

El webhook `POST /api/payments/webhook` sigue siendo la vía recomendada en producción (redundante con confirmar). En local, **confirmar** evita depender de ngrok; opcionalmente expón el puerto para webhooks.

### Selección de canal (Resend vs SMTP)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `EMAIL_DRIVER` | `resend` o `smtp` — tiene prioridad si está definido | — |
| `USO_RESEND` | `true` = Resend, `false` = SMTP (si no hay `EMAIL_DRIVER`) | `true` |
| `ENABLE_EMAIL_FALLBACK` | Si falla el principal, intenta el secundario | `false` |

Para activar SMTP de la universidad en `backend/.env`:

```env
USO_RESEND=false
# o: EMAIL_DRIVER=smtp

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=correo-servicio@uniautonoma.edu.co
SMTP_PASS=contraseña-o-app-password
EMAIL_FROM_ADDRESS=correo-servicio@uniautonoma.edu.co
EMAIL_FROM_NAME=Uniautónoma Fest
```

Al arrancar (`npm run dev`) verás `[correo] driver activo: smtp` y `[correo] SMTP verificado OK` si la conexión es correcta.

### Mailtrap Testing (desarrollo, sin DNS)

Con `SMTP_HOST=sandbox.smtp.mailtrap.io` los correos **no llegan a bandejas reales** (Gmail, Outlook, `@uniautonoma.edu.co`). Mailtrap los captura en una bandeja web.

Si los logs muestran `[correo] enviado a ... via smtp`, el envío fue correcto. Para ver el HTML:

1. Entra a [mailtrap.io](https://mailtrap.io) → **Email Testing** → **Inboxes**
2. Abre el inbox cuyas credenciales están en `.env`
3. Verifica asunto, destinatario `To` y plantilla HTML (código de reclamo o evento)

Al arrancar o ejecutar `probar-correo`, verás un aviso si Mailtrap Testing está activo.

### Pruebas de correo sin Wompi

Correo de reclamo (kit):

```bash
cd backend
npm run probar-correo -- tu-correo@ejemplo.com
```

Correo de evento (Hackatón / Feria):

```bash
cd backend
npm run probar-correo-evento -- tu-correo@ejemplo.com Hackton
```

Si el pago quedó aprobado pero el correo falló, el sistema reintenta al consultar `GET /api/checkout/estado` o en un webhook idempotente. Revisa en Firestore los campos `emailEnviadoEn` y `emailError`. Desde el panel admin puedes usar **Enviar correo** / **Reenviar correo** en cada fila aprobada.

Guía operativa completa: [`docs/RESPALDO-PAGOS-PENDIENTES.md`](../docs/RESPALDO-PAGOS-PENDIENTES.md) (PENDING antiguos, reenvío manual, monitoreo).

### Diagnóstico Resend

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `emailError` menciona dominio no verificado | `CORREO_REMITENTE` no coincide con un dominio verificado en Resend | Verifica el subdominio en [resend.com/domains](https://resend.com/domains) (ej. `fest@send.cheiviz.com`) |
| Correo no llega en local con `onboarding@resend.dev` | Sandbox solo envía a tu cuenta Resend | Define `RESEND_CORREO_SANDBOX=tu-correo@...` en `.env` |
| Pago APPROVED sin número de corredor | Falló la reserva de número (queda en `numeroCorredorError`) | En el panel admin usa **Asignar número** en la fila; se reenvía el correo con el número |

### Diagnóstico SMTP

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `SMTP no disponible` al arrancar | Host, puerto o credenciales incorrectos | Verifica `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| `Autenticación SMTP fallida` | Usuario/contraseña incorrectos | Usa app password si es Office365/Google |
| `Error TLS/SSL` | `SMTP_SECURE` no coincide con el puerto | Puerto 587 → `SMTP_SECURE=false`; puerto 465 → `SMTP_SECURE=true` |
| Correo no llega | Remitente no autorizado en el servidor | Verifica que `EMAIL_FROM_ADDRESS` esté permitido por el servidor SMTP |
| Log dice "enviado" pero no llega a Gmail/U | Mailtrap Testing activo | Revisa el inbox en mailtrap.io; en producción usa SMTP de la universidad |
| `wrong version number` / TLS | `SMTP_SECURE` no coincide con el puerto | Puerto 587 o 2525 → `SMTP_SECURE=false` |

### Entrega a TI de la universidad (producción SMTP)

Variables que debe configurar el equipo de sistemas en el servidor de producción:

```env
EMAIL_DRIVER=smtp
USO_RESEND=false
SMTP_HOST=<servidor SMTP institucional>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<cuenta de servicio autorizada>
SMTP_PASS=<contraseña o app password>
EMAIL_FROM_ADDRESS=<mismo correo autorizado para enviar>
EMAIL_FROM_NAME=Uniautónoma Fest
```

Notas para TI:

- `EMAIL_FROM_ADDRESS` debe ser un remitente que el servidor SMTP permita (suele coincidir con `SMTP_USER`).
- Puerto 465 requiere `SMTP_SECURE=true`; puerto 587 requiere `SMTP_SECURE=false`.
- SPF/DKIM del dominio institucional deben estar configurados para evitar spam.
- Prueba post-despliegue: `npm run probar-correo -- correo-real@uniautonoma.edu.co` y confirmar recepción (revisar carpeta spam la primera vez).

Reenvío manual por referencia:

```bash
cd backend
npm run reenviar-correo -- Unifest26-PAY-XXXXXXXX
```

### Números de corredor (001–999)

| Kit | Número asignado |
|-----|-----------------|
| Kit Uniautónomo (`uniautonomo`) | Sí — carrera y rifa de la moto |
| Arma tu kit con componente **Carrera** | Sí — solo carrera |
| Arma tu kit sin carrera | No |
| Kit externo (`general`) | No |

El número se guarda en `numeroCorredor`, aparece en el correo, en la confirmación del modal y en la exportación Excel del admin.

La aprobación del pago y la reserva del número ocurren en una sola transacción de Firestore: aunque el webhook y la confirmación del navegador lleguen a la vez, cada pago recibe un único número. Cada número reservado queda además en `numerosCorredor/{numero}` con el `paymentId`, lo que impide que dos pagos compartan número.

### Entregar base de datos limpia (producción)

Para borrar todos los datos de prueba y dejar el contador en **001**:

```bash
cd backend
npm run limpiar-base-datos                 # simulación (muestra conteos)
npm run limpiar-base-datos -- --confirmar  # aplica la limpieza
```

| Acción | Colección |
|--------|-----------|
| Borra | `payments`, `numerosCorredor`, inscripciones en `eventos/uaf2026/Hackton` y `FeriaEmprendimiento` |
| Reinicia | `sequences/numeroCorredor` → `ultimo: 0` (próximo número **001**) |
| Conserva | `admins` (usuarios del panel) |

Si solo quieres reiniciar números **sin borrar pagos** (conserva historial en `numeroCorredorPrueba`):

```bash
npm run reiniciar-numero-corredor                 # simulación
npm run reiniciar-numero-corredor -- --confirmar  # aplica
```

Para que la búsqueda por nombre del panel encuentre pagos anteriores a este cambio, ejecuta una vez `npm run rellenar-nombre-busqueda` y despliega los índices con `firebase deploy --only firestore:indexes`.

## Checklist pre-producción

- [ ] Variables en Vercel (preview y production)
- [ ] URL de eventos Wompi apuntando a `/api/payments/webhook`
- [ ] Llaves Wompi de producción (`WOMPI_PUBLIC_KEY`, secretos)
- [ ] Correo: Resend verificado o SMTP universidad probado (`npm run probar-correo`)
- [ ] Índice Firestore `status + createdAt` desplegado
- [ ] Super admin creado; login en `/admin/login.html`, panel en `/admin/`
- [ ] Transacción de prueba sandbox → correo con código `UAF26-XXXXX`

## Despliegue en Vercel

El repositorio incluye `vercel.json` en la raíz. Conecta el proyecto y configura las mismas variables de entorno que en `.env`.
