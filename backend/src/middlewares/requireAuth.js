const { obtenerAuth } = require('../config/firebase');

async function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const coincide = encabezado.match(/^Bearer\s+(.+)$/i);

  if (!coincide) {
    return res.status(401).json({ mensaje: 'Token de autenticación requerido' });
  }

  try {
    const token = coincide[1];
    const decoded = await obtenerAuth().verifyIdToken(token);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = { requireAuth };
