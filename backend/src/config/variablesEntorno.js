require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

function obtenerEntero(nombre, valorPorDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return valorPorDefecto;
  const numero = Number.parseInt(valor, 10);
  return Number.isNaN(numero) ? valorPorDefecto : numero;
}

const variablesEntorno = {
  puerto: obtenerEntero('PUERTO', 3000),
  urlBase: process.env.URL_BASE || 'http://localhost:3000',
  montos: {
    uniautonomo: obtenerEntero('MONTO_KIT_UNIAUTONOMO', 7500000),
    general: obtenerEntero('MONTO_KIT_GENERAL', 8000000),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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
    correoRemitente: process.env.CORREO_REMITENTE || 'fest@uniautonoma.edu.co',
    /** En sandbox (onboarding@resend.dev), reenvía todos los correos a esta bandeja. */
    correoSandbox: process.env.RESEND_CORREO_SANDBOX?.trim() || null,
  },
};

module.exports = { variablesEntorno };
