(function () {
  const METADATOS = {
    uniautonomo: {
      titulo: 'Kit Sangre Azul',
      descripcion: 'Estudiantes, docentes, administrativos y egresados. Usa tu correo institucional.',
      precioCentavos: 7500000,
      requiereCodigoEstudiante: true,
      esPersonalizable: false,
    },
    general: {
      titulo: 'Kit Corredor',
      descripcion: 'Para participantes externos a la institución.',
      precioCentavos: 8000000,
      requiereCodigoEstudiante: false,
      esPersonalizable: false,
    },
    personalizado: {
      titulo: 'Arma tu kit uniautónomo',
      descripcion: 'Elige los componentes que deseas. Usa tu correo institucional.',
      precioCentavos: null,
      requiereCodigoEstudiante: true,
      esPersonalizable: true,
    },
  };

  let componentes = {
    carrera: { id: 'carrera', titulo: 'Carrera 5K', precioCentavos: 6000000 },
    fiesta: { id: 'fiesta', titulo: 'Fiesta Blanca', precioCentavos: 2000000 },
    bingo: { id: 'bingo', titulo: 'Tabla Bingo (2)', precioCentavos: 1000000 },
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
      if (tipo === 'personalizado') {
        var minimo = montos.componentes?.carrera || componentes.carrera.precioCentavos;
        elemento.innerHTML = 'Desde ' + htmlPrecio(minimo);
        return;
      }
      var centavos = montos[tipo];
      if (!centavos) return;
      elemento.innerHTML = htmlPrecio(centavos);
    });
  }

  function aplicarCatalogo(catalogo) {
    if (!catalogo || !Array.isArray(catalogo.kits)) return;

    catalogo.kits.forEach(function (kit) {
      METADATOS[kit.id] = Object.assign({}, METADATOS[kit.id] || {}, kit);
    });

    if (Array.isArray(catalogo.componentes)) {
      catalogo.componentes.forEach(function (componente) {
        componentes[componente.id] = componente;
      });
    }
  }

  function cargarMontos() {
    return fetch('/api/config/publica')
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error('config');
        return respuesta.json();
      })
      .then(function (datos) {
        if (datos.catalogo) {
          aplicarCatalogo(datos.catalogo);
        }

        if (datos.montos) {
          if (datos.montos.uniautonomo) {
            METADATOS.uniautonomo.precioCentavos = datos.montos.uniautonomo;
          }
          if (datos.montos.general) {
            METADATOS.general.precioCentavos = datos.montos.general;
          }
          if (datos.montos.componentes) {
            Object.keys(datos.montos.componentes).forEach(function (clave) {
              if (componentes[clave]) {
                componentes[clave].precioCentavos = datos.montos.componentes[clave];
              }
            });
          }
          aplicarMontosEnPagina(datos.montos);
        }

        return METADATOS;
      })
      .catch(function () {
        return METADATOS;
      });
  }

  function calcularTotalComponentes(ids) {
    var total = 0;
    ids.forEach(function (id) {
      if (componentes[id]) {
        total += componentes[id].precioCentavos;
      }
    });
    return total;
  }

  window.PreciosKit = {
    METADATOS: METADATOS,
    componentes: componentes,
    formatearPrecio: formatearPrecio,
    htmlPrecio: htmlPrecio,
    calcularTotalComponentes: calcularTotalComponentes,
    listo: cargarMontos(),
  };
})();
