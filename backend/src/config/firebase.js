const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { variablesEntorno } = require('./variablesEntorno');

let inicializado = false;

function rutaCredencialesGoogleExiste() {
  const ruta = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!ruta) return false;

  const rutaAbsoluta = path.isAbsolute(ruta)
    ? ruta
    : path.resolve(process.cwd(), ruta);

  try {
    return fs.existsSync(rutaAbsoluta) && fs.statSync(rutaAbsoluta).isFile();
  } catch {
    return false;
  }
}

function obtenerFirebaseAdmin() {
  if (inicializado) {
    return admin;
  }

  if (admin.apps.length > 0) {
    inicializado = true;
    return admin;
  }

  const { projectId, clientEmail, privateKey } = variablesEntorno.firebase;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else if (rutaCredencialesGoogleExiste()) {
    const opciones = {
      credential: admin.credential.applicationDefault(),
    };
    if (projectId) {
      opciones.projectId = projectId;
    }
    admin.initializeApp(opciones);
  } else {
    throw new Error(
      'Firebase Admin no configurado: define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Vercel (no uses GOOGLE_APPLICATION_CREDENTIALS en producción)'
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
