const vitrinaPublicaRepository = require('../repositories/vitrinaPublica.repository');
const { normalizarKitType } = require('../config/catalogoKits');

const KITS_IDS = ['uniautonomo', 'general', 'personalizado'];
const COMPONENTES_IDS = ['carrera', 'fiesta', 'bingo'];
const ENLACES_IDS = ['hero_kit', 'inscripcion_5k', 'hackaton', 'feria_emprendimiento'];
const ENLACES_PERSISTIDOS = ['hackaton', 'feria_emprendimiento'];

const MAPA_EVENTO_A_ENLACE = {
  Hackton: 'hackaton',
  FeriaEmprendimiento: 'feria_emprendimiento',
};

const CONFIG_PREDETERMINADA = {
  kits: {
    uniautonomo: { ventaActiva: false },
    general: { ventaActiva: false },
    personalizado: { ventaActiva: true },
  },
  componentes: {
    carrera: { activo: false },
    fiesta: { activo: true },
    bingo: { activo: true },
  },
  enlaces: {
    hackaton: { activo: true },
    feria_emprendimiento: { activo: true },
  },
};

function algunaVentaKitAbierta(kits) {
  return KITS_IDS.some((id) => Boolean(kits[id]?.ventaActiva));
}

function derivarEnlaces({ kits, componentes, enlacesPersistidos }) {
  const persistidos = enlacesPersistidos || {};
  return {
    hero_kit: { activo: algunaVentaKitAbierta(kits) },
    inscripcion_5k: {
      activo: Boolean(componentes.carrera?.activo) && algunaVentaKitAbierta(kits),
    },
    hackaton: {
      activo:
        persistidos.hackaton?.activo !== undefined
          ? Boolean(persistidos.hackaton.activo)
          : CONFIG_PREDETERMINADA.enlaces.hackaton.activo,
    },
    feria_emprendimiento: {
      activo:
        persistidos.feria_emprendimiento?.activo !== undefined
          ? Boolean(persistidos.feria_emprendimiento.activo)
          : CONFIG_PREDETERMINADA.enlaces.feria_emprendimiento.activo,
    },
  };
}

function fusionarConPredeterminado(datosDoc) {
  const kitsRaw = datosDoc?.kits && typeof datosDoc.kits === 'object' ? datosDoc.kits : {};
  const componentesRaw =
    datosDoc?.componentes && typeof datosDoc.componentes === 'object' ? datosDoc.componentes : {};
  const enlacesRaw = datosDoc?.enlaces && typeof datosDoc.enlaces === 'object' ? datosDoc.enlaces : {};

  const kits = {};
  for (const id of KITS_IDS) {
    const raw = kitsRaw[id] || {};
    kits[id] = {
      visible: true,
      ventaActiva:
        raw.ventaActiva !== undefined
          ? Boolean(raw.ventaActiva)
          : CONFIG_PREDETERMINADA.kits[id].ventaActiva,
    };
  }

  const componentes = {};
  for (const id of COMPONENTES_IDS) {
    const raw = componentesRaw[id] || {};
    componentes[id] = {
      activo:
        raw.activo !== undefined ? Boolean(raw.activo) : CONFIG_PREDETERMINADA.componentes[id].activo,
    };
  }

  const enlacesPersistidos = {};
  for (const id of ENLACES_PERSISTIDOS) {
    const raw = enlacesRaw[id] || {};
    enlacesPersistidos[id] = {
      activo:
        raw.activo !== undefined ? Boolean(raw.activo) : CONFIG_PREDETERMINADA.enlaces[id].activo,
    };
  }

  const enlaces = derivarEnlaces({ kits, componentes, enlacesPersistidos });

  return { kits, componentes, enlaces, enlacesPersistidos };
}

async function obtenerConfig() {
  const doc = await vitrinaPublicaRepository.obtenerDocumento();
  return fusionarConPredeterminado(doc);
}

function listarParaPublico(config) {
  const cfg = config || fusionarConPredeterminado(null);
  return {
    kits: KITS_IDS.map((id) => ({
      id,
      visible: true,
      ventaActiva: cfg.kits[id].ventaActiva,
    })),
    componentes: COMPONENTES_IDS.map((id) => ({
      id,
      activo: cfg.componentes[id].activo,
    })),
    enlaces: ENLACES_IDS.map((id) => ({
      id,
      activo: cfg.enlaces[id].activo,
    })),
  };
}

