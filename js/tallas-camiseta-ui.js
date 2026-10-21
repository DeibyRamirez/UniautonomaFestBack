(function (global) {
  var TALLAS_RESPALDO = [
    { codigo: 'S', activa: false, comprable: false, stock: null },
    { codigo: 'M', activa: false, comprable: false, stock: null },
    { codigo: 'L', activa: false, comprable: false, stock: null },
    { codigo: 'XL', activa: false, comprable: false, stock: null },
  ];

  function normalizarListaTallas(datosApi) {
    var lista = datosApi;
    if (datosApi && !Array.isArray(datosApi) && Array.isArray(datosApi.tallasCamiseta)) {
      lista = datosApi.tallasCamiseta;
    }
    if (!Array.isArray(lista) || !lista.length) {
      return TALLAS_RESPALDO.slice();
    }
    return lista;
  }

  function textoOpcionTalla(item) {
    var codigo = item.codigo;
    if (item.activa === false) {
      return codigo + ' — Agotada';
    }
    if (!item.comprable) {
      if (item.activa && item.stock === 0) {
        return codigo + ' — Sin stock';
      }
      return codigo + ' — Agotada';
    }
    if (item.stock === null || item.stock === undefined) return codigo + ' — Disponible';
    var n = item.stock;
    return codigo + ' — ' + n + ' disponible' + (n === 1 ? '' : 's');
  }

  function poblarSelectTallas(select, tallas, valorPrevio) {
    if (!select) return;
    var previo = valorPrevio !== undefined ? valorPrevio : select.value;
    var lista = normalizarListaTallas(tallas);
    select.innerHTML = '<option value="">Seleccionar</option>';
    lista.forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item.codigo;
      opt.textContent = textoOpcionTalla(item);
      if (!item.comprable) opt.disabled = true;
      select.appendChild(opt);
    });
    if (previo && select.querySelector('option[value="' + previo + '"]:not([disabled])')) {
      select.value = previo;
    } else {
      select.value = '';
    }
  }

  global.UAF26TallasCamisetaUi = {
    TALLAS_RESPALDO: TALLAS_RESPALDO,
    normalizarListaTallas: normalizarListaTallas,
    textoOpcionTalla: textoOpcionTalla,
    poblarSelectTallas: poblarSelectTallas,
  };
})();
