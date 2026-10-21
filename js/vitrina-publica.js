(function (global) {
  var MENSAJE_KIT_CERRADO = 'Ya no se permiten más inscripciones para este kit.';
  var MENSAJE_EVENTO_CERRADO = 'Inscripciones cerradas para este evento.';
  var KITS_IDS = ['uniautonomo', 'general', 'personalizado'];
  var COMPONENTES_IDS = ['carrera', 'fiesta', 'bingo'];

  var DEFAULT = {
    kits: [
      { id: 'uniautonomo', visible: true, ventaActiva: false },
      { id: 'general', visible: true, ventaActiva: false },
      { id: 'personalizado', visible: true, ventaActiva: true },
    ],
    componentes: [
      { id: 'carrera', activo: false },
      { id: 'fiesta', activo: true },
      { id: 'bingo', activo: true },
    ],
    enlaces: [
      { id: 'hero_kit', activo: true },
      { id: 'inscripcion_5k', activo: false },
      { id: 'hackaton', activo: true },
      { id: 'feria_emprendimiento', activo: true },
    ],
  };

  function defaultKit(id) {
    return DEFAULT.kits.find(function (k) {
      return k.id === id;
    });
  }

  function defaultComponente(id) {
    return DEFAULT.componentes.find(function (c) {
      return c.id === id;
    });
  }

  function fusionarKits(entrada) {
    var mapa = {};
    (entrada || []).forEach(function (k) {
      if (k && k.id) mapa[k.id] = k;
    });
    return KITS_IDS.map(function (id) {
      var base = defaultKit(id);
      var raw = mapa[id] || {};
      return {
        id: id,
        visible: true,
        ventaActiva:
          raw.ventaActiva !== undefined ? Boolean(raw.ventaActiva) : Boolean(base.ventaActiva),
      };
    });
  }

  function fusionarComponentes(entrada) {
    var mapa = {};
    (entrada || []).forEach(function (c) {
      if (c && c.id) mapa[c.id] = c;
    });
    return COMPONENTES_IDS.map(function (id) {
      var base = defaultComponente(id);
      var raw = mapa[id] || {};
      return {
        id: id,
        activo: raw.activo !== undefined ? Boolean(raw.activo) : Boolean(base.activo),
      };
    });
  }

  function algunaVentaAbierta(kitsLista) {
    return (kitsLista || []).some(function (k) {
      return Boolean(k.ventaActiva);
    });
  }

  function derivarEnlacesCliente(kitsLista, componentesLista, enlacesLista) {
    var carreraActiva = (componentesLista || []).some(function (c) {
      return c.id === 'carrera' && c.activo;
    });
    var ventaAbierta = algunaVentaAbierta(kitsLista);
    var hackaton = true;
    var feria = true;
    (enlacesLista || []).forEach(function (e) {
      if (e.id === 'hackaton') hackaton = Boolean(e.activo);
      if (e.id === 'feria_emprendimiento') feria = Boolean(e.activo);
    });
    return [
      { id: 'hero_kit', activo: ventaAbierta },
      { id: 'inscripcion_5k', activo: carreraActiva && ventaAbierta },
      { id: 'hackaton', activo: hackaton },
      { id: 'feria_emprendimiento', activo: feria },
    ];
  }

  function fusionarEnlaces(entrada, kits, componentes) {
    var lista = Array.isArray(entrada) ? entrada.slice() : [];
    var tieneDerivados = lista.some(function (e) {
      return e.id === 'hero_kit' || e.id === 'inscripcion_5k';
    });
    if (tieneDerivados && lista.length) {
      return lista;
    }
    return derivarEnlacesCliente(kits, componentes, lista);
  }

  function normalizarVitrina(datos) {
    if (!datos || typeof datos !== 'object') {
      return {
        kits: DEFAULT.kits.slice(),
        componentes: DEFAULT.componentes.slice(),
        enlaces: DEFAULT.enlaces.slice(),
      };
    }

    var kits = fusionarKits(Array.isArray(datos.kits) ? datos.kits : []);
    var componentes = fusionarComponentes(Array.isArray(datos.componentes) ? datos.componentes : []);
    var enlaces = fusionarEnlaces(datos.enlaces, kits, componentes);

    return { kits: kits, componentes: componentes, enlaces: enlaces };
  }

  function buscarKit(vitrina, id) {
    return (vitrina.kits || []).find(function (k) {
      return k.id === id;
    });
  }

  function buscarComponente(vitrina, id) {
    return (vitrina.componentes || []).find(function (c) {
      return c.id === id;
    });
  }

  function buscarEnlace(vitrina, id) {
    return (vitrina.enlaces || []).find(function (e) {
      return e.id === id;
    });
  }

  function obtenerVitrina() {
    return normalizarVitrina(global.UAF26VitrinaPublica);
  }

  function kitVentaActiva(kitId) {
    var vitrina = obtenerVitrina();
    var kit = buscarKit(vitrina, kitId);
    return Boolean(kit && kit.ventaActiva);
  }

  function componenteActivo(componenteId) {
    var vitrina = obtenerVitrina();
    var comp = buscarComponente(vitrina, componenteId);
    return Boolean(comp && comp.activo);
  }

  function enlaceActivo(enlaceId) {
    var vitrina = obtenerVitrina();
    var enlace = buscarEnlace(vitrina, enlaceId);
    return Boolean(enlace && enlace.activo);
  }

  function elementoAvisoKit() {
    return document.getElementById('kit-aviso');
  }

  function mostrarAvisoEnKit(texto) {
    var aviso = elementoAvisoKit();
    if (!aviso) return;
    aviso.textContent = texto || '';
    aviso.hidden = !texto;
    if (texto) {
      aviso.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function puedeComprarKit(kitId) {
    if (kitVentaActiva(kitId)) return true;
    mostrarAvisoEnKit(MENSAJE_KIT_CERRADO);
    return false;
  }

  function asegurarBadgeAgotado(contenedor) {
    if (!contenedor) return;
    contenedor.querySelectorAll('.vitrina-badge').forEach(function (el) {
      if (
        !el.classList.contains('vitrina-badge--esquina') &&
        !el.classList.contains('vitrina-badge--inline')
      ) {
        el.remove();
      }
    });
    var badge = contenedor.querySelector('.vitrina-badge--esquina');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'vitrina-badge vitrina-badge--esquina';
      badge.setAttribute('aria-label', 'Agotado');
      contenedor.prepend(badge);
    }
    badge.textContent = 'Sold out';
    badge.hidden = false;
  }

  function ocultarBadgeAgotado(contenedor) {
    var badge = contenedor && contenedor.querySelector('.vitrina-badge--esquina');
    if (badge) badge.hidden = true;
  }

  function enlazarClicsKitsCerrados() {
    if (document.body.dataset.vitrinaKitsBound === '1') return;
    document.body.dataset.vitrinaKitsBound = '1';
    document.addEventListener('click', function (evento) {
      var boton = evento.target.closest('[data-abrir-compra]');
      if (!boton) return;
      var tarjeta = boton.closest('[data-vitrina-kit]');
      if (!tarjeta || tarjeta.dataset.vitrinaKitCerrado !== '1') return;
      var kitId = boton.getAttribute('data-abrir-compra');
      if (!kitVentaActiva(kitId)) {
        evento.preventDefault();
        evento.stopPropagation();
        mostrarAvisoEnKit(MENSAJE_KIT_CERRADO);
      }
    });
  }

  function aplicarKitsEnPagina() {
    document.querySelectorAll('[data-vitrina-kit]').forEach(function (tarjeta) {
      var id = tarjeta.getAttribute('data-vitrina-kit');
      var activo = kitVentaActiva(id);
      var boton = tarjeta.querySelector('[data-abrir-compra]');
      if (!activo) {
        tarjeta.classList.add('kit-card--agotado');
        tarjeta.dataset.vitrinaKitCerrado = '1';
        asegurarBadgeAgotado(tarjeta);
        if (boton) {
          boton.classList.add('btn--sold-out');
          boton.setAttribute('aria-disabled', 'true');
        }
      } else {
        tarjeta.classList.remove('kit-card--agotado');
        delete tarjeta.dataset.vitrinaKitCerrado;
        ocultarBadgeAgotado(tarjeta);
        if (boton) {
          boton.classList.remove('btn--sold-out');
          boton.removeAttribute('aria-disabled');
        }
      }
    });
  }

  function aplicarTarjetaPersonalizado() {
    var tarjeta = document.querySelector('[data-vitrina-kit="personalizado"]');
    if (!tarjeta) return;
    tarjeta.querySelectorAll('[data-vitrina-componente]').forEach(function (item) {
      var compId = item.getAttribute('data-vitrina-componente');
      var activo = componenteActivo(compId);
      item.classList.toggle('kit-card-item--sold-out', !activo);
      var etiqueta = item.querySelector('.vitrina-badge--inline');
      if (!activo) {
        if (!etiqueta) {
          etiqueta = document.createElement('span');
          etiqueta.className = 'vitrina-badge vitrina-badge--inline';
          etiqueta.textContent = 'Sold out';
          item.appendChild(etiqueta);
        }
      } else if (etiqueta) {
        etiqueta.remove();
      }
    });
  }

  function aplicarEnlacesEnPagina() {
    document.querySelectorAll('[data-vitrina-enlace]').forEach(function (enlace) {
      var id = enlace.getAttribute('data-vitrina-enlace');
      var activo = enlaceActivo(id);
      if (activo) {
        enlace.classList.remove('vitrina-cerrado');
        enlace.removeAttribute('aria-disabled');
        enlace.removeAttribute('tabindex');
        return;
      }

      enlace.classList.add('vitrina-cerrado');
      enlace.setAttribute('aria-disabled', 'true');
      enlace.setAttribute('tabindex', '0');

      if (enlace.dataset.vitrinaClickBound === '1') return;
      enlace.dataset.vitrinaClickBound = '1';
      enlace.addEventListener('click', function (evento) {
        if (enlaceActivo(id)) return;
        evento.preventDefault();
        evento.stopPropagation();
        mostrarAvisoEnKit(MENSAJE_EVENTO_CERRADO);
      });
    });
  }

  function precioMinimoComponentesActivos(componentesMap) {
    var vitrina = obtenerVitrina();
    var minimo = null;
    (vitrina.componentes || []).forEach(function (comp) {
      if (!comp.activo) return;
      var datos = componentesMap[comp.id];
      if (!datos || !datos.precioCentavos) return;
      if (minimo === null || datos.precioCentavos < minimo) {
        minimo = datos.precioCentavos;
      }
    });
    return minimo;
  }

  function aplicarPrecioPersonalizado() {
    if (!global.PreciosKit) return;
    var elemento = document.querySelector('[data-precio-kit="personalizado"]');
    if (!elemento) return;
    var minimo = precioMinimoComponentesActivos(global.PreciosKit.componentes);
    if (minimo === null) {
      elemento.textContent = 'Consulta disponibilidad';
      return;
    }
    elemento.innerHTML = 'Desde ' + global.PreciosKit.htmlPrecio(minimo);
  }

  function aplicarEnPagina() {
    aplicarKitsEnPagina();
    aplicarTarjetaPersonalizado();
    aplicarEnlacesEnPagina();
    aplicarPrecioPersonalizado();
  }

  global.UAF26VitrinaPublica = normalizarVitrina(null);
  enlazarClicsKitsCerrados();
  aplicarEnPagina();

  global.UAF26Vitrina = {
    DEFAULT: DEFAULT,
    MENSAJE_KIT_CERRADO: MENSAJE_KIT_CERRADO,
    normalizarVitrina: normalizarVitrina,
    obtenerVitrina: obtenerVitrina,
    kitVentaActiva: kitVentaActiva,
    componenteActivo: componenteActivo,
    enlaceActivo: enlaceActivo,
    puedeComprarKit: puedeComprarKit,
    mostrarAvisoEnKit: mostrarAvisoEnKit,
    precioMinimoComponentesActivos: precioMinimoComponentesActivos,
    aplicarEnPagina: aplicarEnPagina,
  };
})(window);
