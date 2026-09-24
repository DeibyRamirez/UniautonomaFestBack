# API — Uniautónoma Fest 2026

Backend Express con Firebase Admin, Wompi y Resend para compra de kits y panel administrativo.

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

Si el pago quedó aprobado pero el correo falló, el sistema reintenta al consultar `GET /api/checkout/estado` o en un webhook idempotente. Revisa en Firestore los campos `emailEnviadoEn` y `emailError`.

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
