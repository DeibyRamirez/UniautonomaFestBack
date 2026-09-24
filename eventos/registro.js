(function () {
  var formulario = document.getElementById('formulario-evento');
  var etiqueta = document.getElementById('registro-etiqueta');
  var titulo = document.getElementById('registro-titulo');
  var descripcion = document.getElementById('registro-descripcion');
  var pasoDatos = document.getElementById('paso-datos');
  var pasoConfirmacion = document.getElementById('paso-confirmacion');
  var enlaceVolverDatos = document.getElementById('enlace-volver-datos');
  var mensajeError = document.getElementById('mensaje-error');
  var textoConfirmacion = document.getElementById('texto-confirmacion');
  var textoConfirmacionExtra = document.getElementById('texto-confirmacion-extra');

  /** Enlaces desde la landing: id del botón → tipo de evento en Firestore */
  var MAPA_BOTONES = {
    'inscribir-hackton': 'Hackton',
    'inscribir-feria': 'FeriaEmprendimiento',
  };

  var METADATOS = {
    Hackton: {
      etiqueta: 'Registro · Hackatón',
      titulo: 'Inscripción al Hackatón',
      descripcion: 'Desafío Uniautónomo · 20 de octubre · Sede Campestre El Aljibe',
      textoBoton: 'Enviar inscripción',
      volverHash: '#programacion',
    },
    FeriaEmprendimiento: {
      etiqueta: 'Registro · Feria de emprendimiento',
      titulo: 'Registro para stand',
      descripcion: '22 de octubre · Sede principal',
      textoBoton: 'Enviar registro',
      volverHash: '#programacion',
    },
  };

  var CAMPOS = {
    Hackton: [
      { nombre: 'nombres', etiqueta: 'Nombres *', tipo: 'text', requerido: true, autocomplete: 'given-name' },
      { nombre: 'apellidos', etiqueta: 'Apellidos *', tipo: 'text', requerido: true, autocomplete: 'family-name' },
      {
        nombre: 'correoElectronico',
        etiqueta: 'Correo electrónico *',
        tipo: 'email',
        requerido: true,
        anchoCompleto: true,
        autocomplete: 'email',
      },
      {
        nombre: 'programa',
        etiqueta: 'Programa *',
        tipo: 'text',
        requerido: true,
        anchoCompleto: true,
        placeholder: 'Ej. Ingeniería de sistemas',
      },
      {
        nombre: 'codigoEstudiantil',
        etiqueta: 'Código estudiantil',
        tipo: 'text',
        anchoCompleto: true,
        inputmode: 'numeric',
      },
    ],
    FeriaEmprendimiento: [
      { nombre: 'nombre', etiqueta: 'Nombre *', tipo: 'text', requerido: true, autocomplete: 'given-name' },
      { nombre: 'apellido', etiqueta: 'Apellido *', tipo: 'text', requerido: true, autocomplete: 'family-name' },
      {
        nombre: 'tipoDocumento',
        etiqueta: 'Documento *',
        tipo: 'select',
        requerido: true,
        opciones: [
          { valor: '', texto: 'Seleccionar' },
          { valor: 'CC', texto: 'Cédula de ciudadanía' },
          { valor: 'CE', texto: 'Cédula de extranjería' },
          { valor: 'TI', texto: 'Tarjeta de identidad' },
          { valor: 'PAS', texto: 'Pasaporte' },
          { valor: 'NIT', texto: 'NIT' },
        ],
      },
      {
        nombre: 'numeroDocumento',
        etiqueta: 'Número de documento *',
        tipo: 'text',
        requerido: true,
        inputmode: 'numeric',
      },
      { nombre: 'telefono', etiqueta: 'Teléfono *', tipo: 'tel', requerido: true, autocomplete: 'tel' },
      {
        nombre: 'correoElectronico',
        etiqueta: 'Correo electrónico *',
        tipo: 'email',
        requerido: true,
        autocomplete: 'email',
      },
      {
        nombre: 'emprendimientoMarca',
        etiqueta: 'Emprendimiento o marca',
        tipo: 'text',
        anchoCompleto: true,
        placeholder: 'Mi marca: creamos y adpatamos servicos en... ',
      },
    ],
  };

  var tipoEvento = null;
  var enviando = false;

  function resolverTipoEvento() {
    var params = new URLSearchParams(window.location.search);

    var idBoton = params.get('desde');
    if (idBoton && MAPA_BOTONES[idBoton]) {
      return MAPA_BOTONES[idBoton];
    }

    var desdeUrl = params.get('evento');
    if (desdeUrl && METADATOS[desdeUrl]) {
      return desdeUrl;
    }

    if (document.referrer) {
      try {
        var ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          var hash = ref.hash.replace('#', '');
          if (MAPA_BOTONES[hash]) return MAPA_BOTONES[hash];
        }
      } catch (_e) {
        /* referrer no usable */
      }
    }

    return null;
  }

  function mostrarError(texto) {
    mensajeError.textContent = texto || '';
    mensajeError.hidden = !texto;
  }

  function crearCampo(definicion) {
    var contenedor = document.createElement('div');
    if (definicion.anchoCompleto) {
      contenedor.className = 'ancho-completo';
    }

    var idCampo = 'campo-' + definicion.nombre;
    var etiquetaCampo = document.createElement('label');
    etiquetaCampo.setAttribute('for', idCampo);
    etiquetaCampo.textContent = definicion.etiqueta;

    var control;
    if (definicion.tipo === 'select') {
      control = document.createElement('select');
      definicion.opciones.forEach(function (op) {
        var opt = document.createElement('option');
        opt.value = op.valor;
        opt.textContent = op.texto;
        control.appendChild(opt);
      });
    } else {
      control = document.createElement('input');
      control.type = definicion.tipo || 'text';
      if (definicion.placeholder) control.placeholder = definicion.placeholder;
      if (definicion.inputmode) control.inputMode = definicion.inputmode;
      if (definicion.autocomplete) control.autocomplete = definicion.autocomplete;
    }

    control.id = idCampo;
    control.name = definicion.nombre;
    if (definicion.requerido) {
      control.required = true;
    }

    contenedor.appendChild(etiquetaCampo);
    contenedor.appendChild(control);
    return contenedor;
  }

  function montarFormulario(tipo) {
    formulario.innerHTML = '';
    var lista = CAMPOS[tipo] || [];
    lista.forEach(function (def) {
      formulario.appendChild(crearCampo(def));
    });

    var envoltorioBoton = document.createElement('div');
    envoltorioBoton.className = 'ancho-completo';
    var boton = document.createElement('button');
    boton.type = 'submit';
    boton.className = 'btn';
    boton.id = 'boton-enviar-registro';
    boton.style.width = '100%';
    boton.innerHTML = '<span class="tick"></span>' + METADATOS[tipo].textoBoton;
    envoltorioBoton.appendChild(boton);
    formulario.appendChild(envoltorioBoton);
  }

  function aplicarMetadatos(tipo) {
    var meta = METADATOS[tipo];
    document.title = meta.titulo + ' — Uniautónoma Fest 2026';
    etiqueta.textContent = meta.etiqueta;
    titulo.textContent = meta.titulo;
    descripcion.textContent = meta.descripcion;
    enlaceVolverDatos.href = '/' + meta.volverHash;
  }

  function mostrarPaso(nombre) {
    var esConfirmacion = nombre === 'confirmacion';
    pasoDatos.hidden = esConfirmacion;
    pasoConfirmacion.hidden = !esConfirmacion;
    enlaceVolverDatos.hidden = esConfirmacion;
  }

  function recogerDatos() {
    var datos = {};
    formulario.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.name || el.type === 'submit') return;
      datos[el.name] = String(el.value || '').trim();
    });
    return datos;
  }

  function iniciar() {
    tipoEvento = resolverTipoEvento();
    if (!tipoEvento) {
      window.location.replace('/');
      return;
    }

    aplicarMetadatos(tipoEvento);
    montarFormulario(tipoEvento);
    mostrarPaso('datos');
    mostrarError('');

    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      if (enviando) return;

      var boton = document.getElementById('boton-enviar-registro');
      enviando = true;
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      mostrarError('');

      fetch('/api/eventos/inscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoEvento: tipoEvento,
          datos: recogerDatos(),
        }),
      })
        .then(function (respuesta) {
          return respuesta.json().then(function (cuerpo) {
            return { ok: respuesta.ok, cuerpo: cuerpo };
          });
        })
        .then(function (resultado) {
          if (!resultado.ok) {
            throw new Error(resultado.cuerpo.mensaje || 'No se pudo completar el registro');
          }

          formulario.reset();
          mostrarPaso('confirmacion');
          textoConfirmacion.textContent = '¡Te esperamos!';
          var extra =
            resultado.cuerpo.mensaje ||
            'Tu inscripción quedó registrada. Revisa tu correo para la confirmación.';
          if (resultado.cuerpo.correoEnviado === false) {
            extra += ' Si no llega el mensaje, revisa spam o contáctanos por redes del fest.';
          }
          textoConfirmacionExtra.textContent = extra;
        })
        .catch(function (error) {
          mostrarError(error.message);
        })
        .finally(function () {
          enviando = false;
          if (boton) {
            boton.disabled = false;
            boton.innerHTML =
              '<span class="tick"></span>' + METADATOS[tipoEvento].textoBoton;
          }
        });
    });

    var primerCampo = formulario.querySelector('input, select');
    if (primerCampo) primerCampo.focus();
  }

  iniciar();
})();
