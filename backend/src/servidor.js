const app = require('./app');
const { variablesEntorno } = require('./config/variablesEntorno');

process.env.SERVIR_ESTATICOS = 'true';

const puerto = variablesEntorno.puerto;

if (!variablesEntorno.resend.apiKey) {
  console.warn(
    '[aviso] RESEND_API_KEY no configurada: no se enviarán correos de reclamo.'
  );
}

const servidor = app.listen(puerto, () => {
  console.log(`API Uniautónoma Fest escuchando en http://localhost:${puerto}`);
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[servidor] El puerto ${puerto} ya está en uso: hay otra instancia del backend corriendo. ` +
        'Ciérrala (o cambia PUERTO en .env) antes de iniciar esta.'
    );
    process.exit(1);
  }
  throw error;
});
