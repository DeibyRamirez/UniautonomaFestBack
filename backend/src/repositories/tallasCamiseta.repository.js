const { FieldValue } = require('firebase-admin/firestore');
const { obtenerFirestore } = require('../config/firebase');

const COLECCION = 'config';
const DOCUMENTO = 'tallasCamiseta';

async function obtenerDocumento() {
  const db = obtenerFirestore();
  const doc = await db.collection(COLECCION).doc(DOCUMENTO).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function guardarTallas(tallas, actualizadoPorEmail) {
  const db = obtenerFirestore();
  const ref = db.collection(COLECCION).doc(DOCUMENTO);
  await ref.set(
    {
      tallas,
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: actualizadoPorEmail || null,
    },
    { merge: true }
  );
  const actualizado = await ref.get();
  return actualizado.data();
}

module.exports = {
  COLECCION,
  DOCUMENTO,
  obtenerDocumento,
  guardarTallas,
};
