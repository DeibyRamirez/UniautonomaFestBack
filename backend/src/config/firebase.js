const admin = require('firebase-admin');
const { variablesEntorno } = require('./variablesEntorno');

let inicializado = false;

function obtenerFirebaseAdmin() {
  if (inicializado) {
    return admin;
  }

  if (admin.apps.length > 0) {
    inicializado = true;
    return admin;
  }

  const { projectId, clientEmail, privateKey } = variablesEntorno.firebase;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const opciones = {
      credential: admin.credential.applicationDefault(),
    };
    if (projectId) {
      opciones.projectId = projectId;
    }
    admin.initializeApp(opciones);
  } else if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    throw new Error(
      'Firebase Admin no configurado: define FIREBASE_* o GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

  inicializado = true;
  return admin;
}

function obtenerFirestore() {
  return obtenerFirebaseAdmin().firestore();
}

function obtenerAuth() {
  return obtenerFirebaseAdmin().auth();
}

module.exports = {
  obtenerFirebaseAdmin,
  obtenerFirestore,
  obtenerAuth,
};
