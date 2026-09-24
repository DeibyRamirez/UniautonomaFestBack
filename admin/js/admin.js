import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { obtenerAuth, RUTA_LOGIN } from './firebase-cliente.js';
import {
  enlazarAlternarContrasena,
  restablecerVisibilidadContrasena,
} from './alternar-visibilidad-contrasena.js';

const errorPanel = document.getElementById('error-panel');
const cuerpoTabla = document.getElementById('cuerpo-tabla');
const cuerpoTablaAdmins = document.getElementById('cuerpo-tabla-admins');
const filtroBusqueda = document.getElementById('filtro-busqueda');
const filtroEstado = document.getElementById('filtro-estado');
const correoAdmin = document.getElementById('correo-admin');
const botonPaginaAnterior = document.getElementById('boton-pagina-anterior');
const botonPaginaSiguiente = document.getElementById('boton-pagina-siguiente');
const textoPaginaActual = document.getElementById('texto-pagina-actual');
const pestanaFinanciera = document.getElementById('pestana-financiera');
const pestanaAdministradores = document.getElementById('pestana-administradores');
const seccionFinanciera = document.getElementById('seccion-financiera');
const seccionAdministradores = document.getElementById('seccion-administradores');
const formularioCrearAdmin = document.getElementById('formulario-crear-admin');
const inputContrasenaNuevoAdmin = document.getElementById('nuevo-admin-contrasena');
const botonVerContrasenaNuevoAdmin = document.getElementById('boton-ver-contrasena-nuevo-admin');
const mensajeCrearAdmin = document.getElementById('mensaje-crear-admin');
const dialogoConfirmarEntrega = document.getElementById('dialogo-confirmar-entrega');
const dialogoEntregaDetalle = document.getElementById('dialogo-entrega-detalle');

const FILAS_POR_PAGINA = 6;

let auth = null;
let tokenActual = null;
let esSuperAdmin = false;
let registrosCache = [];
let paginaIndice = 0;
let cursoresInicioPagina = [null];
let hayMasPaginas = false;

function mostrarError(elemento, texto) {
  elemento.textContent = texto || '';
  elemento.hidden = !texto;
}

function irALogin() {
  window.location.replace(RUTA_LOGIN);
}

function activarPestana(nombre) {
  const esFinanciera = nombre !== 'administradores';
  pestanaFinanciera.classList.toggle('activa', esFinanciera);
  pestanaAdministradores.classList.toggle('activa', !esFinanciera);
  seccionFinanciera.hidden = !esFinanciera;
  seccionAdministradores.hidden = esFinanciera;

  if (!esFinanciera && esSuperAdmin) {
    cargarListadoAdmins().catch((e) => mostrarError(errorPanel, e.message));
  }
}

function nombreCompleto(info) {
  return [info?.firstName, info?.secondName, info?.firstSurname, info?.secondSurname]
    .filter(Boolean)
    .join(' ');
}

function etiquetaKit(tipo) {
  return tipo === 'uniautonomo' ? 'Sangre Azul' : 'Corredor';
}

function etiquetaRolAdmin(rol) {
  return rol === 'SUPER_ADMIN' ? 'Super administrador' : 'Administrador';
}

function formatearFecha(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function claseEstado(estado) {
  if (estado === 'APPROVED') return 'estado-aprobado';
  if (estado === 'REJECTED') return 'estado-rechazado';
  return 'estado-pendiente';
}

function actualizarControlesPaginacion() {
  textoPaginaActual.textContent = `Página ${paginaIndice + 1}`;
  botonPaginaAnterior.disabled = paginaIndice <= 0;
  botonPaginaSiguiente.disabled = !hayMasPaginas;
}

function reiniciarPaginacion() {
  paginaIndice = 0;
  cursoresInicioPagina = [null];
  hayMasPaginas = false;
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
    boton.addEventListener('click', () => marcarEntregado(registro, boton));
    celdaAccion.appendChild(boton);

    cuerpoTabla.appendChild(fila);
  }
}

