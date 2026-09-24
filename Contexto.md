# PROMPT MAESTRO: Sistema Integral de Pagos, Entregas y Dashboard Admin (Uniautónoma Fest 2026)

## 1. CONTEXTO Y ROL
Actúa como un Arquitecto de Software Senior y Desarrollador Full-Stack. Debes construir el backend y el panel de administración para la plataforma de compra de kits del Uniautónoma Fest 2026.
El sistema debe procesar pagos mediante pasarela (ej. Wompi), validar correos institucionales, enviar correos con códigos criptográficos únicos de reclamo, y proveer un dashboard administrativo seguro para auditoría, entrega de kits y exportación a Excel.

## 2. STACK TECNOLÓGICO
- **Backend:** Node.js con Express (estructurado para despliegue en Vercel, Render o Cloud Functions).
- **Base de Datos & Auth:** Firebase Admin SDK (Firestore y Firebase Auth).
- **Frontend (Admin):** HTML/JS Vanilla (o React si lo prefieres para el admin) interactuando con la API REST.
- **Herramientas:** `nodemailer` o `resend` (emails), `crypto` (hashes), `xlsx` (exportación SheetJS).

## 3. ARQUITECTURA Y PRINCIPIOS SOLID
Aplica Clean Architecture separando responsabilidades en el Backend:
- `routes/`: Definición de endpoints y asginación a controladores.
- `middlewares/`: Seguridad, validación de tokens y RBAC (Role-Based Access Control).
- `controllers/`: Manejo de peticiones HTTP (req, res).
- `services/`: Lógica de negocio pura (generar códigos, validar dominios, enviar correos).
- `repositories/`: Interacción exclusiva con Firebase Firestore.

## 4. MODELO DE DATOS (FIRESTORE)
Implementa las siguientes colecciones:
1. **`payments`**: `{ id, reference, transactionId, personalInfo: { firstName, secondName, firstSurname, secondSurname, email, studentCode, shirtSize ("S"|"M"|"L"|"XL") }, kitType ("uniautonomo"|"general"), amount, status ("PENDING"|"APPROVED"|"REJECTED"), uniqueClaimCode, kitClaimed (boolean), claimedAt, claimedByAdminEmail, emailEnviadoEn, emailError, createdAt }`
2. **`admins`**: `{ uid, email, role ("SUPER_ADMIN"|"ADMIN"), createdAt }`

## 5. REGLAS DE NEGOCIO CRÍTICAS (Implementar en la capa de Servicios)
1. **Validación de Dominio (Kit Uniautónomo):** Si `kitType === 'uniautonomo'`, el backend DEBE rechazar la petición si el `email` no termina en `@uniautonoma.edu.co` o si `studentCode` está vacío.
2. **Código Único:** Al recibir un webhook de pago aprobado, genera un código del formato `UAF26-XXXXX` usando un hash criptográfico corto (`crypto.randomBytes(3).toString('hex').toUpperCase()`).
3. **Idempotencia de Webhooks:** Antes de procesar el webhook de la pasarela, verifica en Firestore si la `reference` ya tiene estado `APPROVED`. Si es así, retorna 200 OK sin duplicar correos ni datos.
4. **Plantilla de Correo:** Envía un correo HTML atractivo al estudiante indicando su código `UAF26-XXXXX` y los pasos para reclamar su kit.

## 6. SEGURIDAD Y MIDDLEWARES
1. **`verifyWebhookSignature`**: Middleware genérico para asegurar que el payload del webhook HTTP POST proviene realmente de la pasarela de pagos (usando validación de firmas/hashes criptográficos).
2. **`requireAuth`**: Middleware para verificar el Bearer Token de Firebase (`admin.auth().verifyIdToken()`).
3. **`requireAdmin` y `requireSuperAdmin`**: Middlewares basados en Custom Claims de Firebase Auth para proteger las rutas de `/api/admin/*`.

## 7. ENDPOINTS REQUERIDOS
Desarrolla los siguientes endpoints en Express:
- `POST /api/checkout/initiate`: Recibe datos del frontend, valida reglas de negocio, guarda estado "PENDING" en Firestore y retorna el ID de referencia.
- `POST /api/payments/webhook`: Recibe confirmación de pago, valida firma, actualiza estado a "APPROVED", genera el código `UAF26-XXXXX` y despacha el correo transaccional.
- `GET /api/admin/students`: (Protegido por Admin) Retorna listado de estudiantes, soporta filtros por estado y búsqueda (search query).
- `PATCH /api/admin/students/:id/deliver`: (Protegido por Admin) Marca `kitClaimed = true` y registra qué admin lo entregó.
- `POST /api/admin/create-admin`: (Protegido por Super Admin) Crea usuario en Firebase, le asigna Custom Claim `{ admin: true }` y lo guarda en la colección `admins`.

## 8. FRONTEND: DASHBOARD ADMIN (`/admin`)
Genera el código para el panel administrativo que consumirá la API. Debe incluir:
- **Login:** Autenticación con Firebase Auth (correo y contraseña).
- **Tabla de Registros:** Listado de estudiantes que pagaron, mostrando nombres, tipo de kit, código único y estado del reclamo.
- **Buscador/Filtros:** Input para filtrar por código de estudiante, código de reclamo o nombre.
- **Botón "Marcar Entregado":** Que consume el endpoint `PATCH /deliver`.
- **Botón "Exportar Excel":** Un script en el frontend utilizando la librería `xlsx` (SheetJS) que tome el array de datos consultado y lo descargue como `.xlsx` estructurado por columnas.

## 9. INSTRUCCIONES DE EJECUCIÓN
Por favor, genera este sistema paso a paso para evitar omitir detalles:
1. Primero, genera la estructura de carpetas y los archivos básicos de configuración del servidor (Node/Express/Firebase Admin).
2. Segundo, genera los Middlewares de seguridad y el Repository de Firestore.
3. Tercero, genera los Services (Lógica de negocio, validación, envío de correos).
4. Cuarto, genera los Controladores y las Rutas REST.
5. Quinto, genera el código del Panel Administrativo (HTML/JS/Excel export).