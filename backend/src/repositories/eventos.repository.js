const { FieldValue } = require('firebase-admin/firestore');
const { obtenerFirestore } = require('../config/firebase');

const COLECCION_EVENTOS = 'eventos';
const DOCUMENTO_RAIZ = 'uaf2026';
const SUBCOLECCIONES = {
  Hackton: 'Hackton',
  FeriaEmprendimiento: 'FeriaEmprendimiento',
};

function referenciaSubcoleccion(tipoEvento) {
  const nombreSub = SUBCOLECCIONES[tipoEvento];
  if (!nombreSub) {
    throw new Error('Tipo de evento no válido');
  }
  const db = obtenerFirestore();
  return db
    .collection(COLECCION_EVENTOS)
    .doc(DOCUMENTO_RAIZ)
    .collection(nombreSub);
}

function serializarDocumento(id, datos) {
  const createdAt = datos.createdAt?.toDate?.()
    ? datos.createdAt.toDate().toISOString()
    : datos.createdAt ?? null;
  const emailEnviadoEn = datos.emailEnviadoEn?.toDate?.()
    ? datos.emailEnviadoEn.toDate().toISOString()
    : datos.emailEnviadoEn ?? null;

  return {
    id,
    ...datos,
    createdAt,
    emailEnviadoEn,
  };
}

async function crearInscripcion(tipoEvento, datos) {
  const ref = referenciaSubcoleccion(tipoEvento).doc();
  const carga = {
    ...datos,
    emailEnviadoEn: null,
    emailError: null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await ref.set(carga);
  return { id: ref.id, tipoEvento, ...carga };
}

async function obtenerInscripcion(tipoEvento, id) {
  const snap = await referenciaSubcoleccion(tipoEvento).doc(id).get();
  if (!snap.exists) return null;
  return serializarDocumento(snap.id, snap.data());
}

async function marcarCorreoEnviado(tipoEvento, id) {
  await referenciaSubcoleccion(tipoEvento).doc(id).update({
    emailEnviadoEn: FieldValue.serverTimestamp(),
    emailError: null,
  });
}

async function registrarErrorCorreo(tipoEvento, id, mensaje) {
  await referenciaSubcoleccion(tipoEvento).doc(id).update({
    emailError: String(mensaje || 'Error desconocido').slice(0, 500),
  });
}

async function buscarInscripcionRecientePorCorreo(tipoEvento, correo, ventanaMinutos = 5) {
  const limite = new Date(Date.now() - ventanaMinutos * 60 * 1000);
  const snap = await referenciaSubcoleccion(tipoEvento)
    .where('correoElectronico', '==', correo)
    .limit(8)
    .get();

  for (const doc of snap.docs) {
    const datos = doc.data();
    const creado = datos.createdAt?.toDate?.();
    if (creado && creado >= limite) {
      return serializarDocumento(doc.id, datos);
    }
  }
  return null;
}

function construirConsultaListado(tipoEvento, busqueda, cursorDoc) {
  const termino = String(busqueda || '').trim().toLowerCase();
  let consulta;

  if (termino) {
    consulta = referenciaSubcoleccion(tipoEvento)
      .orderBy('correoElectronico')
      .startAt(termino)
      .endAt(`${termino}\uf8ff`);
  } else {
    consulta = referenciaSubcoleccion(tipoEvento).orderBy('createdAt', 'desc');
  }

  if (cursorDoc) {
    consulta = consulta.startAfter(cursorDoc);
  }

  return consulta;
}

async function listarInscripciones({
  tipoEvento,
  busqueda,
  cursor,
  limite = 20,
}) {
  const limiteSolicitado = Math.min(Math.max(Number(limite) || 20, 1), 500);
  const modoExportacion = !cursor && limiteSolicitado >= 100;

  let cursorDoc = null;
  if (cursor) {
    const docSnap = await referenciaSubcoleccion(tipoEvento).doc(cursor).get();
    if (docSnap.exists) {
      cursorDoc = docSnap;
    }
  }

  const consulta = construirConsultaListado(tipoEvento, busqueda, cursorDoc);
  const snapshot = await consulta.limit(limiteSolicitado + 1).get();
  const docs = snapshot.docs;
  const hayMas = docs.length > limiteSolicitado;
  const pagina = hayMas ? docs.slice(0, limiteSolicitado) : docs;

  const datos = pagina.map((doc) => serializarDocumento(doc.id, doc.data()));
  const cursorSiguiente = hayMas ? pagina[pagina.length - 1].id : null;

  return {
    datos,
    paginacion: {
      hayMas,
      cursorSiguiente,
      modoExportacion,
    },
  };
}

async function listarTodasParaExportacion(tipoEvento) {
  const resultado = await listarInscripciones({
    tipoEvento,
    limite: 500,
  });
  return resultado.datos;
}

module.exports = {
  SUBCOLECCIONES,
  crearInscripcion,
  obtenerInscripcion,
  marcarCorreoEnviado,
  registrarErrorCorreo,
  buscarInscripcionRecientePorCorreo,
  listarInscripciones,
  listarTodasParaExportacion,
};
