import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { obtenerAuth, RUTA_LOGIN } from './firebase-cliente.js';
import {
  enlazarAlternarContrasena,
  restablecerVisibilidadContrasena,
} from './alternar-visibilidad-contrasena.js';

const vistaPanel = document.getElementById('vista-panel');
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
const pestanaEventos = document.getElementById('pestana-eventos');
const pestanaRegistroManual = document.getElementById('pestana-registro-manual');
const pestanaAdministradores = document.getElementById('pestana-administradores');
const seccionFinanciera = document.getElementById('seccion-financiera');
const seccionEventos = document.getElementById('seccion-eventos');
const seccionRegistroManual = document.getElementById('seccion-registro-manual');
const seccionAdministradores = document.getElementById('seccion-administradores');
const botonExportar = document.getElementById('boton-exportar');
const botonExportarEventos = document.getElementById('boton-exportar-eventos');
const formularioRegistroManual = document.getElementById('formulario-registro-manual');
const manualKitType = document.getElementById('manual-kit-type');
const manualComponentes = document.getElementById('manual-componentes');
const manualOrigenRegistro = document.getElementById('manual-origen-registro');
const manualTransactionId = document.getElementById('manual-transaction-id');
const manualCampoRol = document.getElementById('manual-campo-rol');
const manualCampoCarrera = document.getElementById('manual-campo-carrera');
const manualCampoCodigo = document.getElementById('manual-campo-codigo');
const manualCampoTalla = document.getElementById('manual-campo-talla');
const manualAcademicCareer = document.getElementById('manual-academicCareer');
const manualParticipantRole = document.getElementById('manual-participantRole');
const manualEnviarCorreoCheck = document.getElementById('manual-enviar-correo-check');
const mensajeRegistroManual = document.getElementById('mensaje-registro-manual');
const errorRegistroManual = document.getElementById('error-registro-manual');
const selectManualCiudad = document.getElementById('manual-residenceCity');
const filtroTipoEvento = document.getElementById('filtro-tipo-evento');
const filtroBusquedaEventos = document.getElementById('filtro-busqueda-eventos');
const errorPanelEventos = document.getElementById('error-panel-eventos');
const cuerpoTablaEventos = document.getElementById('cuerpo-tabla-eventos');
const cabeceraTablaEventos = document.getElementById('cabecera-tabla-eventos');
const botonPaginaAnteriorEventos = document.getElementById('boton-pagina-anterior-eventos');
const botonPaginaSiguienteEventos = document.getElementById('boton-pagina-siguiente-eventos');
const textoPaginaActualEventos = document.getElementById('texto-pagina-actual-eventos');
const formularioCrearAdmin = document.getElementById('formulario-crear-admin');
const inputContrasenaNuevoAdmin = document.getElementById('nuevo-admin-contrasena');
const botonVerContrasenaNuevoAdmin = document.getElementById('boton-ver-contrasena-nuevo-admin');
const mensajeCrearAdmin = document.getElementById('mensaje-crear-admin');
const dialogoConfirmarEntrega = document.getElementById('dialogo-confirmar-entrega');
const dialogoEntregaDetalle = document.getElementById('dialogo-entrega-detalle');

const FILAS_POR_PAGINA = 15;

let promesaXlsx = null;

function precalentarPanelAdmin() {
  fetch('/api/admin/warmup').catch(() => {});
}

function cargarLibreriaXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (promesaXlsx) return promesaXlsx;

  promesaXlsx = new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolver(window.XLSX);
    script.onerror = () => {
      promesaXlsx = null;
      rechazar(new Error('No se pudo cargar la librería de Excel.'));
    };
    document.head.appendChild(script);
  });

  return promesaXlsx;
}

function mostrarCargandoTabla() {
  cuerpoTabla.innerHTML =
    '<tr><td colspan="18">Cargando registros…</td></tr>';
}

function aplicarPermisosSuperAdmin() {
  if (botonExportar) botonExportar.hidden = !esSuperAdmin;
  if (botonExportarEventos) botonExportarEventos.hidden = !esSuperAdmin;
  if (pestanaRegistroManual) pestanaRegistroManual.hidden = !esSuperAdmin;
  if (pestanaAdministradores) pestanaAdministradores.hidden = !esSuperAdmin;
}

