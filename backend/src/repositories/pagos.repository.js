const { FieldValue } = require('firebase-admin/firestore');
const { obtenerFirestore } = require('../config/firebase');
const { esKitInstitucional } = require('../config/catalogoKits');
const {
  debeAsignarNumeroCorredor,
  reservarNumeroEnTransaccion,
} = require('../services/numeroCorredor.service');
const {
  normalizarTextoBusqueda,
  camposBusquedaNombre,
} = require('../utilidades/busquedaNombre');

const COLECCION = 'payments';

function componentesCoinciden(a, b) {
  const listaA = Array.isArray(a) ? [...a].sort() : [];
  const listaB = Array.isArray(b) ? [...b].sort() : [];
  if (listaA.length !== listaB.length) return false;
  return listaA.every((valor, indice) => valor === listaB[indice]);
}

function fechaIso(valor) {
  return valor?.toDate?.() ? valor.toDate().toISOString() : valor ?? null;
}

function serializarDocumento(id, datos) {
  return {
    id,
    ...datos,
    createdAt: fechaIso(datos.createdAt),
    claimedAt: fechaIso(datos.claimedAt),
    emailEnviadoEn: fechaIso(datos.emailEnviadoEn),
    aprobadoEn: fechaIso(datos.aprobadoEn),
    alertaPagoEn: fechaIso(datos.alertaPagoEn),
  };
}

