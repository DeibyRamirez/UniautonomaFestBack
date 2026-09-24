const administradoresRepository = require('../repositories/administradores.repository');

async function requireSuperAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ mensaje: 'No autenticado' });
  }

  const esSuperClaim = req.usuario.superAdmin === true;
  const registro = await administradoresRepository.obtenerPorUid(req.usuario.uid);

  if (!esSuperClaim || !registro || registro.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ mensaje: 'Acceso reservado a super administradores' });
  }

  req.admin = registro;
  next();
}

module.exports = { requireSuperAdmin };