let auth = null;
let tokenActual = null;
let esSuperAdmin = false;
let registrosCache = [];
let paginaIndice = 0;
let cursoresInicioPagina = [null];
let hayMasPaginas = false;

let paginaIndiceEventos = 0;
let cursoresInicioPaginaEventos = [null];
let hayMasPaginasEventos = false;
let registrosEventosCache = [];
let eventosFiltrosCargados = '';

const CARRERAS_ESTUDIANTE = [
  'Gobierno y Relaciones Internacionales',
  'Derecho',
  'Entrenamiento Deportivo',
  'Licenciatura en Educación Infantil',
  'Ingeniería Civil',
  'Ingeniería Energética',
  'Finanzas y Negocios Internacionales',
  'Administración de Empresas',
  'Contaduría Pública',
  'Matemáticas Aplicadas en Ciencia de Datos',
  'Ingeniería Ambiental y de Saneamiento',
  'Ingeniería Electrónica',
  'Ingeniería de Software y computación',
  'Otra (Postgrado, Especialización, Maestría)',
];

function mostrarError(elemento, texto) {
  elemento.textContent = texto || '';
  elemento.hidden = !texto;
}

function claveFiltrosEventos() {
  return `${filtroTipoEvento.value}|${filtroBusquedaEventos.value.trim()}`;
}

function claveCacheEventos() {
  return `${claveFiltrosEventos()}|p${paginaIndiceEventos}`;
}

const RETRASOS_REINTENTO_RED_MS = [1500, 3000];
const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Revisa tu conexión y pulsa Actualizar.';

function esErrorRed(error) {
  if (!error) return false;
  if (error.name === 'TypeError') return true;
  return /NetworkError|Failed to fetch|Load failed|fetch resource/i.test(error.message || '');
}

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// Solo se reintentan GET: repetir un POST/PATCH podría reenviar un correo o duplicar una acción.
async function fetchConReintentoRed(url, opciones) {
  const metodo = String(opciones.method || 'GET').toUpperCase();
  const reintentos = metodo === 'GET' ? RETRASOS_REINTENTO_RED_MS : [];

  for (let intento = 0; ; intento += 1) {
    try {
      return await fetch(url, opciones);
    } catch (error) {
      if (!esErrorRed(error)) throw error;
      if (intento >= reintentos.length) throw new Error(MENSAJE_SIN_CONEXION);
      await esperar(reintentos[intento]);
    }
  }
}

async function fetchAdmin(url, opciones = {}) {
  const encabezados = {
    ...(opciones.headers || {}),
    Authorization: `Bearer ${tokenActual}`,
  };
  let respuesta = await fetchConReintentoRed(url, { ...opciones, headers: encabezados });

  if (respuesta.status === 401 && auth?.currentUser) {
    tokenActual = await auth.currentUser.getIdToken(true);
    encabezados.Authorization = `Bearer ${tokenActual}`;
    respuesta = await fetchConReintentoRed(url, { ...opciones, headers: encabezados });
  }

  return respuesta;
}

async function leerJson(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    return { mensaje: `El servidor respondió con un error (HTTP ${respuesta.status}).` };
  }
}

function mostrarMensajeTabla(texto) {
  cuerpoTabla.innerHTML = `<tr><td colspan="18">${escaparHtml(texto)}</td></tr>`;
}

function irALogin() {
  window.location.replace(RUTA_LOGIN);
}

