/**
 * Prueba POST /api/checkout/initiate en local (servidor en PUERTO).
 * Uso: node scripts/probar-checkout-api-local.js
 */
const http = require('http');

const puerto = Number(process.env.PUERTO || 3000);
const cuerpo = JSON.stringify({
  kitType: 'general',
  personalInfo: {
    firstName: 'Test',
    firstSurname: 'Diag',
    email: `test-redirect-api-${Date.now()}@example.com`,
    documentType: 'CC',
    documentNumber: '9876543210',
    residenceCity: 'Cali, Valle del Cauca',
    address: 'Calle 1',
    shirtSize: 'M',
  },
});

function postInitiate(headersExtra) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: puerto,
        path: '/api/checkout/initiate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(cuerpo),
          ...headersExtra,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (error) {
            reject(new Error(`Respuesta no JSON (${res.statusCode}): ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

async function main() {
  const local = await postInitiate({});
  console.log('Local (sin headers producción):');
  console.log(`  status: ${local.status}`);
  console.log(`  redirectUrl: ${local.body.redirectUrl ?? '(omitida)'}`);

  const prod = await postInitiate({
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'uniautonomafest.uniautonoma.edu.co',
  });
  console.log('\nSimulando producción (headers Vercel):');
  console.log(`  status: ${prod.status}`);
  console.log(`  redirectUrl: ${prod.body.redirectUrl ?? '(omitida)'}`);

  if (prod.status !== 201) {
    throw new Error(prod.body.mensaje || 'initiate falló en simulación producción');
  }

  if (prod.body.redirectUrl !== 'https://uniautonomafest.uniautonoma.edu.co/') {
    throw new Error(`redirectUrl inesperada: ${prod.body.redirectUrl}`);
  }

  console.log('\nPrueba API local OK.');
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
