const PATRONES_INVALIDOS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /IP_DEL_VPS/i,
  /tu-dominio/i,
  /example\.com/i,
];

function normalizarUrlBase(url) {
  if (!url || typeof url !== 'string') return null;

  let valor = url.trim();
  if (
    (valor.startsWith('"') && valor.endsWith('"')) ||
    (valor.startsWith("'") && valor.endsWith("'"))
  ) {
    valor = valor.slice(1, -1).trim();
  }

  if (!valor) return null;

  if (!/^https?:\/\//i.test(valor)) {
    valor = `https://${valor}`;
  }

  try {
    const parsed = new URL(valor);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function esUrlBaseValida(url) {
  const normalizada = normalizarUrlBase(url);
  if (!normalizada) return false;

  if (!normalizada.startsWith('https://')) return false;

  for (const patron of PATRONES_INVALIDOS) {
    if (patron.test(normalizada)) return false;
  }

  return true;
}

function construirUrlDesdeHost(protocolo, host) {
  const hostLimpio = String(host || '').trim().split(',')[0].trim();
  const protoLimpio = String(protocolo || 'https').trim().split(',')[0].trim() || 'https';
  if (!hostLimpio) return null;
  return normalizarUrlBase(`${protoLimpio}://${hostLimpio}`);
}

function resolverDesdeRequest(req) {
  if (!req || typeof req.get !== 'function') return null;

  const desdeHeaders = construirUrlDesdeHost(
    req.get('x-forwarded-proto'),
    req.get('x-forwarded-host') || req.get('host')
  );
  if (esUrlBaseValida(desdeHeaders)) return desdeHeaders;

  const origin = req.get('origin');
  if (esUrlBaseValida(origin)) return normalizarUrlBase(origin);

  const referer = req.get('referer');
  if (referer) {
    try {
      const parsed = new URL(referer);
      const desdeReferer = normalizarUrlBase(`${parsed.protocol}//${parsed.host}`);
      if (esUrlBaseValida(desdeReferer)) return desdeReferer;
    } catch {
      // ignorar referer inválido
    }
  }

  return null;
}

function resolverUrlPublica({ urlBaseEnv, req }) {
  if (esUrlBaseValida(urlBaseEnv)) {
    return normalizarUrlBase(urlBaseEnv);
  }

  const desdeRequest = resolverDesdeRequest(req);
  if (desdeRequest) return desdeRequest;

  return normalizarUrlBase(urlBaseEnv);
}

function construirRedirectUrl(urlBase) {
  const base = normalizarUrlBase(urlBase);
  if (!base || !esUrlBaseValida(base)) return null;
  return `${base}/`;
}

module.exports = {
  normalizarUrlBase,
  esUrlBaseValida,
  resolverUrlPublica,
  construirRedirectUrl,
};
