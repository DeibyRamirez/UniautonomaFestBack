function traducirErrorSmtp(error) {
  const codigo = error?.code || '';
  const mensaje = String(error?.message || error || 'Error desconocido SMTP');

  switch (codigo) {
    case 'ETIMEDOUT':
      return 'Tiempo de espera agotado al conectar con el servidor SMTP. Verifica SMTP_HOST y SMTP_PORT.';
    case 'ECONNREFUSED':
      return 'Conexión rechazada por el servidor SMTP. Verifica SMTP_HOST, SMTP_PORT y SMTP_SECURE.';
    case 'EAUTH':
    case 'EENVELOPE':
      return 'Autenticación SMTP fallida. Verifica SMTP_USER y SMTP_PASS.';
    case 'ESOCKET':
      return 'Error de red al comunicarse con el servidor SMTP.';
    case 'ETLS':
      return 'Error TLS/SSL al conectar con el servidor SMTP. Revisa SMTP_SECURE y el puerto (587 vs 465).';
    default:
      if (/authentication failed/i.test(mensaje)) {
        return 'Autenticación SMTP fallida. Verifica SMTP_USER y SMTP_PASS.';
      }
      if (/self signed certificate/i.test(mensaje)) {
        return 'Certificado TLS del servidor SMTP no válido.';
      }
      if (/wrong version number|tls_validate_record_header/i.test(mensaje)) {
        return (
          'Error TLS/SSL: SMTP_SECURE no coincide con el puerto. ' +
          'Puerto 587 o 2525 → SMTP_SECURE=false. Puerto 465 → SMTP_SECURE=true.'
        );
      }
      return `Error SMTP: ${mensaje}`;
  }
}

module.exports = { traducirErrorSmtp };
