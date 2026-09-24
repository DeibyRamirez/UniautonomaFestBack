const app = require('./app');
const { variablesEntorno } = require('./config/variablesEntorno');

process.env.SERVIR_ESTATICOS = 'true';

const puerto = variablesEntorno.puerto;

if (!variablesEntorno.resend.apiKey) {
  console.warn(
    '[aviso] RESEND_API_KEY no configurada: no se enviarán correos de reclamo.'
  );
}

app.listen(puerto, () => {
  console.log(`API Uniautónoma Fest escuchando en http://localhost:${puerto}`);
});