async function crearPagoPendiente(datos) {
  const db = obtenerFirestore();
  const referencia = db.collection(COLECCION).doc();
  const carga = {
    reference: datos.reference,
    transactionId: datos.transactionId ?? null,
    personalInfo: datos.personalInfo,
    ...camposBusquedaNombre(datos.personalInfo),
    kitType: datos.kitType,
    kitComponents: datos.kitComponents || [],
    amount: datos.amount,
    status: 'PENDING',
    uniqueClaimCode: null,
    numeroCorredor: null,
    kitClaimed: false,
    claimedAt: null,
    claimedByAdminEmail: null,
    emailEnviadoEn: null,
    emailError: null,
    registroManual: Boolean(datos.registroManual),
    origenRegistro: datos.origenRegistro || null,
    notasRegistro: datos.notasRegistro || null,
    registradoPorAdminEmail: datos.registradoPorAdminEmail || null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await referencia.set(carga);
  return { id: referencia.id, ...carga };
}

async function crearRegistroManualAprobado(datos, generarCodigo) {
  const pagoPendiente = await crearPagoPendiente({
    reference: datos.reference,
    transactionId: datos.transactionId ?? null,
    personalInfo: datos.personalInfo,
    kitType: datos.kitType,
    kitComponents: datos.kitComponents || [],
    amount: datos.amount,
    registroManual: true,
    origenRegistro: datos.origenRegistro,
    notasRegistro: datos.notas || null,
    registradoPorAdminEmail: datos.registradoPorAdminEmail,
  });

  const resultado = await aprobarPagoAtomico(pagoPendiente.id, {
    transactionId: datos.transactionId ?? null,
    generarCodigo,
  });

  if (!resultado.aprobado && !resultado.idempotente) {
    const err = new Error('No se pudo aprobar el registro manual');
    err.codigo = 500;
    throw err;
  }

  return obtenerPorId(pagoPendiente.id);
}

async function buscarPendienteReciente({
  email,
  kitType,
  kitComponents = [],
  amount,
  ventanaMinutos = 30,
}) {
  const db = obtenerFirestore();
  const limite = new Date(Date.now() - ventanaMinutos * 60 * 1000);

  let consulta;
  try {
    consulta = await db
      .collection(COLECCION)
      .where('personalInfo.email', '==', email)
      .where('status', '==', 'PENDING')
      .where('createdAt', '>=', limite)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
  } catch (error) {
    if (!esIndiceFirestorePendiente(error)) throw error;
    console.warn('[pagos] índice email+status en construcción; se crea un pago nuevo');
    return null;
  }

  for (const doc of consulta.docs) {
    const datos = doc.data();
    if (datos.kitType !== kitType || datos.amount !== amount) continue;
    if (!componentesCoinciden(datos.kitComponents, kitComponents)) continue;
    return serializarDocumento(doc.id, datos);
  }
  return null;
}

async function buscarPendienteInstitucionalPorCorreo(email, { horasMaximas = null } = {}) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) return null;

  let consulta = db
    .collection(COLECCION)
    .where('personalInfo.email', '==', correo)
    .where('status', '==', 'PENDING')
    .orderBy('createdAt', 'desc')
    .limit(10);

  if (horasMaximas != null && horasMaximas > 0) {
    const limite = new Date(Date.now() - horasMaximas * 60 * 60 * 1000);
    consulta = db
      .collection(COLECCION)
      .where('personalInfo.email', '==', correo)
      .where('status', '==', 'PENDING')
      .where('createdAt', '>=', limite)
      .orderBy('createdAt', 'desc')
      .limit(10);
  }

  let snapshot;
  try {
    snapshot = await consulta.get();
  } catch (error) {
    if (!esIndiceFirestorePendiente(error)) throw error;
    console.warn('[pagos] índice email+status en construcción; no se reutiliza PENDING');
    return null;
  }

  for (const doc of snapshot.docs) {
    const datos = doc.data();
    if (esKitInstitucional(datos.kitType)) {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function buscarPagoInstitucionalAprobado(email) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) return null;

  const consulta = await db
    .collection(COLECCION)
    .where('status', '==', 'APPROVED')
    .where('personalInfo.email', '==', correo)
    .limit(20)
    .get();

  for (const doc of consulta.docs) {
    const datos = doc.data();
    if (esKitInstitucional(datos.kitType)) {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function buscarPagoUniautonomoAprobado(email) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) return null;

  const consulta = await db
    .collection(COLECCION)
    .where('status', '==', 'APPROVED')
    .where('personalInfo.email', '==', correo)
    .limit(20)
    .get();

  for (const doc of consulta.docs) {
    const datos = doc.data();
    if (datos.kitType === 'uniautonomo') {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function obtenerComponentesPersonalizadosAprobados(email) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  const componentes = new Set();
  if (!correo) return componentes;

  const consulta = await db
    .collection(COLECCION)
    .where('status', '==', 'APPROVED')
    .where('personalInfo.email', '==', correo)
    .limit(20)
    .get();

  for (const doc of consulta.docs) {
    const datos = doc.data();
    if (datos.kitType !== 'personalizado') continue;
    const lista = Array.isArray(datos.kitComponents) ? datos.kitComponents : [];
    for (const componente of lista) {
      const clave = String(componente || '').trim();
      if (clave) componentes.add(clave);
    }
  }
  return componentes;
}

async function buscarPendienteUniautonomoPorCorreo(email, { horasMaximas = null } = {}) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) return null;

  let consulta = db
    .collection(COLECCION)
    .where('personalInfo.email', '==', correo)
    .where('status', '==', 'PENDING')
    .orderBy('createdAt', 'desc')
    .limit(10);

  if (horasMaximas != null && horasMaximas > 0) {
    const limite = new Date(Date.now() - horasMaximas * 60 * 60 * 1000);
    consulta = db
      .collection(COLECCION)
      .where('personalInfo.email', '==', correo)
      .where('status', '==', 'PENDING')
      .where('createdAt', '>=', limite)
      .orderBy('createdAt', 'desc')
      .limit(10);
  }

  let snapshot;
  try {
    snapshot = await consulta.get();
  } catch (error) {
    if (!esIndiceFirestorePendiente(error)) throw error;
    console.warn('[pagos] índice email+status en construcción; no se reutiliza PENDING uniautónomo');
    return null;
  }

  for (const doc of snapshot.docs) {
    const datos = doc.data();
    if (datos.kitType === 'uniautonomo') {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function buscarPendientePersonalizadoPorCorreo(email, kitComponents) {
  const db = obtenerFirestore();
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) return null;

  let snapshot;
  try {
    snapshot = await db
      .collection(COLECCION)
      .where('personalInfo.email', '==', correo)
      .where('status', '==', 'PENDING')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
  } catch (error) {
    if (!esIndiceFirestorePendiente(error)) throw error;
    console.warn('[pagos] índice email+status en construcción; no se reutiliza PENDING personalizado');
    return null;
  }

  for (const doc of snapshot.docs) {
    const datos = doc.data();
    if (datos.kitType !== 'personalizado') continue;
    if (componentesCoinciden(datos.kitComponents, kitComponents)) {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function actualizarInformacionPendiente(
  id,
  { personalInfo, kitComponents, kitType, amount }
) {
  const db = obtenerFirestore();
  const actualizacion = { personalInfo, ...camposBusquedaNombre(personalInfo) };
  if (kitComponents !== undefined) {
    actualizacion.kitComponents = kitComponents;
  }
  if (kitType !== undefined) {
    actualizacion.kitType = kitType;
  }
  if (amount !== undefined) {
    actualizacion.amount = amount;
  }
  await db.collection(COLECCION).doc(id).update(actualizacion);
}

async function marcarCorreoEnviado(id) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    emailEnviadoEn: FieldValue.serverTimestamp(),
    emailError: null,
  });
}

async function registrarErrorCorreo(id, mensaje) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    emailError: String(mensaje).slice(0, 500),
  });
}