function activarPestana(nombre) {
  const esFinanciera = nombre === 'financiera';
  const esEventos = nombre === 'eventos';
  const esRegistroManual = nombre === 'registro-manual';
  const esAdministradores = nombre === 'administradores';

  pestanaFinanciera.classList.toggle('activa', esFinanciera);
  pestanaEventos.classList.toggle('activa', esEventos);
  if (pestanaRegistroManual) {
    pestanaRegistroManual.classList.toggle('activa', esRegistroManual);
  }
  pestanaAdministradores.classList.toggle('activa', esAdministradores);

  seccionFinanciera.hidden = !esFinanciera;
  seccionEventos.hidden = !esEventos;
  if (seccionRegistroManual) seccionRegistroManual.hidden = !esRegistroManual;
  seccionAdministradores.hidden = !esAdministradores;

  if (esEventos) {
    actualizarCabeceraTablaEventos();
    const claveActual = claveCacheEventos();
    if (eventosFiltrosCargados === claveActual && registrosEventosCache.length) {
      renderizarTablaEventos(registrosEventosCache);
      actualizarControlesPaginacionEventos();
      return;
    }
    obtenerInscripcionesEventos({ reiniciar: true }).catch((e) =>
      mostrarError(errorPanelEventos, e.message)
    );
  }

  if (esAdministradores && esSuperAdmin) {
    cargarListadoAdmins().catch((e) => mostrarError(errorPanel, e.message));
  }
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function celda(valor) {
  const texto = valor === undefined || valor === null || valor === '' ? '—' : valor;
  return `<td>${escaparHtml(texto)}</td>`;
}

function kitIncluyeNumero(registro) {
  if (registro.kitType === 'uniautonomo') return true;
  return (
    registro.kitType === 'personalizado' &&
    Array.isArray(registro.kitComponents) &&
    registro.kitComponents.includes('carrera')
  );
}

function nombreCompleto(info) {
  return [info?.firstName, info?.secondName, info?.firstSurname, info?.secondSurname]
    .filter(Boolean)
    .join(' ');
}

function etiquetaKit(tipo, kitComponents) {
  if (tipo === 'uniautonomo') return 'Sangre Azul';
  if (tipo === 'personalizado') {
    if (Array.isArray(kitComponents) && kitComponents.length) {
      return 'Personalizado (' + kitComponents.join(', ') + ')';
    }
    return 'Personalizado';
  }
  if (tipo === 'corredor_externo') return 'Corredor externo';
  return 'Corredor';
}

function formatearTarifa(registro) {
  const centavos = registro.amount ?? (registro.kitType === 'uniautonomo' ? 7500000 : 8000000);
  const pesos = centavos / 100;
  return pesos.toLocaleString('es-CO');
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
      '<tr><td colspan="18">No hay registros con los filtros actuales.</td></tr>';
    return;
  }

  for (const registro of registros) {
    const fila = document.createElement('tr');
    const info = registro.personalInfo || {};
    const documento = info.documentType
      ? `${info.documentType} ${info.documentNumber || ''}`.trim()
      : info.documentNumber || '—';
    const puedeEntregar =
      registro.status === 'APPROVED' && !registro.kitClaimed;

    const estadoCorreo = registro.emailEnviadoEn
      ? 'Enviado'
      : registro.emailError
        ? `Error: ${registro.emailError}`
        : '—';

    const textoNumero = registro.numeroCorredor
      || (registro.numeroCorredorError ? `Error: ${registro.numeroCorredorError}` : '—');
    const textoEstado = registro.alertaPago
      ? `${registro.status} (alerta: ${registro.alertaPago})`
      : registro.status;

    fila.innerHTML = `
      ${celda(nombreCompleto(info))}
      ${celda(documento)}
      ${celda(info.residenceCity)}
      ${celda(info.address)}
      ${celda(info.email)}
      ${celda(info.participantRole)}
      ${celda(info.academicCareer)}
      ${celda(info.studentCode)}
      ${celda(info.shirtSize)}
      ${celda(textoNumero)}
      ${celda(etiquetaKit(registro.kitType, registro.kitComponents))}
      ${celda(formatearTarifa(registro))}
      ${celda(formatearFecha(registro.createdAt))}
      ${celda(registro.uniqueClaimCode)}
      <td class="${claseEstado(registro.status)}">${escaparHtml(textoEstado)}</td>
      ${celda(estadoCorreo)}
      ${celda(registro.kitClaimed ? 'Entregado' : 'Pendiente')}
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

    if (registro.status === 'APPROVED' && registro.uniqueClaimCode) {
      const botonCorreo = document.createElement('button');
      botonCorreo.type = 'button';
      botonCorreo.className = 'boton-entregar';
      botonCorreo.style.marginTop = '6px';
      botonCorreo.textContent = registro.emailEnviadoEn ? 'Reenviar correo' : 'Enviar correo';
      botonCorreo.addEventListener('click', () => reenviarCorreo(registro, botonCorreo));
      celdaAccion.appendChild(botonCorreo);
    }

    if (registro.status === 'APPROVED' && !registro.numeroCorredor && kitIncluyeNumero(registro)) {
      const botonNumero = document.createElement('button');
      botonNumero.type = 'button';
      botonNumero.className = 'boton-entregar';
      botonNumero.style.marginTop = '6px';
      botonNumero.textContent = 'Asignar número';
      botonNumero.addEventListener('click', () => asignarNumeroCorredor(registro, botonNumero));
      celdaAccion.appendChild(botonNumero);
    }

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
      ${celda(admin.email)}
      ${celda(etiquetaRolAdmin(admin.role))}
      ${celda(formatearFecha(admin.createdAt))}
    `;
    cuerpoTablaAdmins.appendChild(fila);
  }
}

