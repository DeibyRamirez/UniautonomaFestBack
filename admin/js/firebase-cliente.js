import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

let instanciaAuth = null;

export async function obtenerAuth() {
  if (instanciaAuth) return instanciaAuth;

  const respuesta = await fetch('/api/config/publica');
  if (!respuesta.ok) throw new Error('No se pudo cargar la configuración');
  const datos = await respuesta.json();
  if (!datos.firebase?.apiKey) {
    throw new Error('Firebase no configurado en el servidor');
  }
  if (!datos.firebase.authDomain || !datos.firebase.projectId) {
    throw new Error('Configuración de Firebase incompleta en el servidor');
  }

  const app = initializeApp({
    apiKey: datos.firebase.apiKey,
    authDomain: datos.firebase.authDomain,
    projectId: datos.firebase.projectId,
  });
  instanciaAuth = getAuth(app);
  return instanciaAuth;
}

export const RUTA_LOGIN = '/admin/login.html';
export const RUTA_PANEL = '/admin/';
