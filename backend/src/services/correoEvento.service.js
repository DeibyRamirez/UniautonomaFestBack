const { obtenerClienteResend, correoRemitente } = require('../config/resend');
const { variablesEntorno } = require('../config/variablesEntorno');
const {
  validarRemitenteResend,
  extraerCorreoRemitente,
} = require('../utilidades/validarRemitenteResend');
const { traducirErrorResend } = require('../utilidades/traducirErrorResend');
const eventosRepository = require('../repositories/eventos.repository');

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
  const errorRemitente = validarRemitenteResend(correoRemitente);
  if (errorRemitente) {
    throw new Error(errorRemitente);
  }

  const cliente = obtenerClienteResend();
  const remitenteCorreo = extraerCorreoRemitente(correoRemitente);
  const destinatarioOriginal = String(destinatario || '').trim();
  let destinatarioFinal = destinatarioOriginal;
  let correoOriginalSandbox = null;

  const bandejaSandbox = variablesEntorno.resend.correoSandbox;
  if (
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

  if (!cliente) {
    console.warn('[correo evento] RESEND_API_KEY no configurada; correo no enviado a', destinatario);
    return { omitido: true };
  }

  const claveIdempotencia = `evento/${tipoEvento}/${idInscripcion}`;

  const resultado = await cliente.emails.send(
    {
      from: correoRemitente,
      to: destinatarioFinal,
      subject: `¡Te esperamos! — ${METADATOS_EVENTO[tipoEvento]?.titulo || 'Uniautónoma Fest 2026'}`,
      html,
    },
    { idempotencyKey: claveIdempotencia }
  );

  if (resultado?.error) {
    throw new Error(traducirErrorResend(resultado.error.message));
  }

  return resultado;
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

  try {
    const resultado = await enviarCorreoConfirmacionEvento({
      destinatario: correo,
      nombreDestinatario: nombre,
      tipoEvento,
      idInscripcion: id,
    });

    if (resultado?.omitido) {
      await eventosRepository.registrarErrorCorreo(
        tipoEvento,
        id,
        'RESEND_API_KEY no configurada'
      );
      return { enviado: false, motivo: 'resend_no_configurado' };
    }

    await eventosRepository.marcarCorreoEnviado(tipoEvento, id);
    return { enviado: true, idResend: resultado?.data?.id };
  } catch (error) {
    const mensaje = error?.message || 'Error desconocido al enviar correo';
    console.error('[correo evento] error al enviar a', correo, mensaje);
    await eventosRepository.registrarErrorCorreo(tipoEvento, id, mensaje);
    return { enviado: false, motivo: mensaje };
  }
}

module.exports = {
  construirHtmlConfirmacionEvento,
  enviarCorreoConfirmacionEvento,
  intentarEnviarCorreoInscripcionEvento,
};
