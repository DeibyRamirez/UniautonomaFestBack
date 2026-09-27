(function (global) {
  var REGEX_TEXTO_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/;
  var REGEX_SOLO_NUMEROS = /^\d+$/;

  function filtrarSoloTexto(valor) {
    return String(valor || '').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]/g, '');
  }

  function filtrarSoloNumeros(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function enlazarSoloTexto(input) {
    if (!input) return;
    input.setAttribute('pattern', "[A-Za-zÁÉÍÓÚáéíóúÑñÜü\\s'-]+");
    input.setAttribute('title', 'Solo letras');
    input.addEventListener('input', function () {
      var limpio = filtrarSoloTexto(input.value);
      if (input.value !== limpio) input.value = limpio;
    });
  }

  function enlazarSoloNumeros(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]+');
    input.setAttribute('title', 'Solo números');
    input.addEventListener('input', function () {
      var limpio = filtrarSoloNumeros(input.value);
      if (input.value !== limpio) input.value = limpio;
    });
  }

  function validarTextoNombre(valor, etiqueta) {
    var texto = String(valor || '').trim();
    if (!texto) return etiqueta + ' es obligatorio';
    if (!REGEX_TEXTO_NOMBRE.test(texto)) return etiqueta + ' solo puede contener letras';
    return '';
  }

  function validarSoloNumeros(valor, etiqueta, obligatorio) {
    var texto = String(valor || '').trim();
    if (!texto) return obligatorio ? etiqueta + ' es obligatorio' : '';
    if (!REGEX_SOLO_NUMEROS.test(texto)) return etiqueta + ' solo puede contener números';
    return '';
  }

  global.RestriccionesFormulario = {
    enlazarSoloTexto: enlazarSoloTexto,
    enlazarSoloNumeros: enlazarSoloNumeros,
    validarTextoNombre: validarTextoNombre,
    validarSoloNumeros: validarSoloNumeros,
  };
})(window);