function listarParaAdmin(config) {
  const cfg = config || fusionarConPredeterminado(null);
  return {
    kits: KITS_IDS.map((id) => ({
      id,
      ventaActiva: cfg.kits[id].ventaActiva,
    })),
    componentes: COMPONENTES_IDS.map((id) => ({
      id,
      activo: cfg.componentes[id].activo,
    })),
    enlaces: ENLACES_PERSISTIDOS.map((id) => ({
      id,
      activo: cfg.enlacesPersistidos[id].activo,
    })),
  };
}

async function validarKitVendible(kitType) {
  const tipo = normalizarKitType(kitType);
  if (!KITS_IDS.includes(tipo)) {
    return 'Tipo de kit inválido.';
  }

  const { kits } = await obtenerConfig();
  const kit = kits[tipo];
  if (!kit.ventaActiva) {
    return 'Ya no se permiten más inscripciones para este kit.';
  }

  return null;
}

async function validarComponentesVitrina(kitComponents) {
  if (!Array.isArray(kitComponents) || !kitComponents.length) {
    return null;
  }

  const { componentes } = await obtenerConfig();
  for (const componente of kitComponents) {
    const id = String(componente || '').trim();
    if (!COMPONENTES_IDS.includes(id)) continue;
    if (!componentes[id]?.activo) {
      const etiqueta =
        id === 'carrera' ? 'Carrera 5K' : id === 'fiesta' ? 'Fiesta Blanca' : 'Tabla Bingo';
      return `${etiqueta} no está disponible en este momento (agotado).`;
    }
  }

  return null;
}

async function enlaceActivo(clave) {
  const { enlaces } = await obtenerConfig();
  const entrada = enlaces[clave];
  return Boolean(entrada?.activo);
}

async function eventoInscripcionAbierta(tipoEvento) {
  const clave = MAPA_EVENTO_A_ENLACE[tipoEvento];
  if (!clave) return true;
  return enlaceActivo(clave);
}

function validarPayloadAdmin(payload) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Cuerpo inválido' };
  }

  const kits = {};
  for (const id of KITS_IDS) {
    const raw = payload.kits?.[id];
    if (!raw || typeof raw !== 'object') {
      return { error: `Falta configuración del kit ${id}` };
    }
    if (typeof raw.ventaActiva !== 'boolean') {
      return { error: `Kit ${id}: ventaActiva debe ser true o false` };
    }
    kits[id] = { visible: true, ventaActiva: raw.ventaActiva };
  }

  const componentes = {};
  for (const id of COMPONENTES_IDS) {
    const raw = payload.componentes?.[id];
    if (!raw || typeof raw !== 'object') {
      return { error: `Falta configuración del componente ${id}` };
    }
    if (typeof raw.activo !== 'boolean') {
      return { error: `Componente ${id}: activo debe ser true o false` };
    }
    componentes[id] = { activo: raw.activo };
  }

  const enlaces = {};
  for (const id of ENLACES_PERSISTIDOS) {
    const raw = payload.enlaces?.[id];
    if (!raw || typeof raw !== 'object') {
      return { error: `Falta configuración del enlace ${id}` };
    }
    if (typeof raw.activo !== 'boolean') {
      return { error: `Enlace ${id}: activo debe ser true o false` };
    }
    enlaces[id] = { activo: raw.activo };
  }

  return { kits, componentes, enlaces };
}

async function actualizarDesdeAdmin(payload, actualizadoPorEmail) {
  const validado = validarPayloadAdmin(payload);
  if (validado.error) {
    const err = new Error(validado.error);
    err.codigo = 400;
    throw err;
  }

  await vitrinaPublicaRepository.guardarVitrina(
    {
      kits: validado.kits,
      componentes: validado.componentes,
      enlaces: validado.enlaces,
    },
    actualizadoPorEmail
  );

  return obtenerConfig();
}

module.exports = {
  KITS_IDS,
  COMPONENTES_IDS,
  ENLACES_IDS,
  ENLACES_PERSISTIDOS,
  CONFIG_PREDETERMINADA,
  derivarEnlaces,
  obtenerConfig,
  listarParaPublico,
  listarParaAdmin,
  validarKitVendible,
  validarComponentesVitrina,
  enlaceActivo,
  eventoInscripcionAbierta,
  actualizarDesdeAdmin,
  fusionarConPredeterminado,
};
