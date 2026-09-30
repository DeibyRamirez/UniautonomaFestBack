const { variablesEntorno } = require('../config/variablesEntorno');
const { etiquetaKit } = require('../config/catalogoKits');
const {
  validarRemitenteEmail,
  obtenerCorreoRemitenteActivo,
} = require('../utilidades/validarRemitenteEmail');
const {
  enviarCorreo,
  resolverDriver,
} = require('./email/email.factory');

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function etiquetaNumeroCorredor(tipoKit, kitComponents = []) {
  const tipo = String(tipoKit || '').trim();

  if (tipo === 'uniautonomo') {
    return 'Tu número de corredor y participación en la rifa de la moto:';
  }

  if (
    tipo === 'personalizado' &&
    Array.isArray(kitComponents) &&
    kitComponents.includes('carrera')
  ) {
    return 'Tu número de corredor:';
  }

  return null;
}

function construirHtmlCodigoReclamo({
  nombre,
  codigoReclamo,
  numeroCorredor,
  tipoKit,
  kitComponents,
  tallaCamiseta,
  correoCompradorOriginal,
}) {
  const etiqueta = etiquetaKit(tipoKit, kitComponents);
  const nombreSeguro = escaparHtml(nombre);
  const codigoSeguro = escaparHtml(codigoReclamo);
  const talla = tallaCamiseta
    ? `Talla de camiseta: <strong>${escaparHtml(tallaCamiseta)}</strong>.`
    : '';
  const bloqueNumeroCorredor = numeroCorredor
    ? (() => {
        const etiquetaNumero =
          etiquetaNumeroCorredor(tipoKit, kitComponents) || 'Tu número de corredor:';
        return (
          `<p style="color:#b8c5d9;line-height:1.6">${escaparHtml(etiquetaNumero)}</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:.08em;text-align:center;background:#123456;padding:16px;border-radius:8px;color:#6eb5ff;margin:16px 0">${escaparHtml(numeroCorredor)}</p>`
        );
      })()
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Tu código de reclamo — Uniautónoma Fest 2026</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a1628;color:#e8eef7;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#111f38;border-radius:12px;padding:32px;border:1px solid #2a4a7a">
    <p style="color:#6eb5ff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:0">Uniautónoma Fest 2026</p>
    <h1 style="font-size:22px;margin:16px 0 8px">¡Pago confirmado!</h1>
    <p style="color:#b8c5d9;line-height:1.6">Hola <strong>${nombreSeguro}</strong>, tu compra del <strong>${etiqueta}</strong> fue aprobada.</p>
    ${talla ? `<p style="color:#b8c5d9;line-height:1.6">${talla}</p>` : ''}
    ${bloqueNumeroCorredor}
    ${
      correoCompradorOriginal
        ? `<p style="color:#fbbf24;font-size:13px;line-height:1.5;background:rgba(251,191,36,.08);padding:12px;border-radius:8px;margin:0 0 16px">` +
          `Modo prueba Resend: compra registrada para <strong>${escaparHtml(correoCompradorOriginal)}</strong>. ` +
          `Este mensaje se entregó a la bandeja sandbox autorizada.</p>`
        : ''
    }
    <p style="color:#b8c5d9;line-height:1.6">Presenta este código en la sede principal para reclamar tu kit:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:.08em;text-align:center;background:#0d2847;padding:20px;border-radius:8px;color:#fff;margin:24px 0">${codigoSeguro}</p>
    <ol style="color:#b8c5d9;line-height:1.8;padding-left:20px">
      <li>Guarda este correo o anota el código.</li>
      <li>Acércate al punto de entrega con documento de identidad.</li>
      <li>Indica tu código al personal autorizado.</li>
    </ol>
    <p style="color:#8899aa;font-size:13px;margin-top:24px">Entrega en sede principal.</p>
  </div>
</body>
</html>`;
}

async function enviarCorreoCodigoReclamo({
  destinatario,
  nombre,
  codigoReclamo,
  numeroCorredor,
  tipoKit,
  kitComponents,
  tallaCamiseta,
  idPago,
  reintentarTrasError,
}) {
  const errorRemitente = validarRemitenteEmail();
  if (errorRemitente) {
    throw new Error(errorRemitente);
  }

  const remitenteCorreo = obtenerCorreoRemitenteActivo();
  const destinatarioOriginal = String(destinatario || '').trim();
  let destinatarioFinal = destinatarioOriginal;
  let correoCompradorOriginal = null;

  const bandejaSandbox = variablesEntorno.resend.correoSandbox;
  if (
    resolverDriver() === 'resend' &&
    bandejaSandbox &&
    remitenteCorreo === 'onboarding@resend.dev' &&
    destinatarioOriginal.toLowerCase() !== bandejaSandbox.toLowerCase()
  ) {
    destinatarioFinal = bandejaSandbox;
    correoCompradorOriginal = destinatarioOriginal;
    console.warn(
      '[correo] sandbox Resend: redirigiendo de',
      destinatarioOriginal,
      'a',
      bandejaSandbox
    );
  }

  const html = construirHtmlCodigoReclamo({
    nombre,
    codigoReclamo,
    numeroCorredor,
    tipoKit,
    kitComponents,
    tallaCamiseta,
    correoCompradorOriginal,
  });

  let claveIdempotencia =
    idPago != null
      ? `codigo-reclamo/${idPago}`
      : `codigo-reclamo/${codigoReclamo}`;
  if (reintentarTrasError && idPago != null) {
    claveIdempotencia = `codigo-reclamo/${idPago}/reintento-${Date.now()}`;
  }

  const resultado = await enviarCorreo({
    to: destinatarioFinal,
    subject: `Tu código de reclamo ${codigoReclamo} — Uniautónoma Fest 2026`,
    html,
    idempotencyKey: claveIdempotencia,
  });

  if (resultado?.omitido) {
    console.warn(
      '[correo] proveedor no configurado; correo no enviado a',
      destinatario
    );
    return { omitido: true };
  }

  if (!resultado.success) {
    throw resultado.error || new Error('Error desconocido al enviar correo');
  }

  console.log(
    '[correo] enviado a',
    destinatarioFinal,
    'via',
    resultado.provider,
    'id=',
    resultado.messageId || 'sin-id'
  );

  return { data: { id: resultado.messageId }, provider: resultado.provider };
}

module.exports = {
  enviarCorreoCodigoReclamo,
  construirHtmlCodigoReclamo,
  etiquetaNumeroCorredor,
};
