const COLECCION_SECUENCIA = 'sequences';
const DOCUMENTO_CONTADOR = 'numeroCorredor';
const COLECCION_NUMEROS = 'numerosCorredor';
const MAX_NUMERO = 999;
const MAX_SALTOS_OCUPADOS = 20;

function debeAsignarNumeroCorredor(kitType, kitComponents = []) {
  const tipo = String(kitType || '').trim();

  if (tipo === 'uniautonomo') {
    return true;
  }

  if (tipo === 'personalizado') {
    return Array.isArray(kitComponents) && kitComponents.includes('carrera');
  }

  return false;
}

function formatearNumeroCorredor(valor) {
  return String(valor).padStart(3, '0');
}

function errorNumerosAgotados() {
  const err = new Error(
    'Se agotaron los números de corredor disponibles (máximo 999). Contacta al organizador del evento.'
  );
  err.codigo = 503;
  return err;
}

/**
 * Reserva el siguiente número dentro de una transacción ya abierta.
 * Firestore exige que todas las lecturas ocurran antes de cualquier escritura,
 * por eso devuelve una función `escribir` que el llamador invoca después de sus propias lecturas.
 */
async function reservarNumeroEnTransaccion(db, transaccion, { paymentId, reference, email }) {
  const refContador = db.collection(COLECCION_SECUENCIA).doc(DOCUMENTO_CONTADOR);
  const snapshot = await transaccion.get(refContador);
  let candidato = (snapshot.exists ? Number(snapshot.data().ultimo) || 0 : 0) + 1;

  for (let intento = 0; intento < MAX_SALTOS_OCUPADOS; intento += 1) {
    if (candidato > MAX_NUMERO) throw errorNumerosAgotados();

    const numero = formatearNumeroCorredor(candidato);
    const refNumero = db.collection(COLECCION_NUMEROS).doc(numero);
    const ocupado = await transaccion.get(refNumero);

    if (!ocupado.exists) {
      const ultimo = candidato;
      return {
        numero,
        escribir() {
          transaccion.set(
            refContador,
            { ultimo, actualizadoEn: new Date() },
            { merge: true }
          );
          transaccion.create(refNumero, {
            numero,
            paymentId,
            reference: reference || null,
            email: email || null,
            asignadoEn: new Date(),
          });
        },
      };
    }

    candidato += 1;
  }

  throw new Error('No se encontró un número de corredor libre. Intenta de nuevo.');
}

module.exports = {
  COLECCION_NUMEROS,
  COLECCION_SECUENCIA,
  DOCUMENTO_CONTADOR,
  MAX_NUMERO,
  debeAsignarNumeroCorredor,
  formatearNumeroCorredor,
  reservarNumeroEnTransaccion,
};
