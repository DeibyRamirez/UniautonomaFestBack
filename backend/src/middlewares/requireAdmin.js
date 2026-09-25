const administradoresRepository = require('../repositories/administradores.repository');
const {
  obtenerDeCache,
  guardarEnCache,
} = require('../utilidades/cacheAdmin');

async function requireAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ mensaje: 'No autenticado' });
  }

  const esAdminClaim = req.usuario.admin === true;
  if (!esAdminClaim) {
    return res.status(403).json({ mensaje: 'Acceso reservado a administradores' });
  }

  let registro = obtenerDeCache(req.usuario.uid);
  if (!registro) {
    registro = await administradoresRepository.obtenerPorUid(req.usuario.uid);
    if (registro) {
      guardarEnCache(req.usuario.uid, registro);
    }
  }

  if (!registro || !['ADMIN', 'SUPER_ADMIN'].includes(registro.role)) {
    return res.status(403).json({ mensaje: 'Rol de administrador no registrado' });
  }

  req.admin = registro;
  next();
}

module.exports = { requireAdmin };
