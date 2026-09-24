/**
 * Comprueba sintaxis de todos los .js del backend (sin ejecutar la app).
 * Uso: npm run verify
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const raizBackend = path.join(__dirname, '..');
const carpetas = [
  path.join(raizBackend, 'src'),
  path.join(raizBackend, 'scripts'),
];

function listarArchivosJs(directorio) {
  const resultados = [];
  if (!fs.existsSync(directorio)) return resultados;

  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...listarArchivosJs(ruta));
    } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

function main() {
  const archivos = carpetas.flatMap(listarArchivosJs);
  let fallos = 0;

  for (const archivo of archivos) {
    const resultado = spawnSync(process.execPath, ['--check', archivo], {
      encoding: 'utf8',
    });
    if (resultado.status !== 0) {
      fallos += 1;
      console.error('[verify] sintaxis inválida:', path.relative(raizBackend, archivo));
      if (resultado.stderr) console.error(resultado.stderr.trim());
    }
  }

  if (fallos > 0) {
    console.error(`\nVerificación fallida: ${fallos} archivo(s).`);
    process.exit(1);
  }

  console.log(`Verificación OK (${archivos.length} archivos).`);
}

main();