async function buscarPorReferencia(reference) {
  const db = obtenerFirestore();
  const consulta = await db
    .collection(COLECCION)
    .where('reference', '==', reference)
    .limit(1)
    .get();

  if (consulta.empty) return null;
  const doc = consulta.docs[0];
  return serializarDocumento(doc.id, doc.data());
}

async function obtenerPorId(id) {
  const db = obtenerFirestore();
  const doc = await db.collection(COLECCION).doc(id).get();
  if (!doc.exists) return null;
  return serializarDocumento(doc.id, doc.data());
}

/**
 * Aprueba el pago y, si aplica, le asigna número de corredor en una única transacción.
 * Si dos procesos (webhook y confirmación del navegador) llegan a la vez, Firestore
 * reintenta al perdedor, que entonces ve APPROVED y no reserva un segundo número.
 */
async function aprobarPagoAtomico(id, { transactionId, generarCodigo }) {
  const db = obtenerFirestore();
  const refPago = db.collection(COLECCION).doc(id);

  return db.runTransaction(async (transaccion) => {
    const snapshot = await transaccion.get(refPago);
    if (!snapshot.exists) {
      return { aprobado: false, motivo: 'pago_no_encontrado' };
    }

    const datos = snapshot.data();
    if (datos.status === 'APPROVED') {
      return { aprobado: false, idempotente: true };
    }

    let reserva = null;
    let numeroCorredorError = null;

    if (debeAsignarNumeroCorredor(datos.kitType, datos.kitComponents)) {
      try {
        reserva = await reservarNumeroEnTransaccion(db, transaccion, {
          paymentId: id,
          reference: datos.reference,
          email: datos.personalInfo?.email,
        });
      } catch (error) {
        numeroCorredorError = error?.message || 'Error al asignar número de corredor';
      }
    }

    const actualizacion = {
      status: 'APPROVED',
      transactionId: transactionId ?? null,
      uniqueClaimCode: generarCodigo(),
      aprobadoEn: FieldValue.serverTimestamp(),
      numeroCorredor: reserva ? reserva.numero : null,
      numeroCorredorError: numeroCorredorError
        ? String(numeroCorredorError).slice(0, 500)
        : null,
    };

    if (reserva) reserva.escribir();
    transaccion.update(refPago, actualizacion);

    return {
      aprobado: true,
      numeroCorredor: actualizacion.numeroCorredor,
      numeroCorredorError: actualizacion.numeroCorredorError,
    };
  });
}

/**
 * Reintenta asignar número a un pago aprobado que quedó sin número (p. ej. error transitorio).
 */
async function asignarNumeroPendiente(id) {
  const db = obtenerFirestore();
  const refPago = db.collection(COLECCION).doc(id);

  return db.runTransaction(async (transaccion) => {
    const snapshot = await transaccion.get(refPago);
    if (!snapshot.exists) {
      const err = new Error('Registro no encontrado');
      err.codigo = 404;
      throw err;
    }

    const datos = snapshot.data();
    if (datos.status !== 'APPROVED') {
      const err = new Error('Solo se asigna número a pagos aprobados');
      err.codigo = 400;
      throw err;
    }
    if (datos.numeroCorredor) {
      return { numeroCorredor: datos.numeroCorredor, idempotente: true };
    }
    if (!debeAsignarNumeroCorredor(datos.kitType, datos.kitComponents)) {
      const err = new Error('Este kit no incluye número de corredor');
      err.codigo = 400;
      throw err;
    }

    const reserva = await reservarNumeroEnTransaccion(db, transaccion, {
      paymentId: id,
      reference: datos.reference,
      email: datos.personalInfo?.email,
    });

    reserva.escribir();
    transaccion.update(refPago, {
      numeroCorredor: reserva.numero,
      numeroCorredorError: null,
    });

    return { numeroCorredor: reserva.numero };
  });
}

