const eventosRepository = require('../repositories/eventos.repository');
const { validarInscripcionEvento } = require('../services/validacionEvento.service');
const { intentarEnviarCorreoInscripcionEvento } = require('../services/correoEvento.service');

async function postInscripcion(req, res) {
  try {
    const { tipoEvento, datos } = req.body || {};
    const { error, datos: datosValidados } = validarInscripcionEvento(tipoEvento, datos);

    if (error) {
      return res.status(400).json({ mensaje: error });
    }

    const duplicado = await eventosRepository.buscarInscripcionRecientePorCorreo(
      tipoEvento,
      datosValidados.correoElectronico
    );
    if (duplicado) {
      return res.status(409).json({
        mensaje: 'Ya registraste este correo hace pocos minutos. Revisa tu bandeja de entrada.',
      });
    }

    const creado = await eventosRepository.crearInscripcion(tipoEvento, datosValidados);
    const inscripcionCompleta = await eventosRepository.obtenerInscripcion(tipoEvento, creado.id);

    const correo = await intentarEnviarCorreoInscripcionEvento({
      ...inscripcionCompleta,
      tipoEvento,
    });

    return res.status(201).json({
      mensaje: 'Inscripción registrada. Te enviamos un correo de confirmación.',
      id: creado.id,
      correoEnviado: Boolean(correo.enviado),
    });
  } catch (err) {
    console.error('[eventos inscripcion]', err);
    return res.status(500).json({ mensaje: 'No se pudo completar la inscripción' });
  }
}

module.exports = {
  postInscripcion,
};
