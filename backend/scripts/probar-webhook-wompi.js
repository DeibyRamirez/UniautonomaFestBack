/**
 * Prueba POST /api/payments/webhook con firma Wompi válida.
 * Requiere servidor en PUERTO y backend/.env (nunca .env.real).
 *
 * Uso:
 *   node scripts/probar-webhook-wompi.js
 *   node scripts/probar-webhook-wompi.js --reference Unifest26-PAY-XXXXX
 *   node scripts/probar-webhook-wompi.js --sin-firma
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const { calcularChecksumEvento } = require('../src/middlewares/verifyWebhookSignature');

const puerto = Number(process.env.PUERTO || 3000);
const secreto = process.env.WOMPI_EVENTS_SECRET?.trim();
const args = process.argv.slice(2);
const referenceArg = args.includes('--reference')
  ? args[args.indexOf('--reference') + 1]
  : null;
const sinFirma = args.includes('--sin-firma');

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
          let parsed = data;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            // mantener texto
          }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function crearPagoPendiente() {
  const email = `webhook-test-${Date.now()}@example.com`;
  const cuerpo = {
    kitType: 'general',
    personalInfo: {
      firstName: 'Webhook',
      firstSurname: 'Test',
      email,
      documentType: 'CC',
      documentNumber: String(Date.now()).slice(-10),
      residenceCity: 'Popayán, Cauca',
      address: 'Calle prueba',
      shirtSize: 'M',
    },
  };

  const respuesta = await httpJson({
    method: 'POST',
    path: '/api/checkout/initiate',
    body: cuerpo,
  });

  if (respuesta.status !== 201) {
    throw new Error(
      respuesta.body?.mensaje || `initiate falló con status ${respuesta.status}`
    );
  }

  return {
    reference: respuesta.body.reference,
    amountInCents: respuesta.body.amountInCents,
    email,
  };
}

function construirPayloadWebhook({ reference, amountInCents, transactionId }) {
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

  if (secreto && !sinFirma) {
    cuerpo.signature.checksum = calcularChecksumEvento(cuerpo, secreto);
  }

  return cuerpo;
}

async function main() {
  if (!secreto && !sinFirma) {
    throw new Error('Falta WOMPI_EVENTS_SECRET en backend/.env');
  }

  console.log(`[webhook-test] servidor http://localhost:${puerto}`);

  const health = await httpJson({ method: 'GET', path: '/api/health' });
  if (health.status !== 200) {
    throw new Error('El servidor no responde en /api/health. Ejecuta npm run dev o docker compose up.');
  }

  let reference = referenceArg;
  let amountInCents = Number(process.env.MONTO_KIT_GENERAL || 8000000);

  if (sinFirma) {
    reference = reference || 'Unifest26-PAY-TEST-SIN-FIRMA';
  } else if (!reference) {
    console.log('[webhook-test] Creando pago PENDING vía /api/checkout/initiate…');
    const creado = await crearPagoPendiente();
    reference = creado.reference;
    amountInCents = creado.amountInCents;
    console.log(`  reference: ${reference}`);
    console.log(`  amountInCents: ${amountInCents}`);
  } else if (!sinFirma) {
    console.log(`[webhook-test] Usando reference existente: ${reference}`);
  }

  const transactionId = `test-txn-${Date.now()}`;
  const payload = construirPayloadWebhook({ reference, amountInCents, transactionId });

  const headers = {};
  if (payload.signature?.checksum) {
    headers['x-event-checksum'] = payload.signature.checksum;
  }

  if (sinFirma) {
    console.log('[webhook-test] Enviando evento sin firma (debe responder 401)…');
  } else {
    console.log('[webhook-test] Enviando transaction.updated APPROVED…');
  }
  const webhook = await httpJson({
    method: 'POST',
    path: '/api/payments/webhook',
    body: payload,
    headers,
  });

  console.log(`  status webhook: ${webhook.status}`);
  if (webhook.body) console.log(`  body: ${JSON.stringify(webhook.body)}`);

  if (sinFirma) {
    if (webhook.status !== 401) {
      throw new Error(`Se esperaba 401 sin firma, recibido ${webhook.status}`);
    }
    console.log('\nPrueba sin firma OK (401).');
    return;
  }

  if (webhook.status !== 200) {
    throw new Error(`Webhook falló con status ${webhook.status}`);
  }

  const estado = await httpJson({
    method: 'GET',
    path: `/api/checkout/estado?reference=${encodeURIComponent(reference)}`,
  });

  console.log(`  status estado: ${estado.status}`);
  console.log(`  pago: ${JSON.stringify(estado.body, null, 2)}`);

  if (estado.status !== 200) {
    throw new Error('No se pudo consultar estado del pago');
  }

  if (estado.body?.status !== 'APPROVED') {
    throw new Error(`Se esperaba APPROVED, recibido ${estado.body?.status}`);
  }

  if (!estado.body?.uniqueClaimCode) {
    throw new Error('El pago aprobado no tiene uniqueClaimCode');
  }

  console.log('\nPrueba webhook OK.');
  console.log(`  codigo reclamo: ${estado.body.uniqueClaimCode}`);
  console.log(`  email enviado: ${estado.body.emailEnviado ? 'sí' : 'no (revisa correo/config)'}`);
}

main().catch((error) => {
  console.error('[webhook-test] ERROR:', error.message || error);
  process.exit(1);
});
