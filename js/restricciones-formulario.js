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

  var MAX_CODIGO_ESTUDIANTE = 5;

  function enlazarSoloNumeros(input, maxLongitud) {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]+');
    input.setAttribute('title', 'Solo números');
    if (maxLongitud) {
      input.setAttribute('maxlength', String(maxLongitud));
    }
    input.addEventListener('input', function () {
      var limpio = filtrarSoloNumeros(input.value);
      if (maxLongitud) limpio = limpio.slice(0, maxLongitud);
      if (input.value !== limpio) input.value = limpio;
    });
  }

  function enlazarCodigoEstudiante(input) {
    enlazarSoloNumeros(input, MAX_CODIGO_ESTUDIANTE);
  }

  function validarTextoNombre(valor, etiqueta) {
    var texto = String(valor || '').trim();
    if (!texto) return etiqueta + ' es obligatorio';
    if (!REGEX_TEXTO_NOMBRE.test(texto)) return etiqueta + ' solo puede contener letras';
    return '';
  }

  function validarSoloNumeros(valor, etiqueta, obligatorio, maxLongitud) {
    var texto = String(valor || '').trim();
    if (!texto) return obligatorio ? etiqueta + ' es obligatorio' : '';
    if (!REGEX_SOLO_NUMEROS.test(texto)) return etiqueta + ' solo puede contener números';
    if (maxLongitud && texto.length > maxLongitud) {
      return etiqueta + ' debe tener máximo ' + maxLongitud + ' dígitos';
    }
    return '';
  }

  function validarCodigoEstudiante(valor, etiqueta, obligatorio) {
    return validarSoloNumeros(
      valor,
      etiqueta || 'Código de estudiante',
      obligatorio,
      MAX_CODIGO_ESTUDIANTE
    );
  }

  global.RestriccionesFormulario = {
    MAX_CODIGO_ESTUDIANTE: MAX_CODIGO_ESTUDIANTE,
    enlazarSoloTexto: enlazarSoloTexto,
    enlazarSoloNumeros: enlazarSoloNumeros,
    enlazarCodigoEstudiante: enlazarCodigoEstudiante,
    validarTextoNombre: validarTextoNombre,
    validarSoloNumeros: validarSoloNumeros,
    validarCodigoEstudiante: validarCodigoEstudiante,
  };
})(window);
