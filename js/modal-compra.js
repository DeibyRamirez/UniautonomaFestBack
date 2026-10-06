(function () {
  const URL_WIDGET_WOMPI = 'https://checkout.wompi.co/widget.js';

  const modal = document.getElementById('modal-compra');
  if (!modal) return;

  const fondo = modal.querySelector('[data-cerrar-modal]');
  const btnCerrar = modal.querySelector('.modal-compra__cerrar');
  const titulo = document.getElementById('modal-compra-titulo');
  const descripcion = document.getElementById('modal-compra-desc');
  const precioEl = document.getElementById('modal-compra-precio');
  const formulario = document.getElementById('formulario-compra-kit');
  const pasoDatos = document.getElementById('paso-datos');
  const pasoPago = document.getElementById('paso-pago');
  const pasoConfirmacion = document.getElementById('paso-confirmacion');
  const resumenPago = document.getElementById('resumen-pago-wompi');
  const botonContinuar = document.getElementById('boton-continuar-compra');
  const botonAbrirWompi = document.getElementById('boton-abrir-wompi');
  const botonCerrarExito = document.getElementById('boton-cerrar-exito');
  const errorEl = document.getElementById('modal-compra-error');
  const campoCodigo = document.getElementById('campo-codigo-estudiante-compra');
  const inputCodigo = document.getElementById('compra-studentCode');
  const campoRol = document.getElementById('campo-rol-institucional-compra');
  const selectRol = document.getElementById('compra-participantRole');
  const campoCarrera = document.getElementById('campo-carrera-estudiante-compra');
  const selectCarrera = document.getElementById('compra-academicCareer');
  const campoTalla = document.getElementById('campo-talla-camiseta-compra');
  const selectTalla = document.getElementById('compra-shirtSize');
  const selectResidenceCity = document.getElementById('compra-residenceCity');
  const codigoMostrar = document.getElementById('codigo-reclamo-mostrar');
  const numeroCorredorBloque = document.getElementById('numero-corredor-mostrar');
  const numeroCorredorEtiqueta = document.getElementById('numero-corredor-etiqueta');
  const numeroCorredorValor = document.getElementById('numero-corredor-valor');
  const CLAVE_REFERENCIA_PENDIENTE = 'uaf26-pago-referencia';
  const CLAVE_REFERENCIA_LOCAL = 'uaf26-pago-referencia-local';
  const textoConfirmacion = document.getElementById('texto-confirmacion');
  const textoConfirmacionExtra = document.getElementById('texto-confirmacion-extra');
  const indicadoresPaso = modal.querySelectorAll('[data-indicador-paso]');
  const selectorComponentes = document.getElementById('selector-componentes-kit');
  const listaComponentes = document.getElementById('lista-componentes-kit');
  const totalComponentesEl = document.getElementById('total-componentes-kit');

  let tipoKit = 'uniautonomo';
  let enviandoPago = false;
  let datosCheckout = null;
  let datosPersonales = null;
  let referenciaActual = null;
  let intervaloPolling = null;
  let ciudadesResidencia = null;
  let promesaCiudadesResidencia = null;

  function esErrorRed(error) {
    if (!error) return false;
    if (error.name === 'TypeError') return true;
    var mensaje = error.message || '';
    return /NetworkError|Failed to fetch|Load failed|fetch resource/i.test(mensaje);
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
          throw new Error('El servidor tardó en responder. Intenta de nuevo.');
        }
        throw error;
      }

      if (onReintento) onReintento();
      var retraso = reintentosRestantes === 1 ? 1500 : 3000;
      return esperar(retraso).then(function () {
        return fetchConReintento(url, options, reintentosRestantes - 1, onReintento);
      });
    });
  }

  function precalentarCheckout() {
    fetch('/api/checkout/warmup').catch(function () {});
  }

  precalentarCheckout();

  function mostrarNumeroCorredor(d) {
    if (!numeroCorredorBloque) return;
    if (!d || !d.numeroCorredor) {
      numeroCorredorBloque.hidden = true;
      numeroCorredorValor.textContent = '';
      return;
    }
    numeroCorredorEtiqueta.textContent =
      d.kitType === 'uniautonomo'
        ? 'Tu número de corredor y de participación en la rifa de la moto'
        : 'Tu número de corredor';
    numeroCorredorValor.textContent = d.numeroCorredor;
    numeroCorredorBloque.hidden = false;
  }

  function esNavegadorIncrustado() {
    var ua = navigator.userAgent || '';
    return /Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
  }

  function mostrarAvisoNavegadorIncrustado() {
    var aviso = document.getElementById('aviso-navegador-incrustado');
    if (!aviso || !esNavegadorIncrustado()) return;

    try {
      if (sessionStorage.getItem('uaf26-aviso-navegador-cerrado') === '1') return;
    } catch (e) {}

    aviso.hidden = false;
    document.body.classList.add('aviso-navegador-activo');

    var btnCerrarAviso = document.getElementById('cerrar-aviso-navegador');
    if (btnCerrarAviso) {
      btnCerrarAviso.addEventListener('click', function () {
        aviso.hidden = true;
        document.body.classList.remove('aviso-navegador-activo');
        try {
          sessionStorage.setItem('uaf26-aviso-navegador-cerrado', '1');
        } catch (e) {}
      });
    }
  }

  mostrarAvisoNavegadorIncrustado();

  function guardarReferenciaPendiente(reference) {
    try {
      sessionStorage.setItem(CLAVE_REFERENCIA_PENDIENTE, reference);
    } catch (e) {}
    try {
      localStorage.setItem(CLAVE_REFERENCIA_LOCAL, reference);
    } catch (e) {}
  }

  function leerReferenciaPendiente() {
    try {
      var sesion = sessionStorage.getItem(CLAVE_REFERENCIA_PENDIENTE);
      if (sesion) return sesion;
    } catch (e) {}
    try {
      return localStorage.getItem(CLAVE_REFERENCIA_LOCAL);
    } catch (e) {
      return null;
    }
  }

  function limpiarReferenciaPendiente() {
    try {
      sessionStorage.removeItem(CLAVE_REFERENCIA_PENDIENTE);
    } catch (e) {}
    try {
      localStorage.removeItem(CLAVE_REFERENCIA_LOCAL);
    } catch (e) {}
  }

  function correoCompraTexto() {
    if (datosPersonales && datosPersonales.email) {
      return datosPersonales.email;
    }
    if (datosCheckout && datosCheckout.personalInfo && datosCheckout.personalInfo.email) {
      return datosCheckout.personalInfo.email;
    }
    return 'el correo que registraste';
  }

  function mensajeEstadoCorreo(d) {
    var correo = correoCompraTexto();
    if (d.emailEnviado) {
      return 'También lo enviamos a ' + correo + '.';
    }
    if (d.emailError) {
      return (
        'No pudimos enviar el correo a ' +
        correo +
        ' (' +
        d.emailError +
        '). Usa el código en pantalla; también puedes acercarte a sede con tu comprobante.'
      );
    }
    return (
      'Tu código también llegará a ' +
      correo +
      ' en unos minutos. Revisa spam si no lo ves. Puedes usar el código en pantalla sin esperar el correo.'
    );
  }

  function bloquearScrollLanding() {
    document.documentElement.classList.add('compra-scroll-lock');
  }

  function desbloquearScrollLanding() {
    document.documentElement.classList.remove('compra-scroll-lock');
  }

  function obtenerMetadatosKit() {
    return window.PreciosKit ? window.PreciosKit.METADATOS : null;
  }

  function obtenerComponentes() {
    return window.PreciosKit ? window.PreciosKit.componentes : {};
  }

  function metaKit(tipo) {
    var metadatos = obtenerMetadatosKit();
    if (metadatos && metadatos[tipo]) return metadatos[tipo];
    return {
      titulo: tipo === 'general' ? 'Kit Corredor' : 'Kit Sangre Azul',
      descripcion: '',
      precioCentavos: tipo === 'general' ? 8000000 : 7500000,
      requiereCodigoEstudiante: false,
      esPersonalizable: tipo === 'personalizado',
    };
  }

  function kitIncluyeCarrera() {
    if (tipoKit === 'uniautonomo') return true;
    if (tipoKit === 'personalizado') {
      return obtenerComponentesSeleccionados().indexOf('carrera') !== -1;
    }
    return false;
  }

  function actualizarCampoTallaCamiseta() {
    if (!campoTalla || !selectTalla) return;
    var visible = kitIncluyeCarrera();
    campoTalla.hidden = !visible;
    if (visible) {
      selectTalla.setAttribute('required', 'required');
    } else {
      selectTalla.removeAttribute('required');
      selectTalla.value = '';
    }
  }

  function esKitInstitucionalModal() {
    return tipoKit === 'uniautonomo' || tipoKit === 'personalizado';
  }

  function actualizarCamposInstitucionales() {
    var esInstitucional = esKitInstitucionalModal();
    if (campoRol && selectRol) {
      campoRol.hidden = !esInstitucional;
      if (esInstitucional) {
        selectRol.setAttribute('required', 'required');
      } else {
        selectRol.removeAttribute('required');
        selectRol.value = '';
      }
    }
    if (!esInstitucional && campoCarrera && selectCarrera) {
      campoCarrera.hidden = true;
      selectCarrera.removeAttribute('required');
      selectCarrera.value = '';
    }
    actualizarCamposPorRol();
  }

  function actualizarCamposPorRol() {
    if (!campoCodigo || !inputCodigo) return;
    var esInstitucional = esKitInstitucionalModal();
    var esEstudiante = esInstitucional && selectRol && selectRol.value === 'Estudiante';

    if (campoCarrera && selectCarrera) {
      campoCarrera.hidden = !esEstudiante;
      if (esEstudiante) {
        selectCarrera.setAttribute('required', 'required');
      } else {
        selectCarrera.removeAttribute('required');
        selectCarrera.value = '';
      }
    }

    campoCodigo.hidden = !esEstudiante;
    if (esEstudiante) {
      inputCodigo.setAttribute('required', 'required');
    } else {
      inputCodigo.removeAttribute('required');
      inputCodigo.value = '';
    }
  }

  function formatearPrecio(centavos) {
    if (window.PreciosKit) return window.PreciosKit.formatearPrecio(centavos);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  }

  function mostrarError(texto) {
    errorEl.textContent = texto || '';
    errorEl.hidden = !texto;
  }

  function poblarSelectorCiudades(ciudades) {
    if (!selectResidenceCity) return;

    var fragmento = document.createDocumentFragment();
    var opcionVacia = document.createElement('option');
    opcionVacia.value = '';
    opcionVacia.textContent = 'Seleccionar';
    fragmento.appendChild(opcionVacia);

    ciudades.forEach(function (ciudad) {
      var opcion = document.createElement('option');
      opcion.value = ciudad.etiqueta;
      opcion.textContent = ciudad.etiqueta;
      fragmento.appendChild(opcion);
    });

    selectResidenceCity.replaceChildren(fragmento);
    selectResidenceCity.disabled = false;
  }

  function cargarCiudadesResidencia() {
    if (ciudadesResidencia) {
      return Promise.resolve(ciudadesResidencia);
    }
    if (promesaCiudadesResidencia) return promesaCiudadesResidencia;

    promesaCiudadesResidencia = fetch('/api/config/ciudades')
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error('No se pudieron cargar las ciudades.');
        return respuesta.json();
      })
      .then(function (datos) {
        ciudadesResidencia = Array.isArray(datos.ciudades) ? datos.ciudades : [];
        if (!ciudadesResidencia.length) {
          throw new Error('No hay ciudades disponibles.');
        }
        poblarSelectorCiudades(ciudadesResidencia);
        return ciudadesResidencia;
      })
      .catch(function (error) {
        promesaCiudadesResidencia = null;
        if (selectResidenceCity) {
          selectResidenceCity.replaceChildren();
          var opcionError = document.createElement('option');
          opcionError.value = '';
          opcionError.textContent = 'No se pudieron cargar las ciudades';
          selectResidenceCity.appendChild(opcionError);
          selectResidenceCity.disabled = true;
        }
        throw error;
      });

    return promesaCiudadesResidencia;
  }

  function marcarPaso(numero) {
    indicadoresPaso.forEach(function (el) {
      el.classList.toggle('activo', el.getAttribute('data-indicador-paso') === String(numero));
    });
  }

  function mostrarPaso(nombre) {
    pasoDatos.hidden = nombre !== 'datos';
    pasoPago.hidden = nombre !== 'pago';
    pasoConfirmacion.hidden = nombre !== 'confirmacion';
    if (nombre === 'datos') marcarPaso(1);
    if (nombre === 'pago') marcarPaso(2);
    if (nombre === 'confirmacion') marcarPaso(3);
  }

  function obtenerComponentesSeleccionados() {
    if (!listaComponentes) return [];
    return Array.from(listaComponentes.querySelectorAll('input[type="checkbox"]:checked')).map(
      function (input) {
        return input.value;
      }
    );
  }

  function actualizarTotalComponentes() {
    if (!totalComponentesEl) return;
    var seleccionados = obtenerComponentesSeleccionados();
    var total = window.PreciosKit
      ? window.PreciosKit.calcularTotalComponentes(seleccionados)
      : 0;
    totalComponentesEl.textContent = formatearPrecio(total);

    if (tipoKit === 'personalizado' && precioEl) {
      precioEl.innerHTML =
        (seleccionados.length ? formatearPrecio(total) : 'Selecciona componentes') +
        '<small style="font-size:.45em;opacity:.7"> COP</small>';
    }

    actualizarCampoTallaCamiseta();
  }

  function renderizarSelectorComponentes() {
    if (!listaComponentes) return;

    var componentes = obtenerComponentes();
    listaComponentes.replaceChildren();

    Object.keys(componentes).forEach(function (clave) {
      var componente = componentes[clave];
      var etiqueta = document.createElement('label');
      etiqueta.className = 'kit-componente';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'kitComponent';
      input.value = componente.id;
      input.addEventListener('change', actualizarTotalComponentes);

      var info = document.createElement('div');
      info.className = 'kit-componente__info';
      info.innerHTML =
        '<b>' +
        componente.titulo +
        '</b>' +
        (componente.descripcion ? '<span>' + componente.descripcion + '</span>' : '');

      var precio = document.createElement('span');
      precio.className = 'kit-componente__precio';
      precio.textContent = formatearPrecio(componente.precioCentavos);

      etiqueta.appendChild(input);
      etiqueta.appendChild(info);
      etiqueta.appendChild(precio);
      listaComponentes.appendChild(etiqueta);
    });

    actualizarTotalComponentes();
  }

  function abrirModal(kit) {
    tipoKit = kit === 'general' ? 'general' : kit === 'personalizado' ? 'personalizado' : 'uniautonomo';
    var meta = metaKit(tipoKit);
    titulo.textContent = 'Comprar ' + meta.titulo;
    descripcion.textContent = meta.descripcion;

    if (tipoKit === 'personalizado') {
      renderizarSelectorComponentes();
      if (selectorComponentes) selectorComponentes.hidden = false;
      precioEl.innerHTML =
        'Selecciona componentes<small style="font-size:.45em;opacity:.7"> COP</small>';
    } else {
      if (selectorComponentes) selectorComponentes.hidden = true;
      precioEl.innerHTML =
        formatearPrecio(meta.precioCentavos) + '<small style="font-size:.45em;opacity:.7"> COP</small>';
    }

    actualizarCamposInstitucionales();
    actualizarCampoTallaCamiseta();

    cargarCiudadesResidencia().catch(function (error) {
      mostrarError(error.message);
    });
    precalentarCheckout();
    cargarScriptWidgetWompi().catch(function () {});

    formulario.reset();
    if (tipoKit === 'personalizado') {
      renderizarSelectorComponentes();
    }
    datosCheckout = null;
    datosPersonales = null;
    referenciaActual = null;
    enviandoPago = false;
    detenerPolling();
    mostrarError('');
    mostrarPaso('datos');
    botonContinuar.disabled = false;
    botonContinuar.innerHTML = '<i class="tick"></i>Continuar al pago seguro';
    botonAbrirWompi.disabled = false;
    codigoMostrar.hidden = true;
    mostrarNumeroCorredor(null);
    textoConfirmacion.textContent = 'Confirmando tu pago…';
    textoConfirmacionExtra.textContent = '';

    modal.hidden = false;
    modal.classList.add('activo');
    bloquearScrollLanding();
    document.getElementById('compra-firstName').focus();
  }

  function activarPasarelaWompi() {
    modal.classList.add('pasarela-wompi');
    bloquearScrollLanding();
  }

  function restaurarDespuesPasarela() {
    modal.classList.remove('pasarela-wompi');
    modal.classList.add('activo');
    modal.hidden = false;
    bloquearScrollLanding();
  }

  function cerrarModal() {
    modal.classList.remove('activo', 'pasarela-wompi');
    modal.hidden = true;
    desbloquearScrollLanding();
    detenerPolling();
    enviandoPago = false;
  }

  function obtenerDatosFormulario() {
    var cuerpo = {
      kitType: tipoKit,
      personalInfo: {
        firstName: formulario.firstName.value.trim(),
        secondName: formulario.secondName.value.trim(),
        firstSurname: formulario.firstSurname.value.trim(),
        secondSurname: formulario.secondSurname.value.trim(),
        documentType: formulario.documentType.value,
        documentNumber: formulario.documentNumber.value.trim(),
        residenceCity: formulario.residenceCity.value.trim(),
        address: formulario.address.value.trim(),
        email: formulario.email.value.trim(),
        participantRole: formulario.participantRole
          ? formulario.participantRole.value.trim()
          : '',
        academicCareer: formulario.academicCareer
          ? formulario.academicCareer.value.trim()
          : '',
        studentCode: formulario.studentCode.value.trim(),
        shirtSize: formulario.shirtSize.value,
      },
    };

    if (tipoKit === 'personalizado') {
      cuerpo.kitComponents = obtenerComponentesSeleccionados();
    }

    return cuerpo;
  }

  function nombreCompleto(info) {
    return [info.firstName, info.secondName, info.firstSurname, info.secondSurname]
      .filter(Boolean)
      .join(' ');
  }

  function cargarScriptWidgetWompi() {
    return new Promise(function (resolver, rechazar) {
      if (window.WidgetCheckout) {
        resolver();
        return;
      }
      var script = document.createElement('script');
      script.src = URL_WIDGET_WOMPI;
      script.async = true;
      script.onload = function () {
        resolver();
      };
      script.onerror = function () {
        rechazar(new Error('No se pudo cargar la pasarela Wompi.'));
      };
      document.body.appendChild(script);
    });
  }

  function detenerPolling() {
    if (intervaloPolling) {
      clearInterval(intervaloPolling);
      intervaloPolling = null;
    }
  }

  function mostrarCodigoReclamoEnPantalla(d) {
    if (!d || d.status !== 'APPROVED' || !d.uniqueClaimCode) return false;
    codigoMostrar.textContent = d.uniqueClaimCode;
    codigoMostrar.hidden = false;
    mostrarNumeroCorredor(d);
    textoConfirmacion.textContent = '¡Pago confirmado! Tu código de reclamo:';
    textoConfirmacionExtra.textContent =
      'Presenta este código en la sede principal con tu documento. ' +
      mensajeEstadoCorreo(d);
    limpiarReferenciaPendiente();
    return true;
  }

  function consultarEstadoPago() {
    if (!referenciaActual) {
      return Promise.resolve(null);
    }
    return fetch('/api/checkout/estado?reference=' + encodeURIComponent(referenciaActual))
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, d: d };
        });
      })
      .then(function (_ref) {
        var ok = _ref.ok;
        var d = _ref.d;
        if (!ok) return null;
        return d;
      })
      .catch(function () {
        return null;
      });
  }

  function extraerTransaccionWidget(resultado) {
    if (!resultado) return null;
    return resultado.transaction || (resultado.data && resultado.data.transaction) || null;
  }

  function confirmarPagoEnServidor(transactionId) {
    if (!referenciaActual || !transactionId) {
      return Promise.resolve(null);
    }
    var idTransaccion = String(transactionId);
    return fetch('/api/checkout/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: referenciaActual,
        transactionId: idTransaccion,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, d: d };
        });
      })
      .then(function (_ref2) {
        var ok = _ref2.ok;
        var d = _ref2.d;
        if (!ok) {
          console.warn('[compra] confirmar pago:', d && d.mensaje);
          return null;
        }
        return d;
      })
      .catch(function (err) {
        console.warn('[compra] confirmar pago:', err);
        return null;
      });
  }

  function iniciarPollingEstado() {
    detenerPolling();
    var intentos = 0;
    var maxIntentos = 40;

    function revisarEstado(d) {
      if (!d) return;
      if (mostrarCodigoReclamoEnPantalla(d)) {
        detenerPolling();
        return;
      }
      if (d.status === 'REJECTED') {
        detenerPolling();
        limpiarReferenciaPendiente();
        textoConfirmacion.textContent = 'El pago no fue aprobado.';
        textoConfirmacionExtra.textContent = 'Puedes intentar de nuevo desde la sección Kit.';
      }
    }

    consultarEstadoPago().then(revisarEstado);

    intervaloPolling = setInterval(function () {
      intentos++;
      if (!referenciaActual || intentos > maxIntentos) {
        detenerPolling();
        if (intentos > maxIntentos && codigoMostrar.hidden) {
          textoConfirmacion.textContent = 'Tu pago está siendo confirmado…';
          textoConfirmacionExtra.textContent =
            'En cuanto Wompi lo apruebe, enviaremos tu código de reclamo a ' +
            correoCompraTexto() +
            '. No necesitas volver a esta página. Revisa spam o acércate a sede con tu comprobante si pasan más de 10 minutos.';
        }
        return;
      }

      consultarEstadoPago().then(revisarEstado);
    }, 3000);
  }

  function esRedirectUrlValida(url) {
    if (!url || typeof url !== 'string') return false;
    var valor = url.trim();
    if (!/^https:\/\//i.test(valor)) return false;
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|IP_DEL_VPS|tu-dominio|example\.com/i.test(valor)) {
      return false;
    }
    try {
      var parsed = new URL(valor);
      return Boolean(parsed.hostname);
    } catch (error) {
      return false;
    }
  }

  function abrirWidgetWompi() {
    if (!datosCheckout || enviandoPago) return;
    enviandoPago = true;
    botonAbrirWompi.disabled = true;
    botonAbrirWompi.textContent = 'Abriendo Wompi…';

    cargarScriptWidgetWompi()
      .then(function () {
        var opciones = {
          currency: datosCheckout.currency || 'COP',
          amountInCents: Number(datosCheckout.amountInCents),
          reference: datosCheckout.reference,
          publicKey: datosCheckout.publicKey,
          signature: { integrity: datosCheckout.signatureIntegrity },
          customerData: {
            email: datosPersonales.email,
            fullName: nombreCompleto(datosPersonales),
          },
        };

        if (esRedirectUrlValida(datosCheckout.redirectUrl)) {
          opciones.redirectUrl = datosCheckout.redirectUrl;
        }

        guardarReferenciaPendiente(datosCheckout.reference);
        activarPasarelaWompi();

        var checkout = new window.WidgetCheckout(opciones);
        checkout.open(function (resultado) {
          restaurarDespuesPasarela();
          mostrarPaso('confirmacion');
          enviandoPago = false;
          botonAbrirWompi.disabled = false;
          botonAbrirWompi.innerHTML = '<i class="tick"></i>Pagar con Wompi';

          var transaccion = extraerTransaccionWidget(resultado);
          if (transaccion && transaccion.status === 'APPROVED') {
            textoConfirmacion.textContent = '¡Pago recibido! Generando tu código…';
            textoConfirmacionExtra.textContent =
              'También lo enviaremos a ' + correoCompraTexto() + '.';
          } else if (transaccion && transaccion.id) {
            textoConfirmacion.textContent = 'Verificando tu pago con Wompi…';
            textoConfirmacionExtra.textContent =
              'Si cierras esta ventana, recibirás tu código en ' + correoCompraTexto() + '.';
          } else {
            textoConfirmacion.textContent = 'Confirmando tu pago…';
            textoConfirmacionExtra.textContent =
              'Tu código llegará a ' + correoCompraTexto() + ' en cuanto se confirme el pago.';
          }

          var promesaConfirmar = transaccion && transaccion.id
            ? confirmarPagoEnServidor(transaccion.id)
            : Promise.resolve(null);

          promesaConfirmar.then(function (d) {
            if (mostrarCodigoReclamoEnPantalla(d)) {
              detenerPolling();
            } else {
              iniciarPollingEstado();
            }
          });
        });
      })
      .catch(function (err) {
        modal.classList.remove('pasarela-wompi');
        bloquearScrollLanding();
        mostrarError(err.message);
        botonAbrirWompi.disabled = false;
        botonAbrirWompi.innerHTML = '<i class="tick"></i>Pagar con Wompi';
        enviandoPago = false;
      });
  }

  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();
    if (enviandoPago) return;

    var cuerpo = obtenerDatosFormulario();

    if (tipoKit === 'personalizado' && (!cuerpo.kitComponents || !cuerpo.kitComponents.length)) {
      mostrarError('Selecciona al menos un componente para tu kit.');
      return;
    }

    enviandoPago = true;
    mostrarError('');
    botonContinuar.disabled = true;
    botonContinuar.textContent = 'Preparando pago seguro…';

    cargarScriptWidgetWompi().catch(function () {});

    fetchConReintento(
      '/api/checkout/initiate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      },
      2,
      function () {
        mostrarError('No pudimos conectar con el servidor. Reintentando…');
      }
    )
      .then(function (respuesta) {
        return respuesta.json().then(function (datos) {
          return { ok: respuesta.ok, datos: datos };
        });
      })
      .then(function (_ref2) {
        var ok = _ref2.ok;
        var datos = _ref2.datos;
        if (!ok) {
          throw new Error(datos.mensaje || 'No se pudo iniciar el pago');
        }

        datosCheckout = datos;
        datosPersonales = cuerpo.personalInfo;
        referenciaActual = datos.reference;
        guardarReferenciaPendiente(datos.reference);

        var resumenHtml =
          '<strong>Kit:</strong> ' +
          metaKit(tipoKit).titulo +
          '<br><strong>Total:</strong> ' +
          formatearPrecio(datos.amountInCents) +
          '<br><strong>Correo:</strong> ' +
          cuerpo.personalInfo.email;

        if (cuerpo.personalInfo.shirtSize) {
          resumenHtml += '<br><strong>Talla:</strong> ' + cuerpo.personalInfo.shirtSize;
        }

        if (tipoKit === 'personalizado' && cuerpo.kitComponents.length) {
          var componentes = obtenerComponentes();
          var nombres = cuerpo.kitComponents
            .map(function (id) {
              return componentes[id] ? componentes[id].titulo : id;
            })
            .join(', ');
          resumenHtml += '<br><strong>Componentes:</strong> ' + nombres;
        }

        if (datos.retomandoPagoPendiente) {
          resumenHtml =
            '<p class="modal-compra__aviso">Tienes un pago pendiente con este correo. Continúa con Wompi para completarlo.</p>' +
            resumenHtml;
        }

        resumenPago.innerHTML = resumenHtml;
        mostrarError('');

        mostrarPaso('pago');
        enviandoPago = false;
        botonAbrirWompi.disabled = false;
        botonAbrirWompi.innerHTML = '<i class="tick"></i>Pagar con Wompi';
      })
      .catch(function (error) {
        mostrarError(
          esErrorRed(error)
            ? 'El servidor tardó en responder. Intenta de nuevo.'
            : error.message
        );
        enviandoPago = false;
        botonContinuar.disabled = false;
        botonContinuar.innerHTML = '<i class="tick"></i>Continuar al pago seguro';
      });
  });

  botonAbrirWompi.addEventListener('click', abrirWidgetWompi);
  botonCerrarExito.addEventListener('click', cerrarModal);
  btnCerrar.addEventListener('click', cerrarModal);
  fondo.addEventListener('click', cerrarModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('activo')) {
      cerrarModal();
    }
  });

  function enlazarRestriccionesFormulario() {
    if (!window.RestriccionesFormulario) return;
    var rf = window.RestriccionesFormulario;
    rf.enlazarSoloTexto(formulario.firstName);
    rf.enlazarSoloTexto(formulario.secondName);
    rf.enlazarSoloTexto(formulario.firstSurname);
    rf.enlazarSoloTexto(formulario.secondSurname);
    rf.enlazarSoloNumeros(formulario.documentNumber);
    rf.enlazarCodigoEstudiante(formulario.studentCode);
  }

  enlazarRestriccionesFormulario();

  if (selectRol) {
    selectRol.addEventListener('change', actualizarCamposPorRol);
  }

  document.querySelectorAll('[data-abrir-compra]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kit = btn.getAttribute('data-abrir-compra');
      var listo = window.PreciosKit ? window.PreciosKit.listo : Promise.resolve();
      Promise.all([listo, cargarCiudadesResidencia().catch(function () { return null; })])
        .then(function () {
          abrirModal(kit);
        });
    });
  });

  function leerIdTransaccionRetorno() {
    var desdeQuery = new URLSearchParams(window.location.search).get('id');
    if (desdeQuery) return desdeQuery;
    var hash = window.location.hash || '';
    var posicion = hash.indexOf('?');
    if (posicion === -1) return null;
    return new URLSearchParams(hash.slice(posicion + 1)).get('id');
  }

  function limpiarParametrosRetorno() {
    if (!window.history.replaceState) return;
    var url = new URL(window.location.href);
    url.searchParams.delete('id');
    url.searchParams.delete('env');
    var hash = url.hash.split('?')[0];
    window.history.replaceState({}, '', url.pathname + url.search + hash);
  }

  function retomarPagoTrasRedireccion() {
    var idTransaccion = leerIdTransaccionRetorno();
    var referencia = leerReferenciaPendiente();
    if (!idTransaccion || !referencia) return false;

    limpiarParametrosRetorno();
    referenciaActual = referencia;
    titulo.textContent = 'Confirmación de pago';
    descripcion.textContent = '';
    precioEl.innerHTML = '';
    codigoMostrar.hidden = true;
    mostrarNumeroCorredor(null);
    textoConfirmacion.textContent = 'Verificando tu pago con Wompi…';
    textoConfirmacionExtra.textContent =
      'Si ya pagaste, tu código llegará al correo que usaste en la compra. No necesitas volver a Wompi.';
    mostrarError('');
    mostrarPaso('confirmacion');
    modal.hidden = false;
    modal.classList.add('activo');
    bloquearScrollLanding();

    confirmarPagoEnServidor(idTransaccion).then(function (d) {
      if (mostrarCodigoReclamoEnPantalla(d)) {
        detenerPolling();
      } else {
        iniciarPollingEstado();
      }
    });
    return true;
  }

  var params = new URLSearchParams(window.location.search);
  var comprar = retomarPagoTrasRedireccion() ? null : params.get('comprar') || params.get('kit');
  if (comprar) {
    var listoCompra = window.PreciosKit ? window.PreciosKit.listo : Promise.resolve();
    Promise.all([listoCompra, cargarCiudadesResidencia().catch(function () { return null; })])
      .then(function () {
        abrirModal(comprar);
      });
    if (window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete('comprar');
      url.searchParams.delete('kit');
      window.history.replaceState({}, '', url.pathname + url.hash);
    }
  }

  cargarCiudadesResidencia().catch(function () {
    /* El error se mostrará al abrir el modal. */
  });
})();
