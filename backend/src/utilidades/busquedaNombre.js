function normalizarTextoBusqueda(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Campos derivados para buscar por nombre en Firestore, que no soporta búsqueda por subcadena:
 * `nombreBusqueda` permite prefijo sobre el nombre completo y `tokensNombre` permite
 * encontrar por cualquier nombre o apellido suelto con array-contains.
 */
function camposBusquedaNombre(personalInfo = {}) {
  const nombreBusqueda = normalizarTextoBusqueda(
    [
      personalInfo.firstName,
      personalInfo.secondName,
      personalInfo.firstSurname,
      personalInfo.secondSurname,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const tokensNombre = [...new Set(nombreBusqueda.split(' ').filter(Boolean))];

  return { nombreBusqueda, tokensNombre };
}

module.exports = { normalizarTextoBusqueda, camposBusquedaNombre };
