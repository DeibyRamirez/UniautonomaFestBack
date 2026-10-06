/**
 * Simula: paso 1 (initiate) → usuario paga en Wompi → se va sin volver.
 * Confirma vía webhook (no usa /confirmar ni polling del browser).
 *
 * Uso: node scripts/simular-pago-sin-retorno.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const { calcularChecksumEvento } = require('../src/middlewares/verifyWebhookSignature');

const puerto = Number(process.env.PUERTO || 3000);
const secreto = process.env.WOMPI_EVENTS_SECRET?.trim();

function httpJson({ method, path, body, headers = {} }) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: puerto,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
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
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function construirWebhook({ reference, amountInCents, transactionId }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const propiedades = [
    'transaction.id',
    'transaction.status',
    'transaction.amount_in_cents',
  ];
  const cuerpo = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: transactionId,
        reference,
        status: 'APPROVED',
        amount_in_cents: amountInCents,
        currency: 'COP',
      },
    },
    environment: 'test',
    signature: { properties: propiedades },
    timestamp,
  };
  cuerpo.signature.checksum = calcularChecksumEvento(cuerpo, secreto);
  return cuerpo;
}

async function main() {
  if (!secreto) {
    throw new Error('Falta WOMPI_EVENTS_SECRET en backend/.env');
  }

  console.log('[simular] Escenario: llenó paso 1, pagó en Wompi, cerró el browser\n');

  const health = await httpJson({ method: 'GET', path: '/api/health' });
  if (health.status !== 200) {
    throw new Error('Servidor no disponible. Ejecuta npm run dev o docker compose up -d');
  }

  const email = `sin-retorno-${Date.now()}@gmail.com`;
  console.log('[simular] Paso 1: POST /api/checkout/initiate');
  const initiate = await httpJson({
    method: 'POST',
    path: '/api/checkout/initiate',
    body: {
      kitType: 'general',
      personalInfo: {
        firstName: 'Sin',
        firstSurname: 'Retorno',
        email,
        documentType: 'CC',
        documentNumber: String(Date.now()).slice(-10),
        residenceCity: 'Popayán, Cauca',
        address: 'Calle 1',
        shirtSize: 'M',
      },
    },
  });

  if (initiate.status !== 201) {
    throw new Error(initiate.body?.mensaje || `initiate falló (${initiate.status})`);
  }

  const { reference, amountInCents } = initiate.body;
  console.log(`  reference: ${reference}`);
  console.log(`  amountInCents: ${amountInCents}`);
  console.log('  Firestore: status=PENDING\n');

  console.log('[simular] Usuario paga en Wompi y cierra Instagram (sin /confirmar)');
  const transactionId = `wompi-txn-${Date.now()}`;
  const payload = construirWebhook({ reference, amountInCents, transactionId });
  const webhook = await httpJson({
    method: 'POST',
    path: '/api/payments/webhook',
    body: payload,
    headers: { 'x-event-checksum': payload.signature.checksum },
  });

  console.log(`  webhook status: ${webhook.status}`);
  if (webhook.status !== 200) {
    throw new Error(`Webhook falló: ${JSON.stringify(webhook.body)}`);
  }

  console.log('\n[simular] Consultando estado (como haría soporte/admin)');
  const estado = await httpJson({
    method: 'GET',
    path: `/api/checkout/estado?reference=${encodeURIComponent(reference)}`,
  });

  if (estado.status !== 200 || estado.body?.status !== 'APPROVED') {
    throw new Error(`Estado inesperado: ${JSON.stringify(estado.body)}`);
  }

  console.log('\n=== Garantía cumplida ===');
  console.log(`  status: APPROVED`);
  console.log(`  transactionId: ${transactionId}`);
  console.log(`  uniqueClaimCode: ${estado.body.uniqueClaimCode}`);
  console.log(`  emailEnviado: ${estado.body.emailEnviado ? 'sí' : 'no'}`);
  if (estado.body.emailError) {
    console.log(`  emailError: ${estado.body.emailError}`);
  }
  console.log('\nEl pago quedó aprobado sin que el browser volviera al sitio.');
}

main().catch((error) => {
  console.error('[simular] ERROR:', error.message || error);
  process.exit(1);
});
