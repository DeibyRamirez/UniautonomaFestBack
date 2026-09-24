const parametros = new URLSearchParams(window.location.search);
const tipoKit = parametros.get('kit') === 'general' ? 'general' : 'uniautonomo';

const tituloKit = document.getElementById('titulo-kit');
const descripcionKit = document.getElementById('descripcion-kit');
const precioKit = document.getElementById('precio-kit');
const campoCodigo = document.getElementById('campo-codigo-estudiante');
const inputCodigo = document.getElementById('studentCode');
const formulario = document.getElementById('formulario-compra');
const mensajeError = document.getElementById('mensaje-error');
const botonPagar = document.getElementById('boton-pagar');

const METADATOS_KIT = {
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

const URL_WIDGET_WOMPI = 'https://checkout.wompi.co/widget.js';

function formatearPrecio(centavos) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

function configurarVista() {
  const meta = METADATOS_KIT[tipoKit];
  tituloKit.textContent = `Comprar ${meta.titulo}`;
  descripcionKit.textContent = meta.descripcion;
  precioKit.textContent = formatearPrecio(meta.precioCentavos);

  if (tipoKit === 'general') {
    campoCodigo.hidden = true;
    inputCodigo.removeAttribute('required');
  } else {
    inputCodigo.setAttribute('required', 'required');
  }
}

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = !texto;
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
    },
  };
}

function validarRespuestaCheckout(respuesta) {
  const faltantes = [];
  if (!respuesta.publicKey) faltantes.push('llave pública');
  if (!respuesta.amountInCents) faltantes.push('monto');
  if (!respuesta.reference) faltantes.push('referencia');
  if (!respuesta.signatureIntegrity) faltantes.push('firma de integridad');
  if (faltantes.length) {
    throw new Error(
      `Respuesta incompleta del servidor (${faltantes.join(', ')}). Revisa WOMPI_* en backend/.env`
    );
  }
}

function cargarScriptWidgetWompi() {
  return new Promise((resolver, rechazar) => {
    if (window.WidgetCheckout) {
      resolver();
      return;
    }
    const script = document.createElement('script');
    script.src = URL_WIDGET_WOMPI;
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () =>
      rechazar(new Error('No se pudo cargar el checkout de Wompi. Revisa tu conexión.'));
    document.body.appendChild(script);
  });
}

function nombreCompletoDesde(personalInfo) {
  return [
    personalInfo.firstName,
    personalInfo.secondName,
    personalInfo.firstSurname,
    personalInfo.secondSurname,
  ]
    .filter(Boolean)
    .join(' ');
}

async function abrirCheckoutWompi(respuesta, personalInfo) {
  validarRespuestaCheckout(respuesta);
  await cargarScriptWidgetWompi();

  const nombreCompleto = nombreCompletoDesde(personalInfo);
  const opciones = {
    currency: respuesta.currency || 'COP',
    amountInCents: Number(respuesta.amountInCents),
    reference: respuesta.reference,
    publicKey: respuesta.publicKey,
    signature: { integrity: respuesta.signatureIntegrity },
    customerData: {
      email: personalInfo.email,
      fullName: nombreCompleto,
    },
  };

  if (respuesta.redirectUrl && !respuesta.redirectUrl.includes('localhost')) {
    opciones.redirectUrl = respuesta.redirectUrl;
  }

  const checkout = new window.WidgetCheckout(opciones);
  checkout.open((resultado) => {
    if (resultado?.transaction?.status === 'APPROVED') {
      window.location.href = respuesta.redirectUrl || '/checkout/gracias.html';
    }
  });
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('');
  botonPagar.disabled = true;

  try {
    const cuerpo = obtenerDatosFormulario();
    const respuestaHttp = await fetch('/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    const datos = await respuestaHttp.json();

    if (!respuestaHttp.ok) {
      throw new Error(datos.mensaje || 'No se pudo iniciar el pago');
    }

    await abrirCheckoutWompi(datos, cuerpo.personalInfo);
  } catch (error) {
    mostrarError(error.message);
  } finally {
    botonPagar.disabled = false;
  }
});

configurarVista();
