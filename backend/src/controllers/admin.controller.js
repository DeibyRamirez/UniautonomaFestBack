const pagosRepository = require('../repositories/pagos.repository');
const eventosRepository = require('../repositories/eventos.repository');
const administradoresRepository = require('../repositories/administradores.repository');
const { obtenerAuth } = require('../config/firebase');
const { invalidarCacheAdmin } = require('../utilidades/cacheAdmin');
const { validarTipoEvento } = require('../services/validacionEvento.service');
const { intentarEnviarCorreoReclamo } = require('../services/correoReclamo.service');
const { registrarManualAprobado } = require('../services/registroManual.service');

function esSolicitudExportacion(limite) {
  const valor = Number.parseInt(String(limite), 10);
  return Number.isFinite(valor) && valor >= 100;
}

function rechazarExportacionSiNoEsSuperAdmin(req, res) {
  if (esSolicitudExportacion(req.query.limit) && req.admin?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ mensaje: 'Exportación reservada a super administradores' });
  }
  return null;
}

async function getPerfilAdmin(req, res) {
  try {
    const registro = req.admin;
    return res.json({
      email: registro.email,
      role: registro.role,
      esSuperAdmin: registro.role === 'SUPER_ADMIN',
    });
  } catch (error) {
    console.error('[admin perfil]', error);
    return res.status(500).json({ mensaje: 'No se pudo obtener el perfil' });
  }
}

async function getAdministradores(req, res) {
  try {
    const datos = await administradoresRepository.listarAdministradores();
    return res.json({ datos });
  } catch (error) {
    console.error('[admin listar administradores]', error);
    return res.status(500).json({ mensaje: 'No se pudo listar administradores' });
  }
}

async function getEstudiantes(req, res) {
  try {
    const bloqueoExport = rechazarExportacionSiNoEsSuperAdmin(req, res);
    if (bloqueoExport) return bloqueoExport;

    const status = req.query.status || undefined;
    const search = req.query.search || undefined;
    const cursor = req.query.cursor || undefined;
    const limite = req.query.limit || undefined;
    const resultado = await pagosRepository.listarPagos({
      status,
      busqueda: search,
      cursor,
      limite,
    });
    return res.json(resultado);
  } catch (error) {
    console.error('[admin estudiantes]', error);
    const detalle = String(error.details || error.message || '');
    if (
      error.code === 9 ||
      detalle.includes('requires an index') ||
      detalle.includes('currently building')
    ) {
      return res.status(503).json({
        mensaje:
          'Los índices de búsqueda de Firebase se están creando. Espera unos minutos y recarga, o busca por nombre.',
      });
    }
    return res.status(500).json({ mensaje: 'No se pudo obtener el listado' });
  }
}

async function getBootstrapAdmin(req, res) {
  try {
    const registro = req.admin;
    const status = req.query.status || undefined;
    const search = req.query.search || undefined;
    const limite = req.query.limit || undefined;
    const resultado = await pagosRepository.listarPagos({
      status,
      busqueda: search,
      limite,
    });

    return res.json({
      perfil: {
        email: registro.email,
        role: registro.role,
        esSuperAdmin: registro.role === 'SUPER_ADMIN',
      },
      datos: resultado.datos,
      paginacion: resultado.paginacion,
    });
  } catch (error) {
    console.error('[admin bootstrap]', error);
    const detalle = String(error.details || error.message || '');
    if (
      error.code === 9 ||
      detalle.includes('requires an index') ||
      detalle.includes('currently building')
    ) {
      return res.status(503).json({
        mensaje:
          'Los índices de búsqueda de Firebase se están creando. Espera unos minutos y recarga.',
      });
    }
    return res.status(500).json({ mensaje: 'No se pudo cargar el panel administrativo' });
  }
}

async function patchEntregarKit(req, res) {
  try {
    const { id } = req.params;
    const pago = await pagosRepository.obtenerPorId(id);

    if (!pago) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }

    if (pago.status !== 'APPROVED') {
      return res.status(400).json({ mensaje: 'Solo se pueden entregar kits con pago aprobado' });
    }

    if (pago.kitClaimed) {
      return res.status(400).json({ mensaje: 'El kit ya fue marcado como entregado' });
    }

    const correoAdmin = req.admin?.email || req.usuario?.email;
    await pagosRepository.marcarEntregado(id, correoAdmin);

    const actualizado = await pagosRepository.obtenerPorId(id);
    return res.json({ mensaje: 'Kit marcado como entregado', dato: actualizado });
  } catch (error) {
    console.error('[admin entregar]', error);
    return res.status(500).json({ mensaje: 'Error al marcar entrega' });
  }
}

