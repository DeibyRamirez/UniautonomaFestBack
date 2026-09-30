require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

function normalizarPrivateKey(valor) {
  if (!valor) return valor;

  let clave = valor.trim();
  if (
    (clave.startsWith('"') && clave.endsWith('"')) ||
    (clave.startsWith("'") && clave.endsWith("'"))
  ) {
    clave = clave.slice(1, -1);
  }

  return clave.replace(/\\n/g, '\n');
}

function obtenerEntero(nombre, valorPorDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return valorPorDefecto;
  const numero = Number.parseInt(valor, 10);
  return Number.isNaN(numero) ? valorPorDefecto : numero;
}

function obtenerBooleano(nombre, valorPorDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return valorPorDefecto;
  return valor === 'true';
}

const variablesEntorno = {
  puerto: obtenerEntero('PUERTO', 3000),
  urlBase: process.env.URL_BASE || 'http://localhost:3000',
  montos: {
    uniautonomo: obtenerEntero('MONTO_KIT_UNIAUTONOMO', 7500000),
    general: obtenerEntero('MONTO_KIT_GENERAL', 8000000),
    componentes: {
      carrera: obtenerEntero('MONTO_COMPONENTE_CARRERA', 6000000),
      fiesta: obtenerEntero('MONTO_COMPONENTE_FIESTA', 2000000),
      bingo: obtenerEntero('MONTO_COMPONENTE_BINGO', 1000000),
    },
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizarPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  },
  wompi: {
    llavePublica: process.env.WOMPI_PUBLIC_KEY?.trim(),
    secretoIntegridad: process.env.WOMPI_INTEGRITY_SECRET?.trim(),
    secretoEventos: process.env.WOMPI_EVENTS_SECRET?.trim(),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    correoRemitente:
      process.env.CORREO_REMITENTE ||
      'Uniautónoma Fest <onboarding@resend.dev>',
    /** En sandbox (onboarding@resend.dev), reenvía todos los correos a esta bandeja. */
    correoSandbox: process.env.RESEND_CORREO_SANDBOX?.trim() || null,
  },
  email: {
    driver: process.env.EMAIL_DRIVER?.trim().toLowerCase() || null,
    usoResend: process.env.USO_RESEND !== 'false',
    fallbackHabilitado: obtenerBooleano('ENABLE_EMAIL_FALLBACK', false),
    smtp: {
      host: process.env.SMTP_HOST?.trim() || null,
      port: obtenerEntero('SMTP_PORT', 587),
      secure: obtenerBooleano('SMTP_SECURE', false),
      user: process.env.SMTP_USER?.trim() || null,
      pass: process.env.SMTP_PASS || null,
    },
    fromAddress:
      process.env.EMAIL_FROM_ADDRESS?.trim() ||
      process.env.CORREO_REMITENTE?.match(/<([^>]+)>/)?.[1]?.trim() ||
      process.env.CORREO_REMITENTE?.trim() ||
      null,
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'Uniautónoma Fest',
  },
  validarPagoUnicoInstitucional: process.env.VALIDAR_PAGO_UNICO_INSTITUCIONAL === 'true',
  /** Horas para reutilizar un PENDING institucional; vacío = sin límite de tiempo */
  pendingReutilizarHoras: (() => {
    const valor = process.env.PENDING_REUTILIZAR_HORAS;
    if (valor === undefined || valor === '') return null;
    const horas = Number.parseInt(valor, 10);
    return Number.isNaN(horas) || horas <= 0 ? null : horas;
  })(),
};

module.exports = { variablesEntorno };
