/**
 * Muestra u oculta el texto del campo contraseña (botón Ver / Ocultar).
 */
export function enlazarAlternarContrasena(input, boton) {
  if (!input || !boton) return;

  boton.addEventListener('click', () => {
    const estaOculta = input.type === 'password';
    if (estaOculta) {
      input.type = 'text';
      boton.textContent = 'Ocultar';
      boton.setAttribute('aria-pressed', 'true');
      boton.setAttribute('aria-label', 'Ocultar contraseña');
    } else {
      input.type = 'password';
      boton.textContent = 'Ver';
      boton.setAttribute('aria-pressed', 'false');
      boton.setAttribute('aria-label', 'Mostrar contraseña');
    }
  });
}

export function restablecerVisibilidadContrasena(input, boton) {
  if (!input || !boton) return;
  input.type = 'password';
  boton.textContent = 'Ver';
  boton.setAttribute('aria-pressed', 'false');
  boton.setAttribute('aria-label', 'Mostrar contraseña');
}
