const app = require('./app');
const { variablesEntorno } = require('./config/variablesEntorno');
const { resolverDriver } = require('./services/email/email.factory');
const resendProvider = require('./services/email/resend.provider');
const smtpProvider = require('./services/email/smtp.provider');
const {
  mostrarAvisoMailtrapSandbox,
} = require('./utilidades/avisoMailtrapSandbox');

process.env.SERVIR_ESTATICOS = 'true';

const puerto = variablesEntorno.puerto;
const driver = resolverDriver();

async function verificarProveedoresCorreo() {
  console.log(`[correo] driver activo: ${driver}`);

  if (driver === 'resend' && !resendProvider.estaConfigurado()) {
    console.warn(
      '[aviso] RESEND_API_KEY no configurada: no se enviarán correos de reclamo.'
    );
  }

  if (driver === 'smtp') {
    mostrarAvisoMailtrapSandbox(variablesEntorno.email.smtp.host);
    try {
      await smtpProvider.verificarConexion();
      console.log('[correo] SMTP verificado OK');
    } catch (error) {
      console.error('[correo] SMTP no disponible:', error.message);
    }
  }

  if (variablesEntorno.email.fallbackHabilitado) {
    const secundario = driver === 'resend' ? 'smtp' : 'resend';
    if (secundario === 'smtp' && smtpProvider.estaConfigurado()) {
      try {
        await smtpProvider.verificarConexion();
        console.log('[correo] SMTP (fallback) verificado OK');
      } catch (error) {
        console.warn('[correo] SMTP fallback no disponible:', error.message);
      }
    }
    if (secundario === 'resend' && !resendProvider.estaConfigurado()) {
      console.warn('[correo] Resend (fallback) no configurado');
    }
  }
}

verificarProveedoresCorreo().catch((error) => {
  console.error('[correo] error al verificar proveedores:', error.message);
});

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
