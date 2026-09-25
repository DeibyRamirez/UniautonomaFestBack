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
  const codigoMostrar = document.getElementById('codigo-reclamo-mostrar');
  const textoConfirmacion = document.getElementById('texto-confirmacion');
  const textoConfirmacionExtra = document.getElementById('texto-confirmacion-extra');
  const indicadoresPaso = modal.querySelectorAll('[data-indicador-paso]');

  let tipoKit = 'uniautonomo';
  let enviandoPago = false;
  let datosCheckout = null;
  let datosPersonales = null;
  let referenciaActual = null;
  let intervaloPolling = null;

  function obtenerMetadatosKit() {
    return window.PreciosKit ? window.PreciosKit.METADATOS : null;
  }

  function metaKit(tipo) {
    var metadatos = obtenerMetadatosKit();
    if (metadatos && metadatos[tipo]) return metadatos[tipo];
    return {
      titulo: tipo === 'general' ? 'Kit Corredor' : 'Kit Sangre Azul',
      descripcion: '',
      precioCentavos: tipo === 'general' ? 8000000 : 7500000,
    };
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

  function abrirModal(kit) {
    tipoKit = kit === 'general' ? 'general' : 'uniautonomo';
    var meta = metaKit(tipoKit);
    titulo.textContent = 'Comprar ' + meta.titulo;
    descripcion.textContent = meta.descripcion;
    precioEl.innerHTML =
      formatearPrecio(meta.precioCentavos) + '<small style="font-size:.45em;opacity:.7"> COP</small>';

    if (tipoKit === 'general') {
      campoCodigo.hidden = true;
      inputCodigo.removeAttribute('required');
    } else {
      campoCodigo.hidden = false;
      inputCodigo.setAttribute('required', 'required');
    }

    formulario.reset();
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
    textoConfirmacion.textContent = 'Confirmando tu pago…';
    textoConfirmacionExtra.textContent = '';

    modal.hidden = false;
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
    document.getElementById('compra-firstName').focus();
  }

  function liberarScrollPasarela() {
    document.documentElement.classList.add('pasarela-wompi');
    document.body.classList.add('pasarela-wompi');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
    modal.classList.add('pasarela-wompi');
  }

  function restaurarDespuesPasarela() {
    document.documentElement.classList.remove('pasarela-wompi');
    document.body.classList.remove('pasarela-wompi');
    document.documentElement.style.overflow = '';
    modal.classList.remove('pasarela-wompi');
    modal.classList.add('activo');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal() {
    modal.classList.remove('activo', 'pasarela-wompi');
    modal.hidden = true;
    document.documentElement.classList.remove('pasarela-wompi');
    document.body.classList.remove('pasarela-wompi');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
    detenerPolling();
    enviandoPago = false;
  }

  function obtenerDatosFormulario() {
    return {
      kitType: tipoKit,
      personalInfo: {
        firstName: formulario.firstName.value.trim(),
        secondName: formulario.secondName.value.trim(),
        firstSurname: formulario.firstSurname.value.trim(),
        secondSurname: formulario.secondSurname.value.trim(),
        email: formulario.email.value.trim(),
        studentCode: formulario.studentCode.value.trim(),
        shirtSize: formulario.shirtSize.value,
      },
    };
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
    textoConfirmacion.textContent = '¡Pago confirmado! Tu código de reclamo:';
    textoConfirmacionExtra.textContent =
      'Presenta este código en la sede principal con tu documento. ' +
      (d.emailEnviado
        ? 'También lo enviamos a tu correo.'
        : 'Si no llega el correo, usa este código en pantalla.');
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
          textoConfirmacionExtra.textContent =
            'Si ya pagaste, revisa tu correo en unos minutos o acércate a sede con tu comprobante.';
        }
        return;
      }

      consultarEstadoPago().then(revisarEstado);
    }, 3000);
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

        if (datosCheckout.redirectUrl && datosCheckout.redirectUrl.indexOf('localhost') === -1) {
          opciones.redirectUrl = datosCheckout.redirectUrl;
        }

        liberarScrollPasarela();

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
          } else if (transaccion && transaccion.id) {
            textoConfirmacion.textContent = 'Verificando tu pago con Wompi…';
          } else {
            textoConfirmacion.textContent = 'Confirmando tu pago…';
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
        mostrarError(err.message);
        botonAbrirWompi.disabled = false;
        botonAbrirWompi.innerHTML = '<i class="tick"></i>Pagar con Wompi';
        enviandoPago = false;
      });
  }

  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();
    if (enviandoPago) return;

    enviandoPago = true;
    mostrarError('');
    botonContinuar.disabled = true;
    botonContinuar.textContent = 'Procesando…';

    var cuerpo = obtenerDatosFormulario();

    fetch('/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
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

        resumenPago.innerHTML =
          '<strong>Kit:</strong> ' +
          metaKit(tipoKit).titulo +
          '<br><strong>Total:</strong> ' +
          formatearPrecio(datos.amountInCents) +
          '<br><strong>Talla:</strong> ' +
          cuerpo.personalInfo.shirtSize +
          '<br><strong>Correo:</strong> ' +
          cuerpo.personalInfo.email;

        mostrarPaso('pago');
        enviandoPago = false;
        botonAbrirWompi.disabled = false;
        botonAbrirWompi.innerHTML = '<i class="tick"></i>Pagar con Wompi';
      })
      .catch(function (error) {
        mostrarError(error.message);
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

  document.querySelectorAll('[data-abrir-compra]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kit = btn.getAttribute('data-abrir-compra');
      var listo = window.PreciosKit ? window.PreciosKit.listo : Promise.resolve();
      listo.then(function () {
        abrirModal(kit);
      });
    });
  });

  var params = new URLSearchParams(window.location.search);
  var comprar = params.get('comprar') || params.get('kit');
  if (comprar) {
    var listoCompra = window.PreciosKit ? window.PreciosKit.listo : Promise.resolve();
    listoCompra.then(function () {
      abrirModal(comprar);
    });
    if (window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete('comprar');
      url.searchParams.delete('kit');
      window.history.replaceState({}, '', url.pathname + url.hash);
    }
  }
})();
