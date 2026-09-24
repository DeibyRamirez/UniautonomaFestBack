require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { enviarCorreoCodigoReclamo } = require('../src/services/correo.service');

async function main() {
  const destinatario = process.argv[2];
  if (!destinatario) {
    console.error('Uso: npm run probar-correo -- destino@correo.com');
    process.exit(1);
  }

  const resultado = await enviarCorreoCodigoReclamo({
    destinatario,
    nombre: 'Prueba Fest',
    codigoReclamo: 'UAF26-TEST01',
    tipoKit: 'uniautonomo',
    tallaCamiseta: 'M',
  });

  if (resultado?.omitido) {
    console.error('RESEND_API_KEY no configurada');
    process.exit(1);
  }

  console.log('Correo de prueba enviado:', resultado?.data?.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
