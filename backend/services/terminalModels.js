const store = require('./store');

const AUDIO_MODEL_RE = /\b(tts|voiceclone|voicedesign|speech|audio)\b/i;
const NON_CHAT_KINDS = new Set(['image', 'video', 'audio', 'tts', 'speech']);

function normalizeModelApiFormat(model = {}) {
  const raw = String(model.apiFormat || model.api_format || 'openai-chat').trim().toLowerCase();
  if (raw === 'openai_image') return 'openai-image';
  if (raw === 'openai_video') return 'openai-video';
  return raw || 'openai-chat';
}

function modelBase(model = {}) {
  return String(model.base || model.base_url || model.api_base || '').trim();
}

function hasTerminalRelayAuth(model = {}) {
  const authType = String(model.authType || model.auth_type || 'bearer').toLowerCase();
  return authType === 'none' || !!(model.key || model.api_key);
}

function isTerminalChatModel(model = {}, options = {}) {
  if (!model || !model.name || model.enabled === false) return false;
  const apiFormat = normalizeModelApiFormat(model);
  const kind = String(model.kind || '').toLowerCase();
  const name = String(model.name || model.id || '').toLowerCase();
  const tags = Array.isArray(model.tags) ? model.tags.map(tag => String(tag).toLowerCase()) : [];
  if (apiFormat !== 'openai-chat') return false;
  if (NON_CHAT_KINDS.has(kind) || tags.some(tag => NON_CHAT_KINDS.has(tag))) return false;
  if (AUDIO_MODEL_RE.test(name)) return false;
  if (options.requireRelayReady !== false && (!modelBase(model) || !hasTerminalRelayAuth(model))) return false;
  return true;
}

function collectTerminalChatModels(options = {}) {
  const root = store.read('models', {});
  const scopeNames = Array.isArray(options.scopes)
    ? options.scopes
    : (options.includeAgent ? ['webui', 'agent'] : ['webui']);
  const configs = root && (root.webui || root.agent)
    ? scopeNames.map(scope => root[scope]).filter(Boolean)
    : [root].filter(Boolean);
  const byName = new Map();

  for (const cfg of configs) {
    for (const model of (Array.isArray(cfg.library) ? cfg.library : [])) {
      if (!isTerminalChatModel(model, options)) continue;
      const key = String(model.name || '').toLowerCase();
      if (key && !byName.has(key)) byName.set(key, model);
    }
  }

  if (options.extraModel && isTerminalChatModel(options.extraModel, options)) {
    const key = String(options.extraModel.name || '').toLowerCase();
    if (key && !byName.has(key)) byName.set(key, options.extraModel);
  }

  return [...byName.values()];
}

module.exports = {
  collectTerminalChatModels,
  hasTerminalRelayAuth,
  isTerminalChatModel,
  normalizeModelApiFormat,
};
