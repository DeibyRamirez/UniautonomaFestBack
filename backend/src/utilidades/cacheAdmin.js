const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function obtenerDeCache(uid) {
  const entrada = cache.get(uid);
  if (!entrada) return null;
  if (Date.now() > entrada.expira) {
    cache.delete(uid);
    return null;
  }
  return entrada.registro;
}

function guardarEnCache(uid, registro) {
  cache.set(uid, {
    registro,
    expira: Date.now() + TTL_MS,
  });
}

function invalidarCacheAdmin(uid) {
  if (uid) {
    cache.delete(uid);
    return;
  }
  cache.clear();
}

module.exports = {
  obtenerDeCache,
  guardarEnCache,
  invalidarCacheAdmin,
};
