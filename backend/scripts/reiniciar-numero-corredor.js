/**
 * Reinicia la numeración de corredores para que la venta real empiece en 001.
 * Los pagos de prueba que ya tenían número lo conservan en `numeroCorredorPrueba`
 * y quedan sin `numeroCorredor`, para que no se repitan números en el Excel ni en la rifa.
 *
 * Uso:
 *   npm run reiniciar-numero-corredor                 (solo muestra lo que haría)
 *   npm run reiniciar-numero-corredor -- --confirmar  (aplica el reinicio)
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

async function main() {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirmar');
  const forzarProduccion = args.includes('--forzar-produccion');
  const llave = String(process.env.WOMPI_PUBLIC_KEY || '');
  const esProduccion = llave.startsWith('pub_prod_');

  const db = obtenerFirestore();
  const contador = await db.collection(COLECCION_SECUENCIA).doc(DOCUMENTO_CONTADOR).get();
  const numerados = await db.collection('payments').where('numeroCorredor', '!=', null).get();

  console.log(`Último número asignado: ${contador.exists ? contador.data().ultimo : 0}`);
  console.log(`Pagos con número de corredor: ${numerados.size}`);
  numerados.docs.slice(0, 20).forEach((doc) => {
    const d = doc.data();
    console.log(`  ${d.numeroCorredor}  ${d.reference}  ${d.personalInfo?.email || ''}  ${d.status}`);
  });
  if (numerados.size > 20) console.log(`  … y ${numerados.size - 20} más`);

  if (!confirmar) {
    console.log('\nModo simulación. Agrega --confirmar para aplicar el reinicio.');
    return;
  }

  if (esProduccion && numerados.size > 0 && !forzarProduccion) {
    console.error(
      '\nWOMPI_PUBLIC_KEY es de producción y hay pagos numerados: podrían ser compras reales.' +
        '\nSi estás seguro de que son pruebas, repite con --forzar-produccion.'
    );
    process.exit(1);
  }

  for (let i = 0; i < numerados.docs.length; i += TAMANO_LOTE) {
    const lote = db.batch();
    numerados.docs.slice(i, i + TAMANO_LOTE).forEach((doc) => {
      lote.update(doc.ref, {
        numeroCorredorPrueba: doc.data().numeroCorredor,
        numeroCorredor: null,
      });
    });
    await lote.commit();
  }

  const borrados = await borrarColeccion(db, COLECCION_NUMEROS);
  await db
    .collection(COLECCION_SECUENCIA)
    .doc(DOCUMENTO_CONTADOR)
    .set({ ultimo: 0, actualizadoEn: new Date(), reiniciadoEn: new Date() });

  console.log(
    `\nReinicio aplicado. Pagos desmarcados: ${numerados.size}. Reservas borradas: ${borrados}. ` +
      'El próximo número será 001.'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
