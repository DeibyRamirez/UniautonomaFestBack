/**
 * Agrega nombreBusqueda y tokensNombre a los pagos creados antes de existir esos campos,
 * para que la búsqueda por nombre del panel los encuentre.
 * Uso: npm run rellenar-nombre-busqueda
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { obtenerFirestore } = require('../src/config/firebase');
const { camposBusquedaNombre } = require('../src/utilidades/busquedaNombre');

const TAMANO_LOTE = 300;

async function main() {
  const db = obtenerFirestore();
  let ultimo = null;
  let revisados = 0;
  let actualizados = 0;

  for (;;) {
    let consulta = db.collection('payments').orderBy('__name__').limit(TAMANO_LOTE);
    if (ultimo) consulta = consulta.startAfter(ultimo);

    const snapshot = await consulta.get();
    if (snapshot.empty) break;

    const lote = db.batch();
    let cambiosLote = 0;

    for (const doc of snapshot.docs) {
      revisados += 1;
      const datos = doc.data();
      const campos = camposBusquedaNombre(datos.personalInfo || {});
      const tokensActuales = Array.isArray(datos.tokensNombre) ? datos.tokensNombre : [];
      const iguales =
        datos.nombreBusqueda === campos.nombreBusqueda &&
        tokensActuales.length === campos.tokensNombre.length &&
        tokensActuales.every((t, i) => t === campos.tokensNombre[i]);

      if (!iguales) {
        lote.update(doc.ref, campos);
        cambiosLote += 1;
      }
    }

    if (cambiosLote) {
      await lote.commit();
      actualizados += cambiosLote;
    }

    ultimo = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < TAMANO_LOTE) break;
  }

  console.log(`Revisados: ${revisados}. Actualizados: ${actualizados}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