async function marcarRechazado(id, transactionId) {
  const db = obtenerFirestore();
  const refPago = db.collection(COLECCION).doc(id);

  return db.runTransaction(async (transaccion) => {
    const snapshot = await transaccion.get(refPago);
    if (!snapshot.exists || snapshot.data().status !== 'PENDING') {
      return false;
    }
    transaccion.update(refPago, {
      status: 'REJECTED',
      transactionId: transactionId ?? null,
    });
    return true;
  });
}

async function registrarAlertaPago(id, alerta) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    alertaPago: String(alerta).slice(0, 500),
    alertaPagoEn: FieldValue.serverTimestamp(),
  });
}

async function marcarEntregado(id, correoAdmin) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    kitClaimed: true,
    claimedAt: FieldValue.serverTimestamp(),
    claimedByAdminEmail: correoAdmin,
  });
}

const LIMITE_FILAS_POR_PAGINA = 15;
const LOTE_BUSQUEDA_FIRESTORE = 12;
const MAX_LECTURAS_BUSQUEDA_NOMBRE = 20;
const LIMITE_TERMINO_BUSQUEDA = 120;

function coincideBusqueda(pago, termino) {
  if (!termino) return true;
  const info = pago.personalInfo || {};
  const nombreCompleto = camposBusquedaNombre(info).nombreBusqueda;
  return (
    nombreCompleto.includes(normalizarTextoBusqueda(termino)) ||
    String(info.documentNumber || '').includes(termino) ||
    String(pago.numeroCorredor || '') === termino.padStart(3, '0') ||
    String(info.studentCode || '')
      .toLowerCase()
      .includes(termino) ||
    String(info.email || '')
      .toLowerCase()
      .includes(termino) ||
    String(pago.uniqueClaimCode || '')
      .toLowerCase()
      .includes(termino) ||
    String(pago.reference || '')
      .toLowerCase()
      .includes(termino)
  );
}

function sanitizarTermino(busqueda) {
  return String(busqueda || '').trim().slice(0, LIMITE_TERMINO_BUSQUEDA);
}

function detectarEstrategiaBusqueda(termino) {
  if (termino.includes('@')) return 'email';
  if (/^unifest26-pay-/i.test(termino)) return 'reference';
  if (/^uaf26-pay-/i.test(termino)) return 'reference';
  if (/^uaf26-/i.test(termino)) return 'claimCode';
  if (/^\d{1,3}$/.test(termino)) return 'numeroCorredor';
  if (/^\d+$/.test(termino)) return 'documento';
  if (!/\s/.test(termino)) return 'nombrePalabra';
  return 'nombrePrefijo';
}

// Si la búsqueda indexada no trae nada, se intenta otra: un número largo puede ser
// código de estudiante, y registros antiguos pueden no tener los campos de nombre.
const ESTRATEGIA_RESPALDO = {
  documento: 'studentCode',
  nombrePalabra: 'escaneo',
  nombrePrefijo: 'escaneo',
};

function construirConsultaPagos(db, status) {
  if (status) {
    return db
      .collection(COLECCION)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc');
  }
  return db.collection(COLECCION).orderBy('createdAt', 'desc');
}

function construirConsultaPagosIndexada(db, estrategia, termino) {
  const coleccion = db.collection(COLECCION);

  if (estrategia === 'email') {
    return coleccion
      .where('personalInfo.email', '==', termino.toLowerCase())
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'reference') {
    return coleccion.where('reference', '==', termino).orderBy('createdAt', 'desc');
  }
  if (estrategia === 'claimCode') {
    return coleccion
      .where('uniqueClaimCode', '==', termino.toUpperCase())
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'studentCode') {
    return coleccion
      .where('personalInfo.studentCode', '==', termino)
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'numeroCorredor') {
    return coleccion
      .where('numeroCorredor', '==', termino.padStart(3, '0'))
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'documento') {
    return coleccion
      .where('personalInfo.documentNumber', '==', termino)
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'nombrePalabra') {
    return coleccion
      .where('tokensNombre', 'array-contains', normalizarTextoBusqueda(termino))
      .orderBy('createdAt', 'desc');
  }
  if (estrategia === 'nombrePrefijo') {
    const prefijo = normalizarTextoBusqueda(termino);
    return coleccion
      .where('nombreBusqueda', '>=', prefijo)
      .where('nombreBusqueda', '<=', `${prefijo}\uf8ff`)
      .orderBy('nombreBusqueda')
      .orderBy('createdAt', 'desc');
  }

  return null;
}

