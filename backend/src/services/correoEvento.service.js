const { variablesEntorno } = require('../config/variablesEntorno');
const {
  validarRemitenteEmail,
  obtenerCorreoRemitenteActivo,
} = require('../utilidades/validarRemitenteEmail');
const {
  enviarCorreo,
  resolverDriver,
} = require('./email/email.factory');
const eventosRepository = require('../repositories/eventos.repository');

const TIMEOUT_CORREO_MS = 8000;
const TIEMPO_AGOTADO = Symbol('tiempoAgotado');

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const METADATOS_EVENTO = {
  Hackton: {
    titulo: 'Hackatón — Desafío Uniautónomo',
    detalle: 'Te esperamos el 20 de octubre en la Sede Campestre El Aljibe.',
  },
  FeriaEmprendimiento: {
    titulo: 'Feria de Emprendimiento',
    detalle: 'Te esperamos el 22 de octubre en la sede principal.',
  },
};

function construirHtmlConfirmacionEvento({
  nombreDestinatario,
  tipoEvento,
  correoOriginalSandbox,
}) {
  const meta = METADATOS_EVENTO[tipoEvento] || {
    titulo: 'Uniautónoma Fest 2026',
    detalle: 'Te esperamos en el fest.',
  };
  const nombreSeguro = escaparHtml(nombreDestinatario);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>¡Te esperamos! — Uniautónoma Fest 2026</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a1628;color:#e8eef7;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#111f38;border-radius:12px;padding:32px;border:1px solid #2a4a7a">
    <p style="color:#6eb5ff;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:0">Uniautónoma Fest 2026</p>
    <h1 style="font-size:22px;margin:16px 0 8px">¡Te esperamos!</h1>
    <p style="color:#b8c5d9;line-height:1.6">Hola <strong>${nombreSeguro}</strong>, tu inscripción a <strong>${escaparHtml(meta.titulo)}</strong> quedó registrada.</p>
    <p style="color:#b8c5d9;line-height:1.6">${escaparHtml(meta.detalle)}</p>
    ${
      correoOriginalSandbox
        ? `<p style="color:#fbbf24;font-size:13px;line-height:1.5;background:rgba(251,191,36,.08);padding:12px;border-radius:8px;margin:16px 0 0">` +
          `Modo prueba Resend: inscripción para <strong>${escaparHtml(correoOriginalSandbox)}</strong>. ` +
          `Este mensaje se entregó a la bandeja sandbox autorizada.</p>`
        : ''
    }
    <p style="color:#8899aa;font-size:13px;margin-top:24px">Guarda este correo como comprobante. Nos vemos en el fest.</p>
  </div>
</body>
</html>`;
}

async function enviarCorreoConfirmacionEvento({
  destinatario,
  nombreDestinatario,
  tipoEvento,
  idInscripcion,
}) {
  const errorRemitente = validarRemitenteEmail();
  if (errorRemitente) {
    throw new Error(errorRemitente);
  }

  const remitenteCorreo = obtenerCorreoRemitenteActivo();
  const destinatarioOriginal = String(destinatario || '').trim();
  let destinatarioFinal = destinatarioOriginal;
  let correoOriginalSandbox = null;

  const bandejaSandbox = variablesEntorno.resend.correoSandbox;
  if (
    resolverDriver() === 'resend' &&
    bandejaSandbox &&
    remitenteCorreo === 'onboarding@resend.dev' &&
    destinatarioOriginal.toLowerCase() !== bandejaSandbox.toLowerCase()
  ) {
    destinatarioFinal = bandejaSandbox;
    correoOriginalSandbox = destinatarioOriginal;
  }

  const html = construirHtmlConfirmacionEvento({
    nombreDestinatario,
    tipoEvento,
    correoOriginalSandbox,
  });

  const claveIdempotencia = `evento/${tipoEvento}/${idInscripcion}`;

  const resultado = await enviarCorreo({
    to: destinatarioFinal,
    subject: `¡Te esperamos! — ${METADATOS_EVENTO[tipoEvento]?.titulo || 'Uniautónoma Fest 2026'}`,
    html,
    idempotencyKey: claveIdempotencia,
  });

  if (resultado?.omitido) {
    console.warn(
      '[correo evento] proveedor no configurado; correo no enviado a',
      destinatario
    );
    return { omitido: true };
  }

  if (!resultado.success) {
    throw resultado.error || new Error('Error desconocido al enviar correo');
  }

  return { data: { id: resultado.messageId }, provider: resultado.provider };
}

function nombreParaCorreo(tipoEvento, datos) {
  if (tipoEvento === 'Hackton') {
    return [datos.nombres, datos.apellidos].filter(Boolean).join(' ');
  }
  return [datos.nombre, datos.apellido].filter(Boolean).join(' ');
}

async function intentarEnviarCorreoInscripcionEvento(inscripcion) {
  const { id, tipoEvento } = inscripcion;
  if (!id || !tipoEvento) {
    return { enviado: false, motivo: 'datos_incompletos' };
  }

  if (inscripcion.emailEnviadoEn) {
    return { enviado: true, idempotente: true };
  }

  const correo = inscripcion.correoElectronico;
  const nombre = nombreParaCorreo(tipoEvento, inscripcion) || 'participante';

  let temporizador;
  const limiteTiempo = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver(TIEMPO_AGOTADO), TIMEOUT_CORREO_MS);
  });

  try {
    const envio = enviarCorreoConfirmacionEvento({
      destinatario: correo,
      nombreDestinatario: nombre,
      tipoEvento,
      idInscripcion: id,
    });

    const resultado = await Promise.race([envio, limiteTiempo]);

    if (resultado === TIEMPO_AGOTADO) {
      console.warn('[correo evento] Resend no respondió a tiempo para', correo);
      envio.catch(() => {});
      return { enviado: false, motivo: 'timeout' };
    }

    if (resultado?.omitido) {
      await eventosRepository.registrarErrorCorreo(
        tipoEvento,
        id,
        'Proveedor de correo no configurado'
      );
      return { enviado: false, motivo: 'correo_no_configurado' };
    }

    await eventosRepository.marcarCorreoEnviado(tipoEvento, id);
    return {
      enviado: true,
      idMensaje: resultado?.data?.id,
      idResend: resultado?.data?.id,
      proveedor: resultado?.provider,
    };
  } catch (error) {
    const mensaje = error?.message || 'Error desconocido al enviar correo';
    console.error('[correo evento] error al enviar a', correo, mensaje);
    await eventosRepository.registrarErrorCorreo(tipoEvento, id, mensaje);
    return { enviado: false, motivo: mensaje };
  } finally {
    clearTimeout(temporizador);
  }
}

module.exports = {
  construirHtmlConfirmacionEvento,
  enviarCorreoConfirmacionEvento,
  intentarEnviarCorreoInscripcionEvento,
};
