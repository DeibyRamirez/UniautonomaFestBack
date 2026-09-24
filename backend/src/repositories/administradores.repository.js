const { FieldValue } = require('firebase-admin/firestore');
const { obtenerFirestore } = require('../config/firebase');

const COLECCION = 'admins';

async function obtenerPorUid(uid) {
  const db = obtenerFirestore();
  const doc = await db.collection(COLECCION).doc(uid).get();
  if (!doc.exists) return null;
  const createdAt = doc.data().createdAt?.toDate?.()
    ? doc.data().createdAt.toDate().toISOString()
    : null;
  return { uid: doc.id, ...doc.data(), createdAt };
}

async function guardarAdministrador({ uid, email, role }) {
  const db = obtenerFirestore();
  await db
    .collection(COLECCION)
    .doc(uid)
    .set({
      uid,
      email,
      role,
      createdAt: FieldValue.serverTimestamp(),
    });
}

async function listarAdministradores(limite = 50) {
  const db = obtenerFirestore();
  const tope = Math.min(Math.max(1, limite), 100);
  const snapshot = await db
    .collection(COLECCION)
    .orderBy('createdAt', 'desc')
    .limit(tope)
    .get();

  return snapshot.docs.map((doc) => {
    const datos = doc.data();
    const createdAt = datos.createdAt?.toDate?.()
      ? datos.createdAt.toDate().toISOString()
      : null;
    return {
      uid: doc.id,
      email: datos.email,
      role: datos.role,
      createdAt,
    };
  });
}

module.exports = {
  obtenerPorUid,
  guardarAdministrador,
  listarAdministradores,
};
