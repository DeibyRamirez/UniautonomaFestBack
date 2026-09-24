/**
 * Comprueba que el usuario admin semilla exista en Firebase Auth.
 * Uso: npm run verificar-admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { obtenerAuth } = require('../src/config/firebase');
const administradoresRepository = require('../src/repositories/administradores.repository');

async function main() {
  const email = process.env.ADMIN_SEMILLA_CORREO?.trim().toLowerCase();
  if (!email) {
    console.error('Define ADMIN_SEMILLA_CORREO en backend/.env');
    process.exit(1);
  }

  console.log('Correo semilla configurado:', email);
  console.log(
    'Contraseña: la de ADMIN_SEMILLA_CONTRASENA en .env (npm run semilla-admin la aplica en Firebase).'
  );

  const auth = obtenerAuth();
  let usuario;
  try {
    usuario = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error('No existe en Firebase Auth. Ejecuta: npm run semilla-admin');
      process.exit(1);
    }
    throw error;
  }

  const claims = (await auth.getUser(usuario.uid)).customClaims || {};
  const registro = await administradoresRepository.obtenerPorUid(usuario.uid);

  console.log('UID:', usuario.uid);
  console.log('Email verificado:', usuario.emailVerified);
  console.log('Claims admin:', claims.admin === true, '| superAdmin:', claims.superAdmin === true);
  console.log('Documento Firestore admins:', registro ? registro.role : 'NO REGISTRADO');
  console.log('');
  console.log('Entra en http://localhost:3000/admin/login.html con ese correo y la contraseña del .env.');
  console.log(
    'Si cambiaste la clave en Firebase Console, actualiza ADMIN_SEMILLA_CONTRASENA y ejecuta npm run semilla-admin.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
