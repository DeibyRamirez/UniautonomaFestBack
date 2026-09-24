const pagosRepository = require('../repositories/pagos.repository');
const administradoresRepository = require('../repositories/administradores.repository');
const { obtenerAuth } = require('../config/firebase');

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
    return res.status(500).json({ mensaje: 'No se pudo obtener el listado' });
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

module.exports = {
  getPerfilAdmin,
  getAdministradores,
  getEstudiantes,
  patchEntregarKit,
  postCrearAdmin,
};
