/**
 * Mapa Carrera 5K — MapLibre + OpenFreeMap (gratis, sin API key ni facturación por visita).
 * Ruta exacta: data/carrera-5k.gpx o data/carrera-5k.geojson
 */
(function () {
  var CONTENEDOR_ID = 'mapaCarrera5kContenedor';
  var PANEL_DIA_ID = 'd21';
  var RUTA_GPX = 'data/carrera-5k.gpx';
  var RUTA_GEOJSON = 'data/carrera-5k.geojson';
  var ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';

  var puntoSalida = {
    lat: 2.4406539,
    lng: -76.6042339,
    titulo: 'Salida · Sede principal',
    detalle: 'Corporación Universitaria Autónoma del Cauca',
    enlace:
      'https://www.google.com/maps/place/Corporaci%C3%B3n+Universitaria+Aut%C3%B3noma+del+Cauca/@2.4406539,-76.6042339,17z',
  };

  var puntoMeta = {
    lat: 2.4551328,
    lng: -76.5920287,
    titulo: 'Meta',
    detalle: 'Parque de la Salud',
    enlace: 'https://www.google.com/maps/place/Parque+de+la+Salud/@2.4551328,-76.5920287,17z',
  };

  var mapa = null;
  var mapaInicializado = false;

  function crearMarcador(claseExtra, titulo) {
    var el = document.createElement('span');
    el.className = 'marcador-5k ' + claseExtra;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', titulo);
    return el;
  }

  function htmlPopup(punto) {
    return (
      '<strong>' +
      punto.titulo +
      '</strong><br>' +
      punto.detalle +
      '<br><a href="' +
      punto.enlace +
      '" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>'
    );
  }

  function agregarMarcadorConPopup(lngLat, claseExtra, punto) {
    var popup = new maplibregl.Popup({ offset: 14, className: 'mapa-5k__popup' }).setHTML(
      htmlPopup(punto)
    );
    new maplibregl.Marker({ element: crearMarcador(claseExtra, punto.titulo) })
      .setLngLat(lngLat)
      .setPopup(popup)
      .addTo(mapa);
  }

  function coordsReferencia() {
    return [
      [puntoSalida.lng, puntoSalida.lat],
      [puntoMeta.lng, puntoMeta.lat],
    ];
  }

  function geoJsonLinea(coordenadas, esReferencia) {
    return {
      type: 'Feature',
      properties: { referencia: esReferencia },
      geometry: {
        type: 'LineString',
        coordinates: coordenadas,
      },
    };
  }

  function pintarRuta(coordenadas, esReferencia) {
    var fuente = mapa.getSource('ruta-5k');
    var datos = geoJsonLinea(coordenadas, esReferencia);
    if (fuente) {
      fuente.setData(datos);
    } else {
      mapa.addSource('ruta-5k', { type: 'geojson', data: datos });
      mapa.addLayer({
        id: 'ruta-5k-linea',
        type: 'line',
        source: 'ruta-5k',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1a6dd8',
          'line-width': esReferencia ? 3 : 4,
          'line-opacity': esReferencia ? 0.45 : 0.88,
          'line-dasharray': esReferencia ? [2, 2] : [1, 0],
        },
      });
    }
  }

  function ajustarVista(coordenadas) {
    var bounds = new maplibregl.LngLatBounds();
    coordenadas.forEach(function (c) {
      bounds.extend(c);
    });
    mapa.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
  }

  function parsearGpx(texto) {
    var doc = new DOMParser().parseFromString(texto, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    var nodos = doc.querySelectorAll('trkpt, rtept');
    if (!nodos.length) return null;

    var puntos = [];
    nodos.forEach(function (n) {
      var lat = parseFloat(n.getAttribute('lat'));
      var lng = parseFloat(n.getAttribute('lon'));
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) puntos.push([lng, lat]);
    });
    return puntos.length >= 2 ? puntos : null;
  }

  function parsearGeoJson(texto) {
    var datos;
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      return null;
    }

    var geom = datos;
    if (datos.type === 'Feature') geom = datos.geometry;
    if (datos.type === 'FeatureCollection' && datos.features && datos.features[0]) {
      geom = datos.features[0].geometry;
    }
    if (!geom || geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return null;
    if (geom.coordinates.length < 2) return null;
    return geom.coordinates;
  }

  function cargarTexto(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return null;
      return r.text();
    });
  }

  function cargarRutaExacta() {
    cargarTexto(RUTA_GPX)
      .then(function (gpx) {
        if (gpx) {
          var desdeGpx = parsearGpx(gpx);
          if (desdeGpx) return desdeGpx;
        }
        return cargarTexto(RUTA_GEOJSON).then(parsearGeoJson);
      })
      .then(function (coords) {
        if (coords && coords.length >= 2) {
          pintarRuta(coords, false);
          ajustarVista(coords);
        } else {
          var ref = coordsReferencia();
          pintarRuta(ref, true);
          ajustarVista(ref);
        }
      })
      .catch(function () {
        var ref = coordsReferencia();
        pintarRuta(ref, true);
        ajustarVista(ref);
      });
  }

  function cuandoMapaListo(callback) {
    if (mapa.loaded()) callback();
    else mapa.once('load', callback);
  }

  function inicializarMapa() {
    if (mapaInicializado || typeof maplibregl === 'undefined') return;

    var contenedor = document.getElementById(CONTENEDOR_ID);
    if (!contenedor) return;

    mapaInicializado = true;

    mapa = new maplibregl.Map({
      container: contenedor,
      style: ESTILO_MAPA,
      center: [(puntoSalida.lng + puntoMeta.lng) / 2, (puntoSalida.lat + puntoMeta.lat) / 2],
      zoom: 13,
      scrollZoom: false,
      attributionControl: true,
    });

    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    mapa.on('error', function (ev) {
      if (ev && ev.error && String(ev.error.message || '').toLowerCase().includes('api')) {
        console.warn('[mapa 5K] fallo al cargar estilo; revisa red o bloqueadores.', ev.error);
      }
    });

    cuandoMapaListo(function () {
      agregarMarcadorConPopup(
        [puntoSalida.lng, puntoSalida.lat],
        'marcador-5k--salida',
        puntoSalida
      );
      agregarMarcadorConPopup([puntoMeta.lng, puntoMeta.lat], 'marcador-5k--meta', puntoMeta);
      cargarRutaExacta();
    });

    contenedor.addEventListener('focus', function () {
      if (mapa) mapa.resize();
    });
  }

  function refrescarMapa() {
    if (!mapaInicializado) inicializarMapa();
    else if (mapa) requestAnimationFrame(function () { mapa.resize(); });
  }

  function panelVisible() {
    var panel = document.getElementById(PANEL_DIA_ID);
    return panel && panel.classList.contains('active');
  }

  function intentarInicio() {
    if (!panelVisible()) return;
    refrescarMapa();
  }

  window.refrescarMapaCarrera5k = refrescarMapa;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', intentarInicio);
  } else {
    intentarInicio();
  }

  window.addEventListener('load', intentarInicio);
})();
