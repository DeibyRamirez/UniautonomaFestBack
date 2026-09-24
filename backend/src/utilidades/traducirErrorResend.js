function traducirErrorResend(mensajeIngles) {
  const texto = String(mensajeIngles || '');

  if (texto.includes('only send testing emails to your own email address')) {
    const coincidencia = texto.match(/your own email address \(([^)]+)\)/i);
    const cuenta = coincidencia ? coincidencia[1] : 'tu cuenta de Resend';
    return (
      `Resend (modo prueba) solo permite enviar a ${cuenta}. ` +
      'Opciones: (1) en compras de prueba usa ese correo como comprador, ' +
      '(2) define RESEND_CORREO_SANDBOX en backend/.env con ese mismo correo para redirigir envíos en local, ' +
      '(3) verifica un dominio en https://resend.com/domains para enviar a cualquier destinatario.'
    );
  }

  if (texto.includes('domain is not verified')) {
    return (
      'El dominio del remitente no está verificado en Resend. ' +
      'Usa CORREO_REMITENTE=Uniautónoma Fest <onboarding@resend.dev> en pruebas o verifica tu dominio institucional.'
    );
  }

  return texto || 'Resend rechazó el envío';
}

module.exports = { traducirErrorResend };
