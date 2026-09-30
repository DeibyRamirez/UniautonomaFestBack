require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { variablesEntorno } = require('../src/config/variablesEntorno');
const {
  enviarCorreoConfirmacionEvento,
} = require('../src/services/correoEvento.service');
const { resolverDriver } = require('../src/services/email/email.factory');
const {
  mostrarAvisoMailtrapSandbox,
} = require('../src/utilidades/avisoMailtrapSandbox');

async function main() {
  const destinatario = process.argv[2];
  const tipoEvento = process.argv[3] || 'Hackton';

  if (!destinatario) {
    console.error(
      'Uso: npm run probar-correo-evento -- destino@correo.com [Hackton|FeriaEmprendimiento]'
    );
    process.exit(1);
  }

  console.log(`[correo] driver=${resolverDriver()}`);
  mostrarAvisoMailtrapSandbox(variablesEntorno.email.smtp.host);

  const resultado = await enviarCorreoConfirmacionEvento({
    destinatario,
    nombreDestinatario: 'Prueba Fest',
    tipoEvento,
    idInscripcion: `test-${Date.now()}`,
  });

  if (resultado?.omitido) {
    console.error('Proveedor de correo no configurado. Revisa backend/.env');
    process.exit(1);
  }

  console.log(
    'Correo de evento enviado:',
    resultado?.data?.id,
    `(via ${resultado?.provider || resolverDriver()})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
