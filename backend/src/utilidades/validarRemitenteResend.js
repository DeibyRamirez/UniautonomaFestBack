const DOMINIOS_NO_PERMITIDOS_COMO_REMITENTE = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
]);

function extraerCorreoRemitente(valor) {
  if (!valor || typeof valor !== 'string') return '';
  const texto = valor.trim();
  const coincidencia = texto.match(/<([^>]+)>/);
  if (coincidencia) return coincidencia[1].trim().toLowerCase();
  return texto.toLowerCase();
}

function validarRemitenteResend(correoRemitente) {
  const correo = extraerCorreoRemitente(correoRemitente);
  if (!correo || !correo.includes('@')) {
    return (
      'CORREO_REMITENTE inválido en backend/.env. Ejemplo: Uniautónoma Fest <onboarding@resend.dev>'
    );
  }

  const dominio = correo.split('@')[1];
  if (DOMINIOS_NO_PERMITIDOS_COMO_REMITENTE.has(dominio)) {
    return (
      `CORREO_REMITENTE no puede ser @${dominio}: Resend no permite enviar "desde" Gmail u otros correos personales. ` +
      'En pruebas usa: Uniautónoma Fest <onboarding@resend.dev>. ' +
      'En producción verifica tu dominio en https://resend.com/domains y usa p. ej. fest@uniautonoma.edu.co'
    );
  }

  return null;
}

module.exports = { validarRemitenteResend, extraerCorreoRemitente };