function filtrarPorStatus(pagos, status) {
  if (!status) return pagos;
  return pagos.filter((pago) => pago.status === status);
}

function esIndiceFirestorePendiente(error) {
  if (!error) return false;
  const detalle = String(error.details || error.message || '');
  return (
    error.code === 9 ||
    detalle.includes('FAILED_PRECONDITION') ||
    detalle.includes('requires an index')
  );
}

async function buscarPagosPorNombre({
  db,
  status,
  termino,
  filasPorPagina,
  cursor,
}) {
  let consulta = construirConsultaPagos(db, status);
  if (cursor) {
    const docCursor = await db.collection(COLECCION).doc(String(cursor)).get();
    if (docCursor.exists) {
      consulta = consulta.startAfter(docCursor);
    }
  }

  const resultados = [];
  let ultimoDocLeido = null;
  let hayMas = false;
  let lecturasFirestore = 0;

  while (resultados.length < filasPorPagina && lecturasFirestore < MAX_LECTURAS_BUSQUEDA_NOMBRE) {
    const snapshot = await consulta.limit(LOTE_BUSQUEDA_FIRESTORE).get();
    if (snapshot.empty) break;

    lecturasFirestore += snapshot.size;
    for (const doc of snapshot.docs) {
      ultimoDocLeido = doc;
      const pago = serializarDocumento(doc.id, doc.data());
      if (coincideBusqueda(pago, termino)) {
        resultados.push(pago);
        if (resultados.length >= filasPorPagina) break;
      }
    }

    if (snapshot.size < LOTE_BUSQUEDA_FIRESTORE) break;
    consulta = construirConsultaPagos(db, status).startAfter(ultimoDocLeido);
  }

  if (ultimoDocLeido && lecturasFirestore < MAX_LECTURAS_BUSQUEDA_NOMBRE) {
    const prueba = await construirConsultaPagos(db, status)
      .startAfter(ultimoDocLeido)
      .limit(1)
      .get();
    hayMas = !prueba.empty;
    lecturasFirestore += prueba.size;
  }

  return {
    datos: resultados,
    paginacion: {
      limite: filasPorPagina,
      hayMas,
      cursorSiguiente: hayMas && ultimoDocLeido ? ultimoDocLeido.id : null,
      lecturasFirestore,
    },
  };
}

async function buscarPagosIndexado({
  db,
  status,
  estrategia,
  termino,
  filasPorPagina,
  cursor,
}) {
  if (estrategia === 'escaneo') {
    return buscarPagosPorNombre({
      db,
      status,
      termino,
      filasPorPagina,
      cursor,
    });
  }

  let consulta = construirConsultaPagosIndexada(db, estrategia, termino);
  if (!consulta) {
    return buscarPagosPorNombre({
      db,
      status,
      termino,
      filasPorPagina,
      cursor,
    });
  }

  if (cursor) {
    const docCursor = await db.collection(COLECCION).doc(String(cursor)).get();
    if (docCursor.exists) {
      consulta = consulta.startAfter(docCursor);
    }
  }

  try {
    const snapshot = await consulta.limit(filasPorPagina + 1).get();
    let datos = snapshot.docs.map((doc) => serializarDocumento(doc.id, doc.data()));
    datos = filtrarPorStatus(datos, status);

    const hayMas = snapshot.size > filasPorPagina;
    const pagina = datos.slice(0, filasPorPagina);
    const ultimoDoc = snapshot.docs[Math.min(filasPorPagina, snapshot.docs.length - 1)];

    const respaldo = ESTRATEGIA_RESPALDO[estrategia];
    if (!pagina.length && !cursor && respaldo) {
      return buscarPagosIndexado({
        db,
        status,
        estrategia: respaldo,
        termino,
        filasPorPagina,
        cursor,
      });
    }

    return {
      datos: pagina,
      paginacion: {
        limite: filasPorPagina,
        hayMas,
        cursorSiguiente: hayMas && ultimoDoc ? ultimoDoc.id : null,
        lecturasFirestore: snapshot.size,
      },
    };
  } catch (error) {
    if (!esIndiceFirestorePendiente(error)) {
      throw error;
    }
    console.warn(
      '[pagos] índice Firestore en construcción, usando búsqueda alternativa:',
      estrategia
    );
    return buscarPagosPorNombre({
      db,
      status,
      termino,
      filasPorPagina,
      cursor,
    });
  }
}

