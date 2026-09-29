# API — Uniautónoma Fest 2026

Backend Express con Firebase Admin, Wompi y Resend para compra de kits y panel administrativo.

Documentación completa del repositorio (arquitectura, diagramas, instalación, Wompi, ficheros): [`../README.md`](../README.md).

## Requisitos

- Node.js 20+
- Proyecto Firebase (Firestore + Auth)
- Cuenta Wompi (sandbox o producción)
- Cuenta Resend con dominio verificado

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

## Correos y confirmación de pago

Tras pagar en el widget, el front llama a `POST /api/checkout/confirmar` con la `transactionId` de Wompi; el servidor consulta Wompi, genera **UAF26-XXXXX**, lo guarda en Firestore y envía el correo con Resend.

El webhook `POST /api/payments/webhook` sigue siendo la vía recomendada en producción (redundante con confirmar). En local, **confirmar** evita depender de ngrok; opcionalmente expón el puerto para webhooks.

Prueba Resend sin Wompi:

```bash
cd backend
npm run probar-correo -- tu-correo@ejemplo.com
```

Si el pago quedó aprobado pero el correo falló, el sistema reintenta al consultar `GET /api/checkout/estado` o en un webhook idempotente. Revisa en Firestore los campos `emailEnviadoEn` y `emailError`. Desde el panel admin puedes usar **Enviar correo** / **Reenviar correo** en cada fila aprobada.

### Diagnóstico Resend

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `emailError` menciona dominio no verificado | `CORREO_REMITENTE` no coincide con un dominio verificado en Resend | Verifica el subdominio en [resend.com/domains](https://resend.com/domains) (ej. `fest@send.cheiviz.com`) |
| Correo no llega en local con `onboarding@resend.dev` | Sandbox solo envía a tu cuenta Resend | Define `RESEND_CORREO_SANDBOX=tu-correo@...` en `.env` |
| Pago APPROVED sin número de corredor | Falló la reserva de número (queda en `numeroCorredorError`) | En el panel admin usa **Asignar número** en la fila; se reenvía el correo con el número |

Prueba directa sin Wompi:

```bash
cd backend
npm run probar-correo -- tu-correo@ejemplo.com
```

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

Antes de abrir la venta real, reinicia la numeración para que empiece en 001 (los pagos de prueba conservan su número en `numeroCorredorPrueba`):

```bash
cd backend
npm run reiniciar-numero-corredor                 # simulación
npm run reiniciar-numero-corredor -- --confirmar  # aplica
```

Para que la búsqueda por nombre del panel encuentre pagos anteriores a este cambio, ejecuta una vez `npm run rellenar-nombre-busqueda` y despliega los índices con `firebase deploy --only firestore:indexes`.

## Checklist pre-producción

- [ ] Variables en Vercel (preview y production)
- [ ] URL de eventos Wompi apuntando a `/api/payments/webhook`
- [ ] Llaves Wompi de producción (`WOMPI_PUBLIC_KEY`, secretos)
- [ ] Resend: remitente verificado y prueba de correo APPROVED
- [ ] Índice Firestore `status + createdAt` desplegado
- [ ] Super admin creado; login en `/admin/login.html`, panel en `/admin/`
- [ ] Transacción de prueba sandbox → correo con código `UAF26-XXXXX`

## Despliegue en Vercel

El repositorio incluye `vercel.json` en la raíz. Conecta el proyecto y configura las mismas variables de entorno que en `.env`.