async function cargarPerfilAdmin() {
  const respuesta = await fetchAdmin('/api/admin/perfil');
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'No se pudo cargar el perfil');
  }
  esSuperAdmin = Boolean(datos.esSuperAdmin);
  aplicarPermisosSuperAdmin();
}

function aplicarResultadoRegistros(datos) {
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

async function cargarBootstrapAdmin() {
  mostrarCargandoTabla();
  reiniciarPaginacion();

  const params = new URLSearchParams();
  params.set('limit', String(FILAS_POR_PAGINA));
  if (filtroEstado.value) params.set('status', filtroEstado.value);
  if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());

  let datos;
  try {
    const respuesta = await fetchAdmin(`/api/admin/bootstrap?${params}`);
    datos = await leerJson(respuesta);
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No se pudo cargar el panel');
    }
  } catch (error) {
    mostrarMensajeTabla('No se pudieron cargar los registros.');
    throw error;
  }

  esSuperAdmin = Boolean(datos.perfil?.esSuperAdmin);
  aplicarPermisosSuperAdmin();
  aplicarResultadoRegistros(datos);
}

async function cargarListadoAdmins() {
  const respuesta = await fetchAdmin('/api/admin/admins');
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
  } · ${etiquetaKit(registro.kitType, registro.kitComponents)}`;
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
  mostrarCargandoTabla();

  const params = new URLSearchParams();
  params.set('limit', String(FILAS_POR_PAGINA));
  if (filtroEstado.value) params.set('status', filtroEstado.value);
  if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());

  const cursor = cursoresInicioPagina[paginaIndice];
  if (cursor) params.set('cursor', cursor);

  let datos;
  try {
    const respuesta = await fetchAdmin(`/api/admin/students?${params}`);
    datos = await leerJson(respuesta);
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Error al cargar estudiantes');
    }
  } catch (error) {
    mostrarMensajeTabla('No se pudieron cargar los registros.');
    throw error;
  }

  mostrarError(errorPanel, '');
  aplicarResultadoRegistros(datos);
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
    const respuesta = await fetchAdmin(`/api/admin/students/${registro.id}/deliver`, {
      method: 'PATCH',
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo marcar entrega');
    await obtenerRegistros();
  } catch (error) {
    mostrarError(errorPanel, error.message);
    boton.disabled = false;
  }
}

async function reenviarCorreo(registro, boton) {
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  try {
    const respuesta = await fetchAdmin(
      `/api/admin/students/${registro.id}/reenviar-correo`,
      { method: 'POST' }
    );
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo enviar el correo');
    await obtenerRegistros();
  } catch (error) {
    mostrarError(errorPanel, error.message);
    boton.disabled = false;
    boton.textContent = registro.emailEnviadoEn ? 'Reenviar correo' : 'Enviar correo';
  }
}

async function asignarNumeroCorredor(registro, boton) {
  boton.disabled = true;
  boton.textContent = 'Asignando…';
  try {
    const respuesta = await fetchAdmin(
      `/api/admin/students/${registro.id}/asignar-numero`,
      { method: 'POST' }
    );
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo asignar el número');
    await obtenerRegistros();
  } catch (error) {
    mostrarError(errorPanel, error.message);
    boton.disabled = false;
    boton.textContent = 'Asignar número';
  }
}

const MAX_PAGINAS_EXPORTACION = 40;

async function obtenerTodosParaExportar() {
  const todos = [];
  let cursor = null;

  for (let pagina = 0; pagina < MAX_PAGINAS_EXPORTACION; pagina += 1) {
    const params = new URLSearchParams();
    params.set('limit', '500');
    if (filtroEstado.value) params.set('status', filtroEstado.value);
    if (filtroBusqueda.value.trim()) params.set('search', filtroBusqueda.value.trim());
    if (cursor) params.set('cursor', cursor);

    const respuesta = await fetchAdmin(`/api/admin/students?${params}`);
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Error al cargar datos para exportar');
    }

    todos.push(...(datos.datos || []));
    cursor = datos.paginacion?.cursorSiguiente || null;
    if (!cursor) break;
  }

  return todos;
}

function actualizarCabeceraTablaEventos() {
  const esHackton = filtroTipoEvento.value === 'Hackton';
  if (esHackton) {
    cabeceraTablaEventos.innerHTML = `
      <tr>
        <th>Nombres</th>
        <th>Apellidos</th>
        <th>Correo</th>
        <th>Programa</th>
        <th>Cód. estudiante</th>
        <th>Estado correo</th>
        <th>Registro</th>
      </tr>`;
  } else {
    cabeceraTablaEventos.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Apellido</th>
        <th>Documento</th>
        <th>Teléfono</th>
        <th>Correo</th>
        <th>Cód. estudiante</th>
        <th>Emprendimiento</th>
        <th>Estado correo</th>
        <th>Registro</th>
      </tr>`;
  }
}

