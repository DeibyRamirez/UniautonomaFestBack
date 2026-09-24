/**
 * Uso (desde backend/):
 *   node scripts/crear-super-admin.js correo@uniautonoma.edu.co ContraseñaSegura123
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { obtenerAuth } = require('../src/config/firebase');
const administradoresRepository = require('../src/repositories/administradores.repository');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Uso: node scripts/crear-super-admin.js <correo> <contraseña>');
    process.exit(1);
  }

  const auth = obtenerAuth();
  let usuario;

  try {
    usuario = await auth.getUserByEmail(email.trim().toLowerCase());
    await auth.updateUser(usuario.uid, { password, emailVerified: true });
    console.log('Usuario existente actualizado:', usuario.uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      usuario = await auth.createUser({
        email: email.trim().toLowerCase(),
        password,
        emailVerified: true,
      });
      console.log('Usuario creado:', usuario.uid);
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(usuario.uid, {
    admin: true,
    superAdmin: true,
  });

  await administradoresRepository.guardarAdministrador({
    uid: usuario.uid,
    email: usuario.email,
    role: 'SUPER_ADMIN',
  });

  console.log('Super administrador listo:', usuario.email);
  console.log(
    'Inicia sesión en /admin/login.html con este correo y la contraseña que pasaste (o ADMIN_SEMILLA_CONTRASENA).'
  );
  console.log(
    'Si cambias la clave en Firebase Console, actualiza .env y vuelve a ejecutar semilla-admin.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
