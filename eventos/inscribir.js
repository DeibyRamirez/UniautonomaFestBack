const formulario = document.getElementById('formulario-evento');
const mensajeExito = document.getElementById('mensaje-exito');
const mensajeError = document.getElementById('mensaje-error');
const botonEnviar = document.getElementById('boton-enviar');

const tipoEvento = formulario?.dataset.tipoEvento;
if (!formulario || !tipoEvento) {
  console.error('Formulario de evento no configurado');
}

function mostrarExito(texto) {
  mensajeExito.textContent = texto;
  mensajeExito.hidden = !texto;
  mensajeError.hidden = true;
}

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = !texto;
  mensajeExito.hidden = true;
}

function recogerDatos() {
  const datos = new FormData(formulario);
  const cuerpo = {};
  for (const [clave, valor] of datos.entries()) {
    cuerpo[clave] = String(valor).trim();
  }
  return cuerpo;
}

if (!formulario || !tipoEvento) {
  /* sin formulario no hay nada que enlazar */
} else formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarExito('');
  mostrarError('');
  botonEnviar.disabled = true;

  try {
    const respuesta = await fetch('/api/eventos/inscripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoEvento,
        datos: recogerDatos(),
      }),
    });

    const resultado = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || 'No se pudo registrar la inscripción');
    }

    formulario.reset();
    const avisoCorreo = resultado.correoEnviado
      ? ' Revisa tu correo: te enviamos la confirmación.'
      : ' Guardamos tu registro; si no llega el correo, revisa spam o contacta al fest.';
    mostrarExito((resultado.mensaje || '¡Listo!') + avisoCorreo);
  } catch (error) {
    mostrarError(error.message);
  } finally {
    botonEnviar.disabled = false;
  }
});