function estadoCorreoEvento(registro) {
  if (registro.emailEnviadoEn) return 'Enviado';
  if (registro.emailError) return `Error: ${registro.emailError}`;
  return '—';
}

function renderizarTablaEventos(registros) {
  cuerpoTablaEventos.innerHTML = '';
  const esHackton = filtroTipoEvento.value === 'Hackton';
  const columnas = esHackton ? 7 : 9;

  if (!registros.length) {
    cuerpoTablaEventos.innerHTML =
      `<tr><td colspan="${columnas}">No hay inscripciones con los filtros actuales.</td></tr>`;
    return;
  }

  for (const registro of registros) {
    const fila = document.createElement('tr');
    if (esHackton) {
      fila.innerHTML = `
        ${celda(registro.nombres)}
        ${celda(registro.apellidos)}
        ${celda(registro.correoElectronico)}
        ${celda(registro.programa)}
        ${celda(registro.codigoEstudiantil)}
        ${celda(estadoCorreoEvento(registro))}
        ${celda(formatearFecha(registro.createdAt))}
      `;
    } else {
      fila.innerHTML = `
        ${celda(registro.nombre)}
        ${celda(registro.apellido)}
        ${celda(`${registro.tipoDocumento || '—'} ${registro.numeroDocumento || ''}`.trim())}
        ${celda(registro.telefono)}
        ${celda(registro.correoElectronico)}
        ${celda(registro.codigoEstudiantil)}
        ${celda(registro.emprendimientoMarca)}
        ${celda(estadoCorreoEvento(registro))}
        ${celda(formatearFecha(registro.createdAt))}
      `;
    }
    cuerpoTablaEventos.appendChild(fila);
  }
}

function reiniciarPaginacionEventos() {
  paginaIndiceEventos = 0;
  cursoresInicioPaginaEventos = [null];
  hayMasPaginasEventos = false;
  eventosFiltrosCargados = '';
  registrosEventosCache = [];
}

function actualizarControlesPaginacionEventos() {
  textoPaginaActualEventos.textContent = `Página ${paginaIndiceEventos + 1}`;
  botonPaginaAnteriorEventos.disabled = paginaIndiceEventos <= 0;
  botonPaginaSiguienteEventos.disabled = !hayMasPaginasEventos;
}

async function obtenerInscripcionesEventos(opciones = {}) {
  const { reiniciar = false } = opciones;
  if (reiniciar) reiniciarPaginacionEventos();

  const params = new URLSearchParams();
  params.set('tipoEvento', filtroTipoEvento.value);
  params.set('limit', String(FILAS_POR_PAGINA));
  if (filtroBusquedaEventos.value.trim()) {
    params.set('search', filtroBusquedaEventos.value.trim());
  }

  const cursor = cursoresInicioPaginaEventos[paginaIndiceEventos];
  if (cursor) params.set('cursor', cursor);

  const respuesta = await fetchAdmin(`/api/admin/eventos?${params}`);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Error al cargar inscripciones');
  }

  hayMasPaginasEventos = Boolean(datos.paginacion?.hayMas);
  if (datos.paginacion?.cursorSiguiente) {
    cursoresInicioPaginaEventos[paginaIndiceEventos + 1] = datos.paginacion.cursorSiguiente;
  } else {
    cursoresInicioPaginaEventos = cursoresInicioPaginaEventos.slice(0, paginaIndiceEventos + 1);
  }

  registrosEventosCache = datos.datos || [];
  eventosFiltrosCargados = claveCacheEventos();
  renderizarTablaEventos(registrosEventosCache);
  actualizarControlesPaginacionEventos();
}

