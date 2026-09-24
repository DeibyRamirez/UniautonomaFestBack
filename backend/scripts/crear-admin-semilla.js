/**
 * Crea o actualiza el super administrador definido en backend/.env
 *
 * Variables:
 *   ADMIN_SEMILLA_CORREO
 *   ADMIN_SEMILLA_CONTRASENA
 *
 * Uso: npm run semilla-admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { spawnSync } = require('child_process');
const path = require('path');

const email = process.env.ADMIN_SEMILLA_CORREO;
const password = process.env.ADMIN_SEMILLA_CONTRASENA;

if (!email || !password) {
  console.error(
    'Define ADMIN_SEMILLA_CORREO y ADMIN_SEMILLA_CONTRASENA en backend/.env y vuelve a ejecutar npm run semilla-admin'
  );
  process.exit(1);
}

const script = path.join(__dirname, 'crear-super-admin.js');
const resultado = spawnSync(process.execPath, [script, email, password], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(resultado.status ?? 1);
