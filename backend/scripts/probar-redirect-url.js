/**
 * Prueba la resolución de redirectUrl (escenario producción con URL_BASE rota).
 * Uso: node scripts/probar-redirect-url.js
 */
const {
  resolverUrlPublica,
  construirRedirectUrl,
  esUrlBaseValida,
} = require('../src/utilidades/resolverUrlPublica');

function crearRequest(headers) {
  return {
    get(nombre) {
      const clave = String(nombre || '').toLowerCase();
      return headers[clave] ?? null;
    },
  };
}

const casos = [
  {
    nombre: 'Producción: URL_BASE placeholder + headers Vercel',
    urlBaseEnv: 'http://IP_DEL_VPS:3000',
    req: crearRequest({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'uniautonomafest.uniautonoma.edu.co',
    }),
    esperado: 'https://uniautonomafest.uniautonoma.edu.co/',
  },
  {
    nombre: 'Local: localhost sin headers de producción',
    urlBaseEnv: 'http://localhost:3000',
    req: crearRequest({ host: 'localhost:3000' }),
    esperado: null,
  },
  {
    nombre: 'Producción: URL_BASE correcta',
    urlBaseEnv: 'https://uniautonomafest.uniautonoma.edu.co',
    req: crearRequest({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'uniautonomafest.uniautonoma.edu.co',
    }),
    esperado: 'https://uniautonomafest.uniautonoma.edu.co/',
  },
];

let fallos = 0;

console.log('--- Prueba redirectUrl ---\n');

for (const caso of casos) {
  const urlBase = resolverUrlPublica({
    urlBaseEnv: caso.urlBaseEnv,
    req: caso.req,
  });
  const redirectUrl = construirRedirectUrl(urlBase);
  const ok = redirectUrl === caso.esperado;

  console.log(`${ok ? 'OK' : 'FALLO'} | ${caso.nombre}`);
  console.log(`  URL_BASE env: ${caso.urlBaseEnv}`);
  console.log(`  redirectUrl:    ${redirectUrl ?? '(omitida)'}`);
  if (!ok) {
    console.log(`  esperado:       ${caso.esperado ?? '(omitida)'}`);
    fallos += 1;
  }
  console.log('');
}

console.log(`Placeholder inválido: ${!esUrlBaseValida('http://IP_DEL_VPS:3000') ? 'OK' : 'FALLO'}`);

if (fallos > 0) {
  console.error(`\n${fallos} caso(s) fallaron.`);
  process.exit(1);
}

console.log('\nTodas las pruebas pasaron.');
