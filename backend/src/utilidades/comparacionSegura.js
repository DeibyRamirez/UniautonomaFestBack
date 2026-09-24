const crypto = require('crypto');

function compararHashesHex(hashA, hashB) {
  if (!hashA || !hashB) return false;
  const a = Buffer.from(String(hashA).toLowerCase(), 'utf8');
  const b = Buffer.from(String(hashB).toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { compararHashesHex };