async function obtenerEventosParaExportar(tipoEvento) {
  const params = new URLSearchParams();
  params.set('tipoEvento', tipoEvento);
  params.set('limit', '500');

  const respuesta = await fetchAdmin(`/api/admin/eventos?${params}`);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Error al cargar datos de eventos');
  }
  return datos.datos || [];
}

function filasExcelHackton(registros) {
  return registros.map((r) => ({
    Nombres: r.nombres || '',
    Apellidos: r.apellidos || '',
    Correo: r.correoElectronico || '',
    Programa: r.programa || '',
    CodigoEstudiantil: r.codigoEstudiantil || '',
    CorreoEnviado: r.emailEnviadoEn || '',
    ErrorCorreo: r.emailError || '',
    FechaRegistro: r.createdAt || '',
  }));
}

function filasExcelFeria(registros) {
  return registros.map((r) => ({
    Nombre: r.nombre || '',
    Apellido: r.apellido || '',
    TipoDocumento: r.tipoDocumento || '',
    NumeroDocumento: r.numeroDocumento || '',
    Telefono: r.telefono || '',
    Correo: r.correoElectronico || '',
    CodigoEstudiantil: r.codigoEstudiantil || '',
    EmprendimientoMarca: r.emprendimientoMarca || '',
    CorreoEnviado: r.emailEnviadoEn || '',
    ErrorCorreo: r.emailError || '',
    FechaRegistro: r.createdAt || '',
  }));
}

