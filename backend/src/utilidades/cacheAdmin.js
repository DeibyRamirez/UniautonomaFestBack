const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const pendientes = new Map();

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

async function resolverAdmin(uid, fetchFn) {
  const enCache = obtenerDeCache(uid);
  if (enCache) return enCache;

  if (pendientes.has(uid)) {
    return pendientes.get(uid);
  }

  const promesa = fetchFn()
    .then((registro) => {
      if (registro) guardarEnCache(uid, registro);
      return registro;
    })
    .finally(() => {
      pendientes.delete(uid);
    });

  pendientes.set(uid, promesa);
  return promesa;
}

function invalidarCacheAdmin(uid) {
  if (uid) {
    cache.delete(uid);
    pendientes.delete(uid);
    return;
  }
  cache.clear();
  pendientes.clear();
}

module.exports = {
  obtenerDeCache,
  guardarEnCache,
  resolverAdmin,
  invalidarCacheAdmin,
};
