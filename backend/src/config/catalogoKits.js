const { variablesEntorno } = require('./variablesEntorno');

const DOMINIO_INSTITUCIONAL = '@uniautonoma.edu.co';

const COMPONENTES = {
  carrera: {
    id: 'carrera',
    titulo: 'Carrera 5K',
    descripcion: 'Cupo en la Carrera 5K con camiseta y medalla.',
    precioCentavos: () => variablesEntorno.montos.componentes.carrera,
  },
  fiesta: {
    id: 'fiesta',
    titulo: 'Fiesta Blanca',
    descripcion: 'Manilla para la Fiesta Blanca.',
    precioCentavos: () => variablesEntorno.montos.componentes.fiesta,
  },
  bingo: {
    id: 'bingo',
    titulo: 'Tabla Bingo (2)',
    descripcion: 'Dos boletas para el Bingo.',
    precioCentavos: () => variablesEntorno.montos.componentes.bingo,
  },
};

const KITS = {
  uniautonomo: {
    id: 'uniautonomo',
    titulo: 'Kit Sangre Azul',
    descripcion:
      'Estudiantes, docentes, administrativos y egresados. Usa tu correo institucional.',
    precioCentavos: () => variablesEntorno.montos.uniautonomo,
    requiereCorreoInstitucional: true,
    requiereCodigoEstudiante: true,
    esPersonalizable: false,
  },
  general: {
    id: 'general',
    titulo: 'Kit Corredor',
    descripcion: 'Para participantes externos a la institución.',
    precioCentavos: () => variablesEntorno.montos.general,
    requiereCorreoInstitucional: false,
    requiereCodigoEstudiante: false,
    esPersonalizable: false,
  },
  corredor_externo: {
    id: 'corredor_externo',
    titulo: 'Kit Corredor',
    descripcion: 'Para participantes externos a la institución.',
    precioCentavos: () => variablesEntorno.montos.general,
    requiereCorreoInstitucional: false,
    requiereCodigoEstudiante: false,
    esPersonalizable: false,
    aliasDe: 'general',
  },
  personalizado: {
    id: 'personalizado',
    titulo: 'Arma tu kit uniautónomo',
    descripcion:
      'Elige los componentes que deseas. Usa tu correo institucional.',
    precioCentavos: null,
    requiereCorreoInstitucional: true,
    requiereCodigoEstudiante: true,
    esPersonalizable: true,
  },
};

const ALIAS_KIT = {
  general: 'general',
  corredor_externo: 'general',
};

function normalizarKitType(kitType) {
  const tipo = String(kitType || '').trim();
  return ALIAS_KIT[tipo] || tipo;
}

function obtenerDefinicionKit(kitType) {
  const normalizado = normalizarKitType(kitType);
  const definicion = KITS[normalizado] || KITS[kitType];
  if (!definicion || definicion.aliasDe) {
    return KITS[normalizado] || null;
  }
  return definicion;
}

function esKitInstitucional(kitType) {
  const definicion = obtenerDefinicionKit(kitType);
  return Boolean(definicion?.requiereCorreoInstitucional);
}

function ordenarComponentes(kitComponents) {
  return [...kitComponents].sort();
}

function validarComponentes(kitComponents) {
  if (!Array.isArray(kitComponents) || kitComponents.length === 0) {
    return 'Selecciona al menos un componente para tu kit personalizado.';
  }

  const vistos = new Set();
  for (const componente of kitComponents) {
    const clave = String(componente || '').trim();
    if (!COMPONENTES[clave]) {
      return `Componente inválido: ${clave || '(vacío)'}`;
    }
    if (vistos.has(clave)) {
      return `Componente duplicado: ${clave}`;
    }
    vistos.add(clave);
  }

  return null;
}

function obtenerPrecioKit(kitType, kitComponents = []) {
  const definicion = obtenerDefinicionKit(kitType);
  if (!definicion) return null;

  if (definicion.esPersonalizable) {
    const error = validarComponentes(kitComponents);
    if (error) return null;

    let total = 0;
    for (const componente of kitComponents) {
      total += COMPONENTES[componente].precioCentavos();
    }
    return total;
  }

  return definicion.precioCentavos();
}

function listarKitsPublicos() {
  return Object.values(KITS)
    .filter((kit) => !kit.aliasDe)
    .map((kit) => ({
      id: kit.id,
      titulo: kit.titulo,
      descripcion: kit.descripcion,
      precioCentavos: kit.esPersonalizable ? null : kit.precioCentavos(),
      requiereCorreoInstitucional: kit.requiereCorreoInstitucional,
      requiereCodigoEstudiante: kit.requiereCodigoEstudiante,
      esPersonalizable: kit.esPersonalizable,
    }));
}

function listarComponentesPublicos() {
  return Object.values(COMPONENTES).map((componente) => ({
    id: componente.id,
    titulo: componente.titulo,
    descripcion: componente.descripcion,
    precioCentavos: componente.precioCentavos(),
  }));
}

function etiquetaKit(tipoKit, kitComponents) {
  const definicion = obtenerDefinicionKit(tipoKit);
  if (!definicion) return tipoKit || 'Kit';

  if (definicion.esPersonalizable && Array.isArray(kitComponents) && kitComponents.length) {
    const nombres = ordenarComponentes(kitComponents)
      .map((id) => COMPONENTES[id]?.titulo || id)
      .join(', ');
    return `Kit personalizado (${nombres})`;
  }

  return definicion.titulo;
}

module.exports = {
  DOMINIO_INSTITUCIONAL,
  COMPONENTES,
  KITS,
  normalizarKitType,
  obtenerDefinicionKit,
  esKitInstitucional,
  ordenarComponentes,
  validarComponentes,
  obtenerPrecioKit,
  listarKitsPublicos,
  listarComponentesPublicos,
  etiquetaKit,
};