async function exportarExcelEventos() {
  if (!esSuperAdmin) {
    mostrarError(errorPanelEventos, 'Exportación reservada a super administradores');
    return;
  }
  try {
    const XLSX = await cargarLibreriaXlsx();
    const [hackton, feria] = await Promise.all([
      obtenerEventosParaExportar('Hackton'),
      obtenerEventosParaExportar('FeriaEmprendimiento'),
    ]);

    if (!hackton.length && !feria.length) {
      mostrarError(errorPanelEventos, 'No hay inscripciones para exportar');
      return;
    }

    const libro = XLSX.utils.book_new();
    if (hackton.length) {
      const hojaHackton = XLSX.utils.json_to_sheet(filasExcelHackton(hackton));
      XLSX.utils.book_append_sheet(libro, hojaHackton, 'Hackton');
    }
    if (feria.length) {
      const hojaFeria = XLSX.utils.json_to_sheet(filasExcelFeria(feria));
      XLSX.utils.book_append_sheet(libro, hojaFeria, 'FeriaEmprendimiento');
    }

    XLSX.writeFile(
      libro,
      `eventos-uaf26-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    mostrarError(errorPanelEventos, '');
  } catch (error) {
    mostrarError(errorPanelEventos, error.message);
  }
}

async function exportarExcel() {
  if (!esSuperAdmin) {
    mostrarError(errorPanel, 'Exportación reservada a super administradores');
    return;
  }
  try {
    const XLSX = await cargarLibreriaXlsx();
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
        TipoDocumento: info.documentType || '',
        NumeroDocumento: info.documentNumber || '',
        CiudadResidencia: info.residenceCity || '',
        Direccion: info.address || '',
        Correo: info.email,
        'Quién eres': info.participantRole || '',
        Carrera: info.academicCareer || '',
        CodigoEstudiante: info.studentCode,
        Talla: info.shirtSize,
        NumeroCorredor: r.numeroCorredor || '',
        ErrorNumeroCorredor: r.numeroCorredorError || '',
        TipoKit: etiquetaKit(r.kitType, r.kitComponents),
        Componentes: Array.isArray(r.kitComponents) ? r.kitComponents.join(', ') : '',
        Tarifa: formatearTarifa(r),
        MontoCentavos: r.amount ?? '',
        CorreoEnviado: r.emailEnviadoEn || '',
        ErrorCorreo: r.emailError || '',
        CodigoReclamo: r.uniqueClaimCode || '',
        EstadoPago: r.status,
        AlertaPago: r.alertaPago || '',
        Referencia: r.reference,
        TransactionId: r.transactionId || '',
        FechaAprobacion: r.aprobadoEn || '',
        Entregado: r.kitClaimed ? 'Sí' : 'No',
        EntregadoPor: r.claimedByAdminEmail || '',
        FechaCreacion: r.createdAt || '',
        RegistroManual: r.registroManual ? 'Sí' : 'No',
        OrigenRegistro: r.origenRegistro || '',
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
  tokenActual = await usuario.getIdToken();
  correoAdmin.textContent = usuario.email;
  mostrarError(errorPanel, '');
  if (vistaPanel) vistaPanel.hidden = false;
  activarPestana('financiera');
  await cargarBootstrapAdmin();
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
pestanaEventos.addEventListener('click', () => activarPestana('eventos'));
pestanaAdministradores.addEventListener('click', () => {
  if (esSuperAdmin) activarPestana('administradores');
});

document.getElementById('boton-refrescar-eventos').addEventListener('click', () => {
  obtenerInscripcionesEventos({ reiniciar: true }).catch((e) =>
    mostrarError(errorPanelEventos, e.message)
  );
});
document.getElementById('boton-exportar-eventos').addEventListener('click', exportarExcelEventos);
botonPaginaAnteriorEventos.addEventListener('click', () => {
  if (paginaIndiceEventos <= 0) return;
  paginaIndiceEventos -= 1;
  obtenerInscripcionesEventos().catch((e) => mostrarError(errorPanelEventos, e.message));
});
botonPaginaSiguienteEventos.addEventListener('click', () => {
  if (!hayMasPaginasEventos) return;
  paginaIndiceEventos += 1;
  obtenerInscripcionesEventos().catch((e) => mostrarError(errorPanelEventos, e.message));
});

let temporizadorBusquedaEventos;
filtroBusquedaEventos.addEventListener('input', () => {
  clearTimeout(temporizadorBusquedaEventos);
  temporizadorBusquedaEventos = setTimeout(() => {
    if (!seccionEventos.hidden) {
      obtenerInscripcionesEventos({ reiniciar: true }).catch((e) =>
        mostrarError(errorPanelEventos, e.message)
      );
    }
  }, 350);
});
filtroTipoEvento.addEventListener('change', () => {
  actualizarCabeceraTablaEventos();
  obtenerInscripcionesEventos({ reiniciar: true }).catch((e) =>
    mostrarError(errorPanelEventos, e.message)
  );
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

async function poblarCiudadesManual() {
  if (!selectManualCiudad) return;

  const respuesta = await fetch('/api/config/ciudades');
  const datos = await respuesta.json();
  if (!respuesta.ok || !Array.isArray(datos.ciudades) || !datos.ciudades.length) {
    selectManualCiudad.innerHTML =
      '<option value="">No se pudieron cargar las ciudades</option>';
    throw new Error('No se pudieron cargar las ciudades');
  }

  selectManualCiudad.innerHTML = '<option value="">Seleccionar</option>';
  for (const ciudad of datos.ciudades) {
    const etiqueta =
      typeof ciudad === 'string' ? ciudad : ciudad.etiqueta || ciudad.nombre || '';
    if (!etiqueta) continue;
    const opcion = document.createElement('option');
    opcion.value = etiqueta;
    opcion.textContent = etiqueta;
    selectManualCiudad.appendChild(opcion);
  }
  selectManualCiudad.disabled = false;
}

function poblarCarrerasManual() {
  if (!manualAcademicCareer) return;
  manualAcademicCareer.innerHTML = '<option value="">Seleccionar</option>';
  for (const carrera of CARRERAS_ESTUDIANTE) {
    const opcion = document.createElement('option');
    opcion.value = carrera;
    opcion.textContent = carrera;
    manualAcademicCareer.appendChild(opcion);
  }
}

function esKitInstitucionalManual(tipo) {
  return tipo === 'uniautonomo' || tipo === 'personalizado';
}

function manualIncluyeCarrera() {
  if (manualKitType.value === 'uniautonomo') return true;
  if (manualKitType.value !== 'personalizado') return false;
  return Array.from(
    formularioRegistroManual.querySelectorAll('input[name="manualComponente"]:checked')
  ).some((input) => input.value === 'carrera');
}

function actualizarFormularioManual() {
  const esPersonalizado = manualKitType.value === 'personalizado';
  const esInstitucional = esKitInstitucionalManual(manualKitType.value);
  const esEstudiante = manualParticipantRole.value === 'Estudiante';

  manualComponentes.hidden = !esPersonalizado;
  manualTransactionId.hidden = manualOrigenRegistro.value !== 'WOMPI_EXTERNO';
  manualCampoRol.hidden = !esInstitucional;
  manualCampoCarrera.hidden = !esInstitucional || !esEstudiante;
  manualCampoCodigo.hidden = !esInstitucional || !esEstudiante;
  manualCampoTalla.hidden = !manualIncluyeCarrera();
}

function obtenerComponentesManual() {
  return Array.from(
    formularioRegistroManual.querySelectorAll('input[name="manualComponente"]:checked')
  ).map((input) => input.value);
}

function construirPersonalInfoManual() {
  const datos = new FormData(formularioRegistroManual);
  const info = {
    firstName: datos.get('firstName'),
    secondName: datos.get('secondName') || '',
    firstSurname: datos.get('firstSurname'),
    secondSurname: datos.get('secondSurname') || '',
    documentType: datos.get('documentType'),
    documentNumber: datos.get('documentNumber'),
    residenceCity: datos.get('residenceCity'),
    address: datos.get('address') || '',
    email: datos.get('email'),
    participantRole: datos.get('participantRole') || '',
    academicCareer: datos.get('academicCareer') || '',
    studentCode: datos.get('studentCode') || '',
    shirtSize: datos.get('shirtSize') || '',
  };
  return info;
}

function construirCuerpoRegistroManual() {
  const kitType = manualKitType.value;
  const kitComponents = kitType === 'personalizado' ? obtenerComponentesManual() : [];
  return {
    kitType,
    kitComponents,
    personalInfo: construirPersonalInfoManual(),
  };
}

if (formularioRegistroManual) {
  poblarCarrerasManual();
  poblarCiudadesManual().catch((error) => {
    mostrarError(errorRegistroManual, error.message);
  });
  actualizarFormularioManual();

  manualKitType.addEventListener('change', actualizarFormularioManual);
  manualOrigenRegistro.addEventListener('change', actualizarFormularioManual);
  manualParticipantRole.addEventListener('change', actualizarFormularioManual);
  formularioRegistroManual
    .querySelectorAll('input[name="manualComponente"]')
    .forEach((input) => input.addEventListener('change', actualizarFormularioManual));

  formularioRegistroManual.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarError(errorRegistroManual, '');
    mensajeRegistroManual.hidden = true;

    const cuerpo = construirCuerpoRegistroManual();

    try {
      const respuesta = await fetchAdmin('/api/admin/students/registro-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cuerpo,
          origenRegistro: manualOrigenRegistro.value,
          transactionId: formularioRegistroManual.transactionId?.value?.trim() || '',
          notas: formularioRegistroManual.notas?.value?.trim() || '',
          enviarCorreo: manualEnviarCorreoCheck.checked,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo registrar');

      mensajeRegistroManual.textContent =
        `Registrado. Código: ${datos.dato?.uniqueClaimCode || '—'} · Núm. corredor: ${datos.dato?.numeroCorredor || '—'}`;
      mensajeRegistroManual.hidden = false;
      formularioRegistroManual.reset();
      poblarCarrerasManual();
      actualizarFormularioManual();
      await obtenerRegistros({ reiniciar: true });
    } catch (error) {
      mostrarError(errorRegistroManual, error.message);
    }
  });
}

if (pestanaRegistroManual) {
  pestanaRegistroManual.addEventListener('click', () => {
    if (esSuperAdmin) activarPestana('registro-manual');
  });
}

formularioCrearAdmin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensajeCrearAdmin.hidden = true;
  mensajeCrearAdmin.classList.remove('mensaje-crear-admin--error');

  const correo = formularioCrearAdmin.correo.value.trim();
  const contrasena = formularioCrearAdmin.contrasena.value;
  const role = formularioCrearAdmin.rol.value;

  try {
    const respuesta = await fetchAdmin('/api/admin/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  precalentarPanelAdmin();
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
