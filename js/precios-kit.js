(function () {
  const METADATOS = {
    uniautonomo: {
      titulo: 'Kit Sangre Azul',
      descripcion: 'Estudiantes, docentes, administrativos y egresados (@uniautonoma.edu.co).',
      precioCentavos: 7500000,
    },
    general: {
      titulo: 'Kit Corredor',
      descripcion: 'Para participantes externos a la institución.',
      precioCentavos: 8000000,
    },
  };

  function formatearPrecio(centavos) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  }

  function htmlPrecio(centavos) {
    return formatearPrecio(centavos) + '<small>COP</small>';
  }

  function aplicarMontosEnPagina(montos) {
    document.querySelectorAll('[data-precio-kit]').forEach(function (elemento) {
      var tipo = elemento.getAttribute('data-precio-kit');
      var centavos = montos[tipo];
      if (!centavos) return;
      elemento.innerHTML = htmlPrecio(centavos);
    });
  }

  function cargarMontos() {
    return fetch('/api/config/publica')
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error('config');
        return respuesta.json();
      })
      .then(function (datos) {
        if (!datos.montos) return METADATOS;

        METADATOS.uniautonomo.precioCentavos = datos.montos.uniautonomo;
        METADATOS.general.precioCentavos = datos.montos.general;
        aplicarMontosEnPagina(datos.montos);
        return METADATOS;
      })
      .catch(function () {
        return METADATOS;
      });
  }

  window.PreciosKit = {
    METADATOS: METADATOS,
    formatearPrecio: formatearPrecio,
    htmlPrecio: htmlPrecio,
    listo: cargarMontos(),
  };
})();
