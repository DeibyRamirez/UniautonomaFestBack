/**
 * Borra datos de prueba y deja Firestore listo para producción.
 * Conserva la colección `admins` (usuarios del panel).
 *
 * Elimina: payments, numerosCorredor, inscripciones de eventos.
 * Reinicia: sequences/numeroCorredor → el próximo número será 001.
 *
 * Uso:
 *   npm run limpiar-base-datos                 (solo muestra lo que haría)
 *   npm run limpiar-base-datos -- --confirmar  (aplica la limpieza)
 *
 * Con llave Wompi de producción se exige además --forzar-produccion.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { obtenerFirestore } = require('../src/config/firebase');
const {
  COLECCION_NUMEROS,
  COLECCION_SECUENCIA,
  DOCUMENTO_CONTADOR,
} = require('../src/services/numeroCorredor.service');

const TAMANO_LOTE = 400;
const EVENTOS_RAIZ = 'eventos/uaf2026';
const SUBCOLECCIONES_EVENTOS = ['Hackton', 'FeriaEmprendimiento'];

async function contarColeccion(db, nombre) {
  const snapshot = await db.collection(nombre).count().get();
  return snapshot.data().count;
}

async function contarSubcoleccion(db, ruta) {
  const [coleccion, documento, subcoleccion] = ruta.split('/');
  const snapshot = await db
    .collection(coleccion)
    .doc(documento)
    .collection(subcoleccion)
    .count()
    .get();
  return snapshot.data().count;
}

async function borrarColeccion(db, nombre) {
  let borrados = 0;
  for (;;) {
    const snapshot = await db.collection(nombre).limit(TAMANO_LOTE).get();
    if (snapshot.empty) break;
    const lote = db.batch();
    snapshot.docs.forEach((doc) => lote.delete(doc.ref));
    await lote.commit();
    borrados += snapshot.size;
  }
  return borrados;
}

async function borrarSubcoleccion(db, ruta) {
  const [coleccion, documento, subcoleccion] = ruta.split('/');
  const ref = db.collection(coleccion).doc(documento).collection(subcoleccion);
  let borrados = 0;
  for (;;) {
    const snapshot = await ref.limit(TAMANO_LOTE).get();
    if (snapshot.empty) break;
    const lote = db.batch();
    snapshot.docs.forEach((doc) => lote.delete(doc.ref));
    await lote.commit();
    borrados += snapshot.size;
  }
  return borrados;
}

async function main() {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirmar');
  const forzarProduccion = args.includes('--forzar-produccion');
  const llave = String(process.env.WOMPI_PUBLIC_KEY || '');
  const esProduccion = llave.startsWith('pub_prod_');

  const db = obtenerFirestore();

  const totalPagos = await contarColeccion(db, 'payments');
  const totalNumeros = await contarColeccion(db, COLECCION_NUMEROS);
  const contador = await db
    .collection(COLECCION_SECUENCIA)
    .doc(DOCUMENTO_CONTADOR)
    .get();

  const conteosEventos = {};
  for (const sub of SUBCOLECCIONES_EVENTOS) {
    conteosEventos[sub] = await contarSubcoleccion(db, `${EVENTOS_RAIZ}/${sub}`);
  }

  const totalAdmins = await contarColeccion(db, 'admins');

  console.log('=== Resumen actual ===');
  console.log(`Pagos (payments):              ${totalPagos}`);
  console.log(`Reservas (numerosCorredor):    ${totalNumeros}`);
  console.log(
    `Contador (sequences):          ${contador.exists ? contador.data().ultimo : 0} (próximo: ${String((contador.exists ? Number(contador.data().ultimo) || 0 : 0) + 1).padStart(3, '0')})`
  );
  for (const sub of SUBCOLECCIONES_EVENTOS) {
    console.log(`Inscripciones ${sub}:`.padEnd(32) + conteosEventos[sub]);
  }
  console.log(`Admins (se conservan):         ${totalAdmins}`);

  if (!confirmar) {
    console.log('\nModo simulación. Agrega --confirmar para aplicar la limpieza.');
    console.log('Se borrarán pagos, inscripciones y numeración; admins no se tocan.');
    return;
  }

  if (esProduccion && totalPagos > 0 && !forzarProduccion) {
    console.error(
      '\nWOMPI_PUBLIC_KEY es de producción y hay pagos registrados.' +
        '\nSi estás seguro de que son solo pruebas, repite con --forzar-produccion.'
    );
    process.exit(1);
  }

  const borradosPagos = await borrarColeccion(db, 'payments');
  const borradosNumeros = await borrarColeccion(db, COLECCION_NUMEROS);

  let borradosEventos = 0;
  for (const sub of SUBCOLECCIONES_EVENTOS) {
    borradosEventos += await borrarSubcoleccion(db, `${EVENTOS_RAIZ}/${sub}`);
  }

  await db
    .collection(COLECCION_SECUENCIA)
    .doc(DOCUMENTO_CONTADOR)
    .set({ ultimo: 0, actualizadoEn: new Date(), reiniciadoEn: new Date() });

  console.log('\n=== Limpieza aplicada ===');
  console.log(`Pagos borrados:                ${borradosPagos}`);
  console.log(`Reservas borradas:             ${borradosNumeros}`);
  console.log(`Inscripciones borradas:        ${borradosEventos}`);
  console.log('Contador reiniciado:           0 (el próximo número será 001)');
  console.log(`Admins conservados:            ${totalAdmins}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