async function postCrearAdmin(req, res) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    const rol = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    const usuario = await obtenerAuth().createUser({
      email: String(email).trim().toLowerCase(),
      password,
      emailVerified: true,
    });

    await obtenerAuth().setCustomUserClaims(usuario.uid, {
      admin: true,
      superAdmin: rol === 'SUPER_ADMIN',
    });

    await administradoresRepository.guardarAdministrador({
      uid: usuario.uid,
      email: usuario.email,
      role: rol,
    });
    invalidarCacheAdmin(usuario.uid);

    return res.status(201).json({
      mensaje: 'Administrador creado',
      uid: usuario.uid,
      email: usuario.email,
      role: rol,
    });
  } catch (error) {
    console.error('[admin crear]', error);
    return res.status(500).json({
      mensaje: error.message || 'No se pudo crear el administrador',
    });
  }
}

async function postReenviarCorreo(req, res) {
  try {
    const { id } = req.params;
    const pago = await pagosRepository.obtenerPorId(id);

    if (!pago) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }

    if (pago.status !== 'APPROVED' || !pago.uniqueClaimCode) {
      return res.status(400).json({
        mensaje: 'Solo se puede reenviar correo de pagos aprobados con código de reclamo',
      });
    }

    const resultado = await intentarEnviarCorreoReclamo(pago, { forzarReenvio: true });

    if (resultado.enviado) {
      return res.json({
        mensaje: 'Correo reenviado correctamente',
        enviado: true,
        idResend: resultado.idResend || null,
      });
    }

    return res.status(502).json({
      mensaje: resultado.motivo || 'No se pudo reenviar el correo',
      enviado: false,
    });
  } catch (error) {
    console.error('[admin reenviar correo]', error);
    return res.status(500).json({ mensaje: 'No se pudo reenviar el correo' });
  }
}

async function postAsignarNumeroCorredor(req, res) {
  try {
    const { id } = req.params;
    const resultado = await pagosRepository.asignarNumeroPendiente(id);
    const pago = await pagosRepository.obtenerPorId(id);

    if (!resultado.idempotente && pago) {
      await intentarEnviarCorreoReclamo(pago, { forzarReenvio: true });
    }

    return res.json({
      mensaje: resultado.idempotente
        ? 'El registro ya tenía número de corredor'
        : 'Número de corredor asignado',
      numeroCorredor: resultado.numeroCorredor,
      dato: pago,
    });
  } catch (error) {
    const codigo = error.codigo || 500;
    if (codigo >= 500) console.error('[admin asignar numero]', error);
    return res.status(codigo).json({
      mensaje: error.message || 'No se pudo asignar el número de corredor',
    });
  }
}

async function getInscripcionesEventos(req, res) {
  try {
    const bloqueoExport = rechazarExportacionSiNoEsSuperAdmin(req, res);
    if (bloqueoExport) return bloqueoExport;

    const tipoEvento = req.query.tipoEvento;
    const errorTipo = validarTipoEvento(tipoEvento);
    if (errorTipo) {
      return res.status(400).json({ mensaje: errorTipo });
    }

    const resultado = await eventosRepository.listarInscripciones({
      tipoEvento,
      busqueda: req.query.search,
      cursor: req.query.cursor,
      limite: req.query.limit,
    });

    return res.json({
      tipoEvento,
      ...resultado,
    });
  } catch (error) {
    console.error('[admin eventos]', error);
    return res.status(500).json({ mensaje: 'No se pudo obtener inscripciones de eventos' });
  }
}

async function postRegistroManual(req, res) {
  try {
    const {
      kitType,
      kitComponents,
      personalInfo,
      origenRegistro,
      transactionId,
      notas,
      enviarCorreo,
    } = req.body || {};

    const resultado = await registrarManualAprobado({
      kitType,
      kitComponents,
      personalInfo,
      origenRegistro,
      transactionId,
      notas,
      enviarCorreo: Boolean(enviarCorreo),
      registradoPorAdminEmail: req.admin?.email || req.usuario?.email,
    });

    return res.status(201).json({
      mensaje: 'Registro manual creado correctamente',
      dato: resultado,
    });
  } catch (error) {
    const codigo = error.codigo || 500;
    if (codigo >= 500) console.error('[admin registro manual]', error);
    return res.status(codigo).json({
      mensaje: error.message || 'No se pudo crear el registro manual',
    });
  }
}

module.exports = {
  getPerfilAdmin,
  getAdministradores,
  getEstudiantes,
  getBootstrapAdmin,
  getInscripcionesEventos,
  patchEntregarKit,
  postCrearAdmin,
  postReenviarCorreo,
  postAsignarNumeroCorredor,
  postRegistroManual,
};
