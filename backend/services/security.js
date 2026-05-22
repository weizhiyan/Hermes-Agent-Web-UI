function redactSecrets(value) {
  if (value == null) return value;
  let text = String(value);
  text = text.replace(/(X-Auth-Token\s*:\s*)([^\s"'`|\\]+)(?=\\?["'`\s|]|$)/gi, '$1[已隐藏]');
  text = text.replace(/(Authorization\s*:\s*Bearer\s+)([^\s"'`|\\]+)(?=\\?["'`\s|]|$)/gi, '$1[已隐藏]');
  text = text.replace(/\b(token|api[_-]?key|secret|password)\s*[:=]\s*[^\s"'`,;|]{8,}/gi, '$1: [已隐藏]');
  text = text.replace(/\b(sk-[A-Za-z0-9_-]{20,})\b/g, '[已隐藏]');
  return text;
}

function sanitizeAny(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(sanitizeAny);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = sanitizeAny(item);
    return out;
  }
  return value;
}

function sanitizeMessage(message) {
  return sanitizeAny(message || {});
}

function sanitizeChat(chat) {
  if (!chat) return chat;
  return {
    ...chat,
    messages: Array.isArray(chat.messages) ? chat.messages.map(sanitizeMessage) : [],
  };
}

module.exports = { redactSecrets, sanitizeAny, sanitizeMessage, sanitizeChat };
