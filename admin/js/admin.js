import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const vistaLogin = document.getElementById('vista-login');
const vistaPanel = document.getElementById('vista-panel');
const formularioLogin = document.getElementById('formulario-login');
const errorLogin = document.getElementById('error-login');
const errorPanel = document.getElementById('error-panel');
const cuerpoTabla = document.getElementById('cuerpo-tabla');
const filtroBusqueda = document.getElementById('filtro-busqueda');
const filtroEstado = document.getElementById('filtro-estado');
const correoAdmin = document.getElementById('correo-admin');

let auth = null;
let tokenActual = null;
let registrosCache = [];

function mostrarError(elemento, texto) {
  elemento.textContent = texto || '';
  elemento.hidden = !texto;
}

async function cargarConfigFirebase() {
  const respuesta = await fetch('/api/config/publica');
  if (!respuesta.ok) throw new Error('No se pudo cargar la configuración');
  const datos = await respuesta.json();
  if (!datos.firebase?.apiKey) {
    throw new Error('Firebase no configurado en el servidor');
  }
  const app = initializeApp({
    apiKey: datos.firebase.apiKey,
    authDomain: datos.firebase.authDomain,
    projectId: datos.firebase.projectId,
  });
  auth = getAuth(app);
}

function nombreCompleto(info) {
  return [info?.firstName, info?.secondName, info?.firstSurname, info?.secondSurname]
    .filter(Boolean)
    .join(' ');
}

function etiquetaKit(tipo) {
  return tipo === 'uniautonomo' ? 'Sangre Azul' : 'Corredor';
}

function claseEstado(estado) {
  if (estado === 'APPROVED') return 'estado-aprobado';
  if (estado === 'REJECTED') return 'estado-rechazado';
  return 'estado-pendiente';
}

function renderizarTabla(registros) {
  cuerpoTabla.innerHTML = '';

  if (registros.length === 0) {
    cuerpoTabla.innerHTML =
      '<tr><td colspan="10">No hay registros con los filtros actuales.</td></tr>';
    return;
  }

  for (const registro of registros) {
    const fila = document.createElement('tr');
    const info = registro.personalInfo || {};
    const puedeEntregar =
      registro.status === 'APPROVED' && !registro.kitClaimed;

    const estadoCorreo = registro.emailEnviadoEn
      ? 'Enviado'
      : registro.emailError
        ? `Error: ${registro.emailError}`
        : '—';

    fila.innerHTML = `
      <td>${nombreCompleto(info)}</td>
      <td>${info.email || '—'}</td>
      <td>${info.studentCode || '—'}</td>
      <td>${info.shirtSize || '—'}</td>
      <td>${etiquetaKit(registro.kitType)}</td>
      <td>${registro.uniqueClaimCode || '—'}</td>
      <td class="${claseEstado(registro.status)}">${registro.status}</td>
      <td>${estadoCorreo}</td>
      <td>${registro.kitClaimed ? 'Entregado' : 'Pendiente'}</td>
      <td></td>
    `;

    const celdaAccion = fila.lastElementChild;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-entregar';
    boton.textContent = registro.kitClaimed ? 'Entregado' : 'Marcar entregado';
    boton.disabled = !puedeEntregar;
    boton.addEventListener('click', () => marcarEntregado(registro.id, boton));
    celdaAccion.appendChild(boton);

    cuerpoTabla.appendChild(fila);
  }
}

async function obtenerRegistros() {
  const params = new URLSearchParams();
  if (filtroEstado.value) params.set('status', filtroEstado.value);
  if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());

  const respuesta = await fetch(`/api/admin/students?${params}`, {
    headers: { Authorization: `Bearer ${tokenActual}` },
  });

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Error al cargar estudiantes');
  }

  registrosCache = datos.datos || [];
  renderizarTabla(registrosCache);
}

async function marcarEntregado(id, boton) {
  boton.disabled = true;
  try {
    const respuesta = await fetch(`/api/admin/students/${id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenActual}` },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo marcar entrega');
    await obtenerRegistros();
  } catch (error) {
    mostrarError(errorPanel, error.message);
    boton.disabled = false;
  }
}

function exportarExcel() {
  if (!registrosCache.length) {
    mostrarError(errorPanel, 'No hay datos para exportar');
    return;
  }

  const filas = registrosCache.map((r) => {
    const info = r.personalInfo || {};
    return {
      Nombre: nombreCompleto(info),
      Correo: info.email,
      CodigoEstudiante: info.studentCode,
      Talla: info.shirtSize,
      TipoKit: etiquetaKit(r.kitType),
      CorreoEnviado: r.emailEnviadoEn || '',
      ErrorCorreo: r.emailError || '',
      CodigoReclamo: r.uniqueClaimCode,
      EstadoPago: r.status,
      Referencia: r.reference,
      Entregado: r.kitClaimed ? 'Sí' : 'No',
      EntregadoPor: r.claimedByAdminEmail || '',
      FechaCreacion: r.createdAt || '',
    };
  });

  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Kits');
  XLSX.writeFile(libro, `kits-uaf26-${new Date().toISOString().slice(0, 10)}.xlsx`);
  mostrarError(errorPanel, '');
}

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError(errorLogin, '');

  try {
    await signInWithEmailAndPassword(
      auth,
      formularioLogin.correo.value.trim(),
      formularioLogin.contrasena.value
    );
  } catch (error) {
    mostrarError(errorLogin, 'Credenciales incorrectas o usuario sin permisos.');
  }
});

document.getElementById('boton-cerrar-sesion').addEventListener('click', () => signOut(auth));
document.getElementById('boton-refrescar').addEventListener('click', () => {
  obtenerRegistros().catch((e) => mostrarError(errorPanel, e.message));
});
document.getElementById('boton-exportar').addEventListener('click', exportarExcel);

let temporizadorBusqueda;
filtroBusqueda.addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => {
    obtenerRegistros().catch((e) => mostrarError(errorPanel, e.message));
  }, 350);
});
filtroEstado.addEventListener('change', () => {
  obtenerRegistros().catch((e) => mostrarError(errorPanel, e.message));
});

async function iniciar() {
  await cargarConfigFirebase();

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
      tokenActual = null;
      vistaLogin.hidden = false;
      vistaPanel.hidden = true;
      return;
    }

    tokenActual = await usuario.getIdToken();
    correoAdmin.textContent = usuario.email;
    vistaLogin.hidden = true;
    vistaPanel.hidden = false;
    mostrarError(errorPanel, '');

    try {
      await obtenerRegistros();
    } catch (error) {
      mostrarError(errorPanel, error.message);
      if (error.message.includes('403') || error.message.includes('administrador')) {
        await signOut(auth);
      }
    }
  });
}

iniciar().catch((error) => {
  mostrarError(errorLogin, error.message);
});
