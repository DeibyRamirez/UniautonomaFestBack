function esMailtrapTesting(host) {
  const valor = String(host || '').toLowerCase();
  return valor.includes('mailtrap.io') && valor.includes('sandbox');
}

function mostrarAvisoMailtrapSandbox(host) {
  if (!esMailtrapTesting(host)) return;

  console.warn(
    '[correo] Mailtrap Testing activo: los correos NO llegan a bandejas reales. ' +
      'Revisa tu inbox en https://mailtrap.io → Email Testing → Inboxes'
  );
}

module.exports = { esMailtrapTesting, mostrarAvisoMailtrapSandbox };
