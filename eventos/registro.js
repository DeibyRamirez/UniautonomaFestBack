(function () {
  var URL_INSCRIPCION_HACKTON =
    'https://docs.google.com/forms/d/e/1FAIpQLSeAdbcxQUxFcYafIcMI2Hm0qIRkac7cDTABX54hJ-Wg63Os4w/viewform';

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

  var DOMINIO_INSTITUCIONAL = '@uniautonoma.edu.co';
  var MENSAJES_SOLO_UNIAUTONOMA = {
    Hackton: 'El Hackatón es exclusivo para la comunidad uniautónoma.',
    FeriaEmprendimiento:
      'La Feria de Emprendimiento es exclusiva para la comunidad uniautónoma.',
  };

  var METADATOS = {
    Hackton: {
      etiqueta: 'Registro · Hackatón',
      titulo: 'Inscripción al Hackatón',
      descripcion:
        'Desafío Uniautónomo · 20 de octubre · Sede Campestre El Aljibe · Exclusivo para estudiantes, docentes, administrativos y egresados uniautónomos.',
      textoBoton: 'Enviar inscripción',
      volverHash: '#programacion',
    },
    FeriaEmprendimiento: {
      etiqueta: 'Registro · Feria de emprendimiento',
      titulo: 'Registro para stand',
      descripcion:
        '22 de octubre · Sede principal · Exclusivo para estudiantes, docentes, administrativos y egresados uniautónomos.',
      textoBoton: 'Enviar registro',
      volverHash: '#programacion',
    },
  };

  var CAMPOS = {
    Hackton: [
      { nombre: 'nombres', etiqueta: 'Nombres *', tipo: 'text', requerido: true, autocomplete: 'given-name', soloTexto: true },
      { nombre: 'apellidos', etiqueta: 'Apellidos *', tipo: 'text', requerido: true, autocomplete: 'family-name', soloTexto: true },
      {
        nombre: 'correoElectronico',
        etiqueta: 'Correo institucional *',
        tipo: 'email',
        requerido: true,
        anchoCompleto: true,
        autocomplete: 'email',
        placeholder: 'Correo institucional',
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
        codigoEstudiante: true,
        placeholder: 'Ej. 18834',
      },
    ],
    FeriaEmprendimiento: [
      { nombre: 'nombre', etiqueta: 'Nombre *', tipo: 'text', requerido: true, autocomplete: 'given-name', soloTexto: true },
      { nombre: 'apellido', etiqueta: 'Apellido *', tipo: 'text', requerido: true, autocomplete: 'family-name', soloTexto: true },
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
        soloNumeros: true,
      },
      { nombre: 'telefono', etiqueta: 'Teléfono *', tipo: 'tel', requerido: true, autocomplete: 'tel' },
      {
        nombre: 'correoElectronico',
        etiqueta: 'Correo institucional *',
        tipo: 'email',
        requerido: true,
        autocomplete: 'email',
        placeholder: 'Correo institucional',
      },
      {
        nombre: 'codigoEstudiantil',
        etiqueta: 'Código estudiantil',
        tipo: 'text',
        anchoCompleto: true,
        codigoEstudiante: true,
        placeholder: 'Ej. 18834',
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
  var RETRASOS_REINTENTO_MS = [1500, 3000];
  var MENSAJE_SIN_CONEXION =
    'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.';

  function esErrorRed(error) {
    if (!error) return false;
    if (error.name === 'TypeError') return true;
    return /NetworkError|Failed to fetch|Load failed|fetch resource/i.test(error.message || '');
  }

  function esperar(ms) {
    return new Promise(function (resolver) {
      setTimeout(resolver, ms);
    });
  }

  function fetchConReintento(url, options, reintentosRestantes, onReintento) {
    return fetch(url, options).catch(function (error) {
      if (!esErrorRed(error) || reintentosRestantes <= 0) {
        if (esErrorRed(error)) {
          throw new Error(MENSAJE_SIN_CONEXION);
        }
        throw error;
      }

      if (onReintento) onReintento();
      var retraso = RETRASOS_REINTENTO_MS[RETRASOS_REINTENTO_MS.length - reintentosRestantes] || 3000;
      return esperar(retraso).then(function () {
        return fetchConReintento(url, options, reintentosRestantes - 1, onReintento);
      });
    });
  }

  function precalentarRegistro() {
    fetch('/api/eventos/warmup').catch(function () {});
  }

  function leerJson(respuesta) {
    return respuesta.json().catch(function () {
      return { mensaje: 'El servidor respondió con un error (HTTP ' + respuesta.status + ').' };
    });
  }

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

    if (definicion.soloTexto && window.RestriccionesFormulario) {
      window.RestriccionesFormulario.enlazarSoloTexto(control);
    }
    if (definicion.codigoEstudiante && window.RestriccionesFormulario) {
      window.RestriccionesFormulario.enlazarCodigoEstudiante(control);
    } else if (definicion.soloNumeros && window.RestriccionesFormulario) {
      window.RestriccionesFormulario.enlazarSoloNumeros(control);
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

  function validarCorreoInstitucional(correo, tipo) {
    var normalizado = String(correo || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      return 'Correo electrónico inválido';
    }
    if (!normalizado.endsWith(DOMINIO_INSTITUCIONAL)) {
      return MENSAJES_SOLO_UNIAUTONOMA[tipo] || 'Este evento es exclusivo para la comunidad uniautónoma.';
    }
    return null;
  }

  function validarCodigoEstudiantilOpcional(codigo) {
    if (!window.RestriccionesFormulario) return null;
    var error = window.RestriccionesFormulario.validarCodigoEstudiante(
      codigo,
      'Código estudiantil',
      false
    );
    return error || null;
  }

  function iniciar() {
    tipoEvento = resolverTipoEvento();
    if (!tipoEvento) {
      window.location.replace('/');
      return;
    }

    if (tipoEvento === 'Hackton') {
      window.location.replace(URL_INSCRIPCION_HACKTON);
      return;
    }

    aplicarMetadatos(tipoEvento);
    montarFormulario(tipoEvento);
    mostrarPaso('datos');
    mostrarError('');
    precalentarRegistro();

    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      if (enviando) return;

      var boton = document.getElementById('boton-enviar-registro');
      var datos = recogerDatos();

      if (tipoEvento === 'Hackton' || tipoEvento === 'FeriaEmprendimiento') {
        var errorCorreo = validarCorreoInstitucional(datos.correoElectronico, tipoEvento);
        if (errorCorreo) {
          mostrarError(errorCorreo);
          return;
        }
        var errorCodigo = validarCodigoEstudiantilOpcional(datos.codigoEstudiantil);
        if (errorCodigo) {
          mostrarError(errorCodigo);
          return;
        }
      }

      enviando = true;
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      mostrarError('');

      fetchConReintento(
        '/api/eventos/inscripcion',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipoEvento: tipoEvento,
            datos: datos,
          }),
        },
        2,
        function () {
          mostrarError('No pudimos conectar con el servidor. Reintentando…');
        }
      )
        .then(function (respuesta) {
          return leerJson(respuesta).then(function (cuerpo) {
            return { ok: respuesta.ok, status: respuesta.status, cuerpo: cuerpo };
          });
        })
        .then(function (resultado) {
          if (!resultado.ok && resultado.status === 409 && resultado.cuerpo.inscripcionExistente) {
            formulario.reset();
            mostrarPaso('confirmacion');
            mostrarError('');
            textoConfirmacion.textContent = '¡Te esperamos!';
            textoConfirmacionExtra.textContent =
              resultado.cuerpo.mensaje ||
              'Tu inscripción ya quedó registrada. Revisa tu correo.';
            return;
          }

          if (!resultado.ok) {
            throw new Error(resultado.cuerpo.mensaje || 'No se pudo completar el registro');
          }

          formulario.reset();
          mostrarPaso('confirmacion');
          mostrarError('');
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
          mostrarError(
            esErrorRed(error) ? MENSAJE_SIN_CONEXION : error.message
          );
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
