import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { obtenerAuth, RUTA_PANEL } from './firebase-cliente.js';
import { enlazarAlternarContrasena } from './alternar-visibilidad-contrasena.js';

const formularioLogin = document.getElementById('formulario-login');
const estadoLoginExitoso = document.getElementById('estado-login-exitoso');
const textoLoginExitosoCorreo = document.getElementById('texto-login-exitoso-correo');
const inputCorreo = document.getElementById('correo');
const inputContrasena = document.getElementById('contrasena');
const botonVerContrasena = document.getElementById('boton-ver-contrasena');
const botonEntrar = document.getElementById('boton-entrar');
const errorLogin = document.getElementById('error-login');

const MS_REDIRECCION_PANEL = 800;

function mostrarError(texto) {
  errorLogin.textContent = texto || '';
  errorLogin.hidden = !texto;
}

function mensajeErrorInicioSesion(error) {
  const codigo = error?.code || '';
  if (codigo === 'auth/invalid-credential' || codigo === 'auth/wrong-password') {
    return 'Correo o contraseña incorrectos.';
  }
  if (codigo === 'auth/user-not-found') {
    return 'No existe una cuenta con ese correo.';
  }
  if (codigo === 'auth/invalid-email') {
    return 'Correo inválido.';
  }
  if (codigo === 'auth/operation-not-allowed') {
    return 'El inicio de sesión por correo no está habilitado. Contacta al administrador del sistema.';
  }
  if (codigo === 'auth/too-many-requests') {
    return 'Demasiados intentos. Espera unos minutos.';
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}

function mostrarExitoYRedirigir(correo) {
  formularioLogin.hidden = true;
  estadoLoginExitoso.hidden = false;
  textoLoginExitosoCorreo.textContent = `Sesión: ${correo}`;
  mostrarError('');
  setTimeout(() => {
    window.location.replace(RUTA_PANEL);
  }, MS_REDIRECCION_PANEL);
}

enlazarAlternarContrasena(inputContrasena, botonVerContrasena);

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('');

  const correo = inputCorreo.value.trim();
  const contrasena = inputContrasena.value;
  if (!correo || !contrasena) {
    mostrarError('Ingresa correo y contraseña.');
    return;
  }

  botonEntrar.disabled = true;
  botonEntrar.textContent = 'Verificando…';

  try {
    const auth = await obtenerAuth();
    const credencial = await signInWithEmailAndPassword(auth, correo, contrasena);
    mostrarExitoYRedirigir(credencial.user.email || correo);
  } catch (error) {
    console.error('[admin login]', error?.code);
    mostrarError(mensajeErrorInicioSesion(error));
    botonEntrar.disabled = false;
    botonEntrar.textContent = 'Entrar';
  }
});

async function iniciar() {
  const auth = await obtenerAuth();
  onAuthStateChanged(auth, (usuario) => {
    if (usuario) {
      window.location.replace(RUTA_PANEL);
    }
  });
}

iniciar().catch((error) => {
  mostrarError(error.message);
});