async function listarPagos({
  status,
  busqueda,
  limite = LIMITE_FILAS_POR_PAGINA,
  cursor,
}) {
  const db = obtenerFirestore();
  const limiteSolicitado = Number.parseInt(String(limite), 10);
  const modoExportacion = limiteSolicitado >= 100;
  const filasPorPagina = modoExportacion
    ? Math.min(500, limiteSolicitado)
    : Math.min(
        LIMITE_FILAS_POR_PAGINA,
        Math.max(1, limiteSolicitado || LIMITE_FILAS_POR_PAGINA)
      );
  const termino = sanitizarTermino(busqueda).toLowerCase();

  if (modoExportacion) {
    let consultaExport = construirConsultaPagos(db, status);
    if (cursor) {
      const docCursor = await db.collection(COLECCION).doc(String(cursor)).get();
      if (docCursor.exists) {
        consultaExport = consultaExport.startAfter(docCursor);
      }
    }
    const snapshot = await consultaExport.limit(filasPorPagina + 1).get();
    const docs = snapshot.docs.slice(0, filasPorPagina);
    const hayMas = snapshot.size > filasPorPagina;
    let datos = docs.map((doc) => serializarDocumento(doc.id, doc.data()));
    if (termino) {
      datos = datos.filter((pago) => coincideBusqueda(pago, termino));
    }
    return {
      datos,
      paginacion: {
        limite: filasPorPagina,
        hayMas,
        cursorSiguiente: hayMas && docs.length ? docs[docs.length - 1].id : null,
        lecturasFirestore: snapshot.size,
      },
    };
  }
  if (termino) {
    const estrategia = detectarEstrategiaBusqueda(termino);
    return buscarPagosIndexado({
      db,
      status,
      estrategia,
      termino,
      filasPorPagina,
      cursor,
    });
  }

  let consulta = construirConsultaPagos(db, status);

  if (cursor) {
    const docCursor = await db.collection(COLECCION).doc(String(cursor)).get();
    if (docCursor.exists) {
      consulta = consulta.startAfter(docCursor);
    }
  }

  const snapshot = await consulta.limit(filasPorPagina + 1).get();
  const lecturasFirestore = snapshot.size;
  const docs = snapshot.docs.slice(0, filasPorPagina);
  const hayMas = snapshot.size > filasPorPagina;
  const resultados = docs.map((doc) => serializarDocumento(doc.id, doc.data()));
  const ultimoDocLeido = docs[docs.length - 1] || null;

  return {
    datos: resultados,
    paginacion: {
      limite: filasPorPagina,
      hayMas,
      cursorSiguiente: hayMas && ultimoDocLeido ? ultimoDocLeido.id : null,
      lecturasFirestore,
    },
  };
}

module.exports = {
  crearPagoPendiente,
  crearRegistroManualAprobado,
  buscarPendienteReciente,
  buscarPendienteInstitucionalPorCorreo,
  buscarPagoInstitucionalAprobado,
  buscarPagoUniautonomoAprobado,
  obtenerComponentesPersonalizadosAprobados,
  buscarPendienteUniautonomoPorCorreo,
  buscarPendientePersonalizadoPorCorreo,
  actualizarInformacionPendiente,
  buscarPorReferencia,
  obtenerPorId,
  aprobarPagoAtomico,
  asignarNumeroPendiente,
  marcarRechazado,
  registrarAlertaPago,
  marcarEntregado,
  marcarCorreoEnviado,
  registrarErrorCorreo,
  listarPagos,
};
