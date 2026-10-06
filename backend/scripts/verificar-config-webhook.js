/**
 * Verifica que backend/.env tenga lo necesario para el webhook Wompi.
 * Uso: node scripts/verificar-config-webhook.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');

const puerto = Number(process.env.PUERTO || 3000);
const urlBase = process.env.URL_BASE?.trim() || '';
const URL_WEBHOOK_PRODUCCION =
  'https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook';

const requeridas = [
  { clave: 'FIREBASE_PROJECT_ID', valor: process.env.FIREBASE_PROJECT_ID },
  { clave: 'FIREBASE_CLIENT_EMAIL', valor: process.env.FIREBASE_CLIENT_EMAIL },
  { clave: 'FIREBASE_PRIVATE_KEY', valor: process.env.FIREBASE_PRIVATE_KEY },
  { clave: 'WOMPI_PUBLIC_KEY', valor: process.env.WOMPI_PUBLIC_KEY },
  { clave: 'WOMPI_INTEGRITY_SECRET', valor: process.env.WOMPI_INTEGRITY_SECRET },
  { clave: 'WOMPI_EVENTS_SECRET', valor: process.env.WOMPI_EVENTS_SECRET },
];

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(path) {
  return httpRequest(
    { hostname: 'localhost', port: puerto, path, method: 'GET' },
    null
  );
}

async function probarEndpointPublico(url) {
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    return { ok: true, status: respuesta.status };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function main() {
  console.log('=== Verificación webhook Wompi ===\n');
  console.log('Archivo de entorno: backend/.env (no .env.real)\n');

  let faltantes = 0;
  for (const { clave, valor } of requeridas) {
    const ok = Boolean(valor && String(valor).trim());
    console.log(`  ${ok ? 'OK' : 'FALTA'}  ${clave}`);
    if (!ok) faltantes++;
  }

  const esSandbox =
    /test|sandbox|pub_test/i.test(process.env.WOMPI_PUBLIC_KEY || '') ||
    /test|sandbox/i.test(process.env.WOMPI_EVENTS_SECRET || '');

  console.log(`\n  Entorno Wompi detectado: ${esSandbox ? 'sandbox/test' : 'producción (revisa llaves)'}`);

  console.log('\n--- URLs a registrar en Wompi ---');
  console.log('  Producción:');
  console.log('    https://uniautonomafest.uniautonoma.edu.co/api/payments/webhook');
  console.log('  Pruebas locales (ngrok):');
  console.log('    https://<tu-subdominio-ngrok>/api/payments/webhook');
  if (urlBase && !/localhost|127\.0\.0\.1/i.test(urlBase)) {
    console.log(`  URL_BASE actual: ${urlBase.replace(/\/$/, '')}/api/payments/webhook`);
  }

  console.log('\n--- Servidor local ---');
  try {
    const health = await httpGet('/api/health');
    if (health.status === 200) {
      console.log(`  OK  http://localhost:${puerto}/api/health`);
    } else {
      console.log(`  WARN  health respondió ${health.status}`);
    }
  } catch {
    console.log(`  FALTA  servidor no responde en puerto ${puerto}`);
    console.log('         Ejecuta: docker compose up -d  o  cd backend && npm run dev');
    faltantes++;
  }

  console.log('\n--- Endpoint webhook (ruta expuesta) ---');
  try {
    const sinFirma = await httpRequest(
      {
        hostname: 'localhost',
        port: puerto,
        path: '/api/payments/webhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      '{}'
    );
    if (sinFirma.status === 401) {
      console.log('  OK  POST /api/payments/webhook responde 401 sin firma (ruta activa)');
    } else if (sinFirma.status === 500) {
      console.log('  WARN  webhook responde 500 sin firma (revisa WOMPI_EVENTS_SECRET)');
    } else {
      console.log(`  WARN  webhook respondió HTTP ${sinFirma.status} (esperado 401 sin firma)`);
    }
  } catch {
    console.log('  SKIP  no se pudo probar webhook local (servidor apagado)');
  }

  console.log('\n--- Producción (solo conectividad HTTP) ---');
  const prod = await probarEndpointPublico(URL_WEBHOOK_PRODUCCION);
  if (prod.ok) {
    const interpretacion =
      prod.status === 401
        ? 'ruta activa, falta firma Wompi (normal)'
        : prod.status === 500
          ? 'servidor responde; revisa logs si Wompi reporta fallos'
          : `HTTP ${prod.status}`;
    console.log(`  OK  ${URL_WEBHOOK_PRODUCCION}`);
    console.log(`      ${interpretacion}`);
  } else {
    console.log(`  WARN  no se alcanzó producción: ${prod.error}`);
    console.log('        Registra la URL en Wompi producción cuando el sitio esté en línea.');
  }

  console.log('\n--- Próximos pasos ---');
  if (faltantes > 0) {
    console.log('  1. Completa las variables faltantes en backend/.env');
  }
  if (!process.env.WOMPI_EVENTS_SECRET?.trim()) {
    console.log('  2. Registra webhook en Wompi y copia Events Secret → WOMPI_EVENTS_SECRET');
  }
  console.log('  3. ngrok http 3000  → registra URL en Wompi sandbox');
  console.log('  4. npm run simular-pago-sin-retorno');
  console.log('\nGuía completa: docs/ACTIVAR-WEBHOOK-WOMPI.md');
  console.log('Respaldo operativo: docs/RESPALDO-PAGOS-PENDIENTES.md');

  if (faltantes > 0) {
    process.exit(1);
  }
  console.log('\nConfiguración lista para pruebas.');
}

main().catch((error) => {
  console.error('ERROR:', error.message || error);
  process.exit(1);
});
