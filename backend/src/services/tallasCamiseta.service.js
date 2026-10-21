const { FieldValue } = require('firebase-admin/firestore');
const tallasCamisetaRepository = require('../repositories/tallasCamiseta.repository');

const TALLAS_ORDEN = ['S', 'M', 'L', 'XL'];

const CONFIG_PREDETERMINADA = {
  S: { activa: false, stock: null },
  M: { activa: false, stock: null },
  L: { activa: false, stock: null },
  XL: { activa: false, stock: null },
};

function normalizarStock(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    return null;
  }
  return numero;
}

function normalizarEntradaTalla(entrada) {
  const activa = Boolean(entrada?.activa);
  const stock = normalizarStock(entrada?.stock);
  return { activa, stock };
}

function fusionarConPredeterminado(datosDoc) {
  const tallasRaw = datosDoc?.tallas && typeof datosDoc.tallas === 'object' ? datosDoc.tallas : {};
  const tallas = {};
  for (const codigo of TALLAS_ORDEN) {
    tallas[codigo] = normalizarEntradaTalla({
      activa: tallasRaw[codigo]?.activa ?? CONFIG_PREDETERMINADA[codigo].activa,
      stock: tallasRaw[codigo]?.stock ?? CONFIG_PREDETERMINADA[codigo].stock,
    });
  }
  return { tallas };
}

function esTallaComprable(entrada) {
  if (!entrada?.activa) return false;
  if (entrada.stock === null) return true;
  return entrada.stock > 0;
}

function etiquetaPublicaTalla(codigo, entrada) {
  const activa = Boolean(entrada?.activa);
  const stock = entrada?.stock ?? null;
  if (!esTallaComprable(entrada)) {
    return { codigo, activa, comprable: false, stock };
  }
  return {
    codigo,
    activa,
    comprable: true,
    stock,
  };
}

async function obtenerConfig() {
  const doc = await tallasCamisetaRepository.obtenerDocumento();
  return fusionarConPredeterminado(doc);
}

async function listarParaPublico() {
  const { tallas } = await obtenerConfig();
  return TALLAS_ORDEN.map((codigo) => etiquetaPublicaTalla(codigo, tallas[codigo]));
}

function mensajeTallaNoDisponible(codigo) {
  return `La talla ${codigo} no está disponible en este momento. Elige otra talla o contacta al organizador.`;
}

async function validarTallaDisponible(talla) {
  const codigo = String(talla || '').trim().toUpperCase();
  if (!TALLAS_ORDEN.includes(codigo)) {
    return 'Selecciona una talla de camiseta válida (S, M, L o XL)';
  }

  const { tallas } = await obtenerConfig();
  const entrada = tallas[codigo];
  if (!esTallaComprable(entrada)) {
    return mensajeTallaNoDisponible(codigo);
  }

  return null;
}

function errorStockAgotado(codigo) {
  const err = new Error(mensajeTallaNoDisponible(codigo));
  err.codigo = 503;
  return err;
}

/**
 * Lee y descuenta stock dentro de una transacción Firestore.
 * Debe invocarse después de las demás lecturas del llamador y antes de escrituras.
 */
async function descontarStockEnTransaccion(db, transaccion, talla) {
  const codigo = String(talla || '').trim().toUpperCase();
  if (!TALLAS_ORDEN.includes(codigo)) {
    throw errorStockAgotado(codigo);
  }

  const ref = db.collection(tallasCamisetaRepository.COLECCION).doc(tallasCamisetaRepository.DOCUMENTO);
  const snapshot = await transaccion.get(ref);
  const { tallas } = fusionarConPredeterminado(snapshot.exists ? snapshot.data() : null);
  const entrada = tallas[codigo];

  if (!esTallaComprable(entrada)) {
    throw errorStockAgotado(codigo);
  }

  if (entrada.stock === null) {
    return { descontado: false, codigo };
  }

  const nuevoStock = entrada.stock - 1;
  tallas[codigo] = { activa: entrada.activa, stock: nuevoStock };

  return {
    descontado: true,
    codigo,
    stockRestante: nuevoStock,
    escribir() {
      transaccion.set(
        ref,
        {
          tallas,
          actualizadoEn: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
  };
}

function validarPayloadAdmin(tallasEntrada) {
  if (!tallasEntrada || typeof tallasEntrada !== 'object') {
    return { error: 'Cuerpo inválido: se espera { tallas: { ... } }' };
  }

  const tallas = {};
  for (const codigo of TALLAS_ORDEN) {
    const raw = tallasEntrada[codigo];
    if (!raw || typeof raw !== 'object') {
      return { error: `Falta la configuración de la talla ${codigo}` };
    }
    if (typeof raw.activa !== 'boolean') {
      return { error: `El campo activa de ${codigo} debe ser true o false` };
    }
    if (raw.stock !== null && raw.stock !== undefined && raw.stock !== '') {
      const numero = Number(raw.stock);
      if (!Number.isInteger(numero) || numero < 0) {
        return { error: `El stock de ${codigo} debe ser un entero ≥ 0 o vacío (sin conteo)` };
      }
      tallas[codigo] = { activa: raw.activa, stock: numero };
    } else {
      tallas[codigo] = { activa: raw.activa, stock: null };
    }
  }

  return { tallas };
}

async function actualizarDesdeAdmin(tallasEntrada, actualizadoPorEmail) {
  const validado = validarPayloadAdmin(tallasEntrada);
  if (validado.error) {
    const err = new Error(validado.error);
    err.codigo = 400;
    throw err;
  }

  await tallasCamisetaRepository.guardarTallas(validado.tallas, actualizadoPorEmail);
  return obtenerConfig();
}

function listarParaAdmin(config) {
  const tallas = config?.tallas || fusionarConPredeterminado(null).tallas;
  return TALLAS_ORDEN.map((codigo) => ({
    codigo,
    activa: tallas[codigo].activa,
    stock: tallas[codigo].stock,
    comprable: esTallaComprable(tallas[codigo]),
  }));
}

module.exports = {
  TALLAS_ORDEN,
  CONFIG_PREDETERMINADA,
  obtenerConfig,
  listarParaPublico,
  listarParaAdmin,
  validarTallaDisponible,
  descontarStockEnTransaccion,
  actualizarDesdeAdmin,
  esTallaComprable,
  fusionarConPredeterminado,
};
