const { FieldValue } = require('firebase-admin/firestore');
const { obtenerFirestore } = require('../config/firebase');

const COLECCION = 'payments';

function serializarDocumento(id, datos) {
  const createdAt = datos.createdAt?.toDate?.()
    ? datos.createdAt.toDate().toISOString()
    : datos.createdAt ?? null;
  const claimedAt = datos.claimedAt?.toDate?.()
    ? datos.claimedAt.toDate().toISOString()
    : datos.claimedAt ?? null;
  const emailEnviadoEn = datos.emailEnviadoEn?.toDate?.()
    ? datos.emailEnviadoEn.toDate().toISOString()
    : datos.emailEnviadoEn ?? null;

  return {
    id,
    ...datos,
    createdAt,
    claimedAt,
    emailEnviadoEn,
  };
}

async function crearPagoPendiente(datos) {
  const db = obtenerFirestore();
  const referencia = db.collection(COLECCION).doc();
  const carga = {
    reference: datos.reference,
    transactionId: null,
    personalInfo: datos.personalInfo,
    kitType: datos.kitType,
    amount: datos.amount,
    status: 'PENDING',
    uniqueClaimCode: null,
    kitClaimed: false,
    claimedAt: null,
    claimedByAdminEmail: null,
    emailEnviadoEn: null,
    emailError: null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await referencia.set(carga);
  return { id: referencia.id, ...carga };
}

async function buscarPendienteReciente({ email, kitType, amount, ventanaMinutos = 30 }) {
  const db = obtenerFirestore();
  const limite = new Date(Date.now() - ventanaMinutos * 60 * 1000);

  const consulta = await db
    .collection(COLECCION)
    .where('status', '==', 'PENDING')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  for (const doc of consulta.docs) {
    const datos = doc.data();
    if (datos.kitType !== kitType || datos.amount !== amount) continue;
    const creado = datos.createdAt?.toDate?.();
    if (creado && creado.getTime() < limite.getTime()) continue;
    const info = datos.personalInfo || {};
    if (info.email === email) {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

async function actualizarInformacionPendiente(id, { personalInfo }) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({ personalInfo });
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

async function marcarAprobado(id, { transactionId, uniqueClaimCode }) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    status: 'APPROVED',
    transactionId,
    uniqueClaimCode,
  });
}

async function marcarRechazado(id, transactionId) {
  const db = obtenerFirestore();
  await db.collection(COLECCION).doc(id).update({
    status: 'REJECTED',
    transactionId: transactionId ?? null,
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

const LIMITE_FILAS_POR_PAGINA = 6;
const LOTE_BUSQUEDA_FIRESTORE = 12;
const MAX_LECTURAS_BUSQUEDA_NOMBRE = 20;
const LIMITE_TERMINO_BUSQUEDA = 120;

function coincideBusqueda(pago, termino) {
  if (!termino) return true;
  const info = pago.personalInfo || {};
  const nombreCompleto = [
    info.firstName,
    info.secondName,
    info.firstSurname,
    info.secondSurname,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    nombreCompleto.includes(termino) ||
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
  if (/^uaf26-pay-/i.test(termino)) return 'reference';
  if (/^uaf26-/i.test(termino)) return 'claimCode';
  if (/^\d+$/.test(termino)) return 'studentCode';
  return 'nombre';
}

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
  if (estrategia === 'nombre') {
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
  const modoExportacion = !cursor && limiteSolicitado >= 100;
  const filasPorPagina = modoExportacion
    ? Math.min(500, limiteSolicitado)
    : Math.min(
        LIMITE_FILAS_POR_PAGINA,
        Math.max(1, limiteSolicitado || LIMITE_FILAS_POR_PAGINA)
      );
  const termino = sanitizarTermino(busqueda).toLowerCase();

  if (modoExportacion) {
    let consultaExport = construirConsultaPagos(db, status);
    const snapshot = await consultaExport.limit(filasPorPagina).get();
    let datos = snapshot.docs.map((doc) => serializarDocumento(doc.id, doc.data()));
    if (termino) {
      datos = datos.filter((pago) => coincideBusqueda(pago, termino));
    }
    return {
      datos,
      paginacion: {
        limite: filasPorPagina,
        hayMas: false,
        cursorSiguiente: null,
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
  buscarPendienteReciente,
  actualizarInformacionPendiente,
  buscarPorReferencia,
  obtenerPorId,
  marcarAprobado,
  marcarRechazado,
  marcarEntregado,
  marcarCorreoEnviado,
  registrarErrorCorreo,
  listarPagos,
};
