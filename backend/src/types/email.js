/**
 * @typedef {Object} SendEmailPayload
 * @property {string} to
 * @property {string} subject
 * @property {string} html
 * @property {string} [text]
 * @property {string} [replyTo]
 * @property {Array<{filename: string, content: Buffer|string}>} [attachments]
 * @property {string} [idempotencyKey]
 */

/**
 * @typedef {Object} SendEmailResult
 * @property {boolean} success
 * @property {string} [messageId]
 * @property {'resend'|'smtp'} provider
 * @property {boolean} [omitido]
 * @property {any} [error]
 */

module.exports = {};