function renderizarTablaAdmins(registros) {
  cuerpoTablaAdmins.innerHTML = '';
  if (!registros.length) {
    cuerpoTablaAdmins.innerHTML =
      '<tr><td colspan="3">No hay administradores registrados.</td></tr>';
    return;
  }

  for (const admin of registros) {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${admin.email || '—'}</td>
      <td>${etiquetaRolAdmin(admin.role)}</td>
      <td>${formatearFecha(admin.createdAt)}</td>
    `;
    cuerpoTablaAdmins.appendChild(fila);
  }
}

async function cargarPerfilAdmin() {
  const respuesta = await fetch('/api/admin/perfil', {
    headers: { Authorization: `Bearer ${tokenActual}` },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'No se pudo cargar el perfil');
  }
  esSuperAdmin = Boolean(datos.esSuperAdmin);
  pestanaAdministradores.hidden = !esSuperAdmin;
}

async function cargarListadoAdmins() {
  const respuesta = await fetch('/api/admin/admins', {
    headers: { Authorization: `Bearer ${tokenActual}` },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'No se pudo cargar administradores');
  }
  renderizarTablaAdmins(datos.datos || []);
}

function solicitarConfirmacionEntrega(registro) {
  const info = registro.personalInfo || {};
  dialogoEntregaDetalle.textContent = `${nombreCompleto(info)} · código ${
    registro.uniqueClaimCode || '—'
  } · ${etiquetaKit(registro.kitType)}`;
  dialogoConfirmarEntrega.returnValue = 'no';
  dialogoConfirmarEntrega.showModal();
  return new Promise((resolver) => {
    dialogoConfirmarEntrega.addEventListener(
      'close',
      () => {
        resolver(dialogoConfirmarEntrega.returnValue === 'si');
      },
      { once: true }
    );
  });
}

async function obtenerRegistros(opciones = {}) {
  const { reiniciar = false } = opciones;
  if (reiniciar) reiniciarPaginacion();

  const params = new URLSearchParams();
  params.set('limit', String(FILAS_POR_PAGINA));
  if (filtroEstado.value) params.set('status', filtroEstado.value);
  if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());

  const cursor = cursoresInicioPagina[paginaIndice];
  if (cursor) params.set('cursor', cursor);

  const respuesta = await fetch(`/api/admin/students?${params}`, {
    headers: { Authorization: `Bearer ${tokenActual}` },
  });

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Error al cargar estudiantes');
  }

  registrosCache = datos.datos || [];
  hayMasPaginas = Boolean(datos.paginacion?.hayMas);

  if (datos.paginacion?.cursorSiguiente) {
    cursoresInicioPagina[paginaIndice + 1] = datos.paginacion.cursorSiguiente;
  } else {
    cursoresInicioPagina = cursoresInicioPagina.slice(0, paginaIndice + 1);
  }

  renderizarTabla(registrosCache);
  actualizarControlesPaginacion();
}

async function irPaginaAnterior() {
  if (paginaIndice <= 0) return;
  paginaIndice -= 1;
  await obtenerRegistros();
}

async function irPaginaSiguiente() {
  if (!hayMasPaginas) return;
  paginaIndice += 1;
  await obtenerRegistros();
}

async function marcarEntregado(registro, boton) {
  const confirmado = await solicitarConfirmacionEntrega(registro);
  if (!confirmado) return;

  boton.disabled = true;
  try {
    const respuesta = await fetch(`/api/admin/students/${registro.id}/deliver`, {
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

async function obtenerTodosParaExportar() {
  const params = new URLSearchParams();
  params.set('limit', '500');
  if (filtroEstado.value) params.set('status', filtroEstado.value);
  if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());

  const respuesta = await fetch(`/api/admin/students?${params}`, {
    headers: { Authorization: `Bearer ${tokenActual}` },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Error al cargar datos para exportar');
  }
  return datos.datos || [];
}

async function exportarExcel() {
  try {
    const filasExport = await obtenerTodosParaExportar();
    if (!filasExport.length) {
      mostrarError(errorPanel, 'No hay datos para exportar');
      return;
    }

    const filas = filasExport.map((r) => {
      const info = r.personalInfo || {};
      return {
        'Primer nombre': info.firstName || '',
        'Segundo nombre': info.secondName || '',
        'Primer apellido': info.firstSurname || '',
        'Segundo apellido': info.secondSurname || '',
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
  } catch (error) {
    mostrarError(errorPanel, error.message);
  }
}

async function iniciarPanel(usuario) {
  tokenActual = await usuario.getIdToken(true);
  correoAdmin.textContent = usuario.email;
  mostrarError(errorPanel, '');
  activarPestana('financiera');
  await cargarPerfilAdmin();
  await obtenerRegistros({ reiniciar: true });
}

document.getElementById('boton-cerrar-sesion').addEventListener('click', async () => {
  await signOut(auth);
  irALogin();
});

document.getElementById('boton-refrescar').addEventListener('click', () => {
  obtenerRegistros({ reiniciar: true }).catch((e) => mostrarError(errorPanel, e.message));
});
document.getElementById('boton-exportar').addEventListener('click', exportarExcel);
botonPaginaAnterior.addEventListener('click', () => {
  irPaginaAnterior().catch((e) => mostrarError(errorPanel, e.message));
});
botonPaginaSiguiente.addEventListener('click', () => {
  irPaginaSiguiente().catch((e) => mostrarError(errorPanel, e.message));
});

pestanaFinanciera.addEventListener('click', () => activarPestana('financiera'));
pestanaAdministradores.addEventListener('click', () => {
  if (esSuperAdmin) activarPestana('administradores');
});

let temporizadorBusqueda;
filtroBusqueda.addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => {
    obtenerRegistros({ reiniciar: true }).catch((e) => mostrarError(errorPanel, e.message));
  }, 350);
});
filtroEstado.addEventListener('change', () => {
  obtenerRegistros({ reiniciar: true }).catch((e) => mostrarError(errorPanel, e.message));
});

enlazarAlternarContrasena(inputContrasenaNuevoAdmin, botonVerContrasenaNuevoAdmin);

formularioCrearAdmin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensajeCrearAdmin.hidden = true;
  mensajeCrearAdmin.classList.remove('mensaje-crear-admin--error');

  const correo = formularioCrearAdmin.correo.value.trim();
  const contrasena = formularioCrearAdmin.contrasena.value;
  const role = formularioCrearAdmin.rol.value;

  try {
    const respuesta = await fetch('/api/admin/create-admin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenActual}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: correo, password: contrasena, role }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No se pudo crear el administrador');
    }
    formularioCrearAdmin.reset();
    restablecerVisibilidadContrasena(inputContrasenaNuevoAdmin, botonVerContrasenaNuevoAdmin);
    mensajeCrearAdmin.textContent = `Administrador creado: ${datos.email}`;
    mensajeCrearAdmin.hidden = false;
    await cargarListadoAdmins();
  } catch (error) {
    mensajeCrearAdmin.textContent = error.message;
    mensajeCrearAdmin.classList.add('mensaje-crear-admin--error');
    mensajeCrearAdmin.hidden = false;
  }
});

async function iniciar() {
  auth = await obtenerAuth();

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
      irALogin();
      return;
    }

    try {
      await iniciarPanel(usuario);
    } catch (error) {
      mostrarError(errorPanel, error.message);
      if (error.message.includes('403') || error.message.includes('administrador')) {
        await signOut(auth);
        irALogin();
      }
    }
  });
}

iniciar().catch(() => {
  irALogin();
});
