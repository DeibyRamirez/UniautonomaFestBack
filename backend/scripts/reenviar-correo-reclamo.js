/**
 * Reintenta el correo de código de reclamo para un pago ya APPROVED.
 * Uso: npm run reenviar-correo -- UAF26-PAY-9CB4D23AC1
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pagosRepository = require('../src/repositories/pagos.repository');
const { intentarEnviarCorreoReclamo } = require('../src/services/correoReclamo.service');

async function main() {
  const referencia = process.argv[2];
  if (!referencia) {
    console.error('Uso: npm run reenviar-correo -- UAF26-PAY-XXXXXXXX');
    process.exit(1);
  }

  const pago = await pagosRepository.buscarPorReferencia(referencia.trim());
  if (!pago) {
    console.error('Pago no encontrado:', referencia);
    process.exit(1);
  }
  if (pago.status !== 'APPROVED' || !pago.uniqueClaimCode) {
    console.error('El pago no está aprobado o no tiene código de reclamo.');
    process.exit(1);
  }

  const resultado = await intentarEnviarCorreoReclamo(pago);
  if (resultado.enviado) {
    console.log('Correo enviado. id Resend:', resultado.idResend || '—');
    process.exit(0);
  }

  console.error('No se envió:', resultado.motivo);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
