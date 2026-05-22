const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const store = require('../services/store');
const { generateImageFromPrompt } = require('./images');
const feishuStream = require('../services/feishuStream');

const router = express.Router();
const KEY = 'gateway';
const FEISHU_EVENT_TTL_MS = 10 * 60 * 1000;
const feishuHandledEvents = new Map();
const DEFAULTS = {
  enabled: true,
  platforms: [
    { id: 'telegram', name: 'Telegram', icon: 'TG', desc: 'Bot API 消息接入', fields: ['botToken', 'webhookUrl'], configured: false, enabled: false, config: {} },
    { id: 'discord', name: 'Discord', icon: 'DC', desc: '服务器与私信通道', fields: ['botToken', 'clientId', 'guildId'], configured: false, enabled: false, config: {} },
    { id: 'slack', name: 'Slack', icon: 'SL', desc: '团队工作区机器人', fields: ['botToken', 'signingSecret', 'appToken'], configured: false, enabled: false, config: {} },
    { id: 'dingtalk', name: 'DingTalk', icon: 'DT', desc: '钉钉群机器人', fields: ['appKey', 'appSecret', 'robotCode'], configured: false, enabled: false, config: {} },
    { id: 'feishu', name: 'Feishu', icon: 'FS', desc: '飞书应用与群聊', fields: ['appId', 'appSecret', 'verificationToken'], configured: false, enabled: false, config: {} },
    { id: 'wechat', name: 'WeChat', icon: 'WX', desc: '企业微信或个人通道', fields: ['corpId', 'agentId', 'secret'], configured: false, enabled: false, config: {} },
  ],
};

function requiredFields(id, fields) {
  if (id === 'feishu') return ['appId', 'appSecret'];
  return fields || [];
}

function isConfigured(platform) {
  const config = platform?.config || {};
  const required = requiredFields(platform?.id, platform?.fields);
  if (!required.length) return Object.values(config).some(Boolean);
  return required.every((field) => String(config[field] || '').trim());
}

function normalize(data) {
  const oldPlatforms = Array.isArray(data?.platforms) ? data.platforms : [];
  const byKey = new Map(oldPlatforms.map(p => [p.id || String(p.name || '').toLowerCase(), p]));
  return {
    enabled: data?.enabled ?? DEFAULTS.enabled,
    platforms: DEFAULTS.platforms.map(def => {
      const old = byKey.get(def.id) || byKey.get(def.name.toLowerCase()) || {};
      const config = old.config || {};
      const merged = { ...def, ...old, id: def.id, name: def.name, icon: def.icon, desc: def.desc, fields: def.fields, config };
      merged.configured = isConfigured(merged);
      merged.enabled = !!old.enabled && merged.configured;
      merged.connected = !!old.connected && merged.enabled;
      merged.statusMsg = old.statusMsg || '';
      merged.checkedAt = old.checkedAt || 0;
      return merged;
    }),
  };
}
function load() {
  const data = normalize(store.read(KEY, null));
  store.write(KEY, data);
  return data;
}

function saveGateway(data) {
  const normalized = normalize(data);
  store.write(KEY, normalized);
  return normalized;
}

function postJson(url, payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const req = https.request(url, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(text || '{}');
          resolve({ status: res.statusCode, json, text });
        } catch (_) {
          resolve({ status: res.statusCode, json: null, text });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('连接超时')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function requestJson(url, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, timeout: timeoutMs, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(text || '{}'), text });
        } catch (_) {
          resolve({ status: res.statusCode, json: null, text });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('????')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getFeishuTenantToken(platform) {
  const config = platform?.config || {};
  const appId = String(config.appId || '').trim();
  const appSecret = String(config.appSecret || '').trim();
  if (!appId || !appSecret) throw new Error('请填写 appId 和 appSecret');
  const result = await postJson('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: appId,
    app_secret: appSecret,
  });
  if (result.status >= 200 && result.status < 300 && result.json?.code === 0 && result.json?.tenant_access_token) {
    return result.json.tenant_access_token;
  }
  throw new Error(result.json?.msg || result.text || `HTTP ${result.status}`);
}

function feishuTextMessage(text) {
  return { msg_type: 'text', content: JSON.stringify({ text: String(text || '') }) };
}

function feishuImageMessage(imageKey) {
  return { msg_type: 'image', content: JSON.stringify({ image_key: imageKey }) };
}

async function sendFeishuMessage(platform, receiveId, receiveIdType, message) {
  const token = await getFeishuTenantToken(platform);
  const type = receiveIdType || 'chat_id';
  const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(type)}`;
  const result = await requestJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receive_id: receiveId, ...message }),
  });
  if (!(result.status >= 200 && result.status < 300 && result.json?.code === 0)) {
    throw new Error(result.json?.msg || result.text || '\u98de\u4e66\u6d88\u606f\u53d1\u9001\u5931\u8d25 HTTP ' + result.status);
  }
  return result.json?.data || null;
}

async function uploadFeishuImage(platform, filePath) {
  const token = await getFeishuTenantToken(platform);
  const buffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath) || 'image.png';
  const boundary = '----HermesFeishu' + Date.now().toString(16);
  const head = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="image_type"',
    '',
    'message',
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="${filename.replace(/"/g, '_')}"`,
    'Content-Type: image/png',
    '',
  ].join('\r\n') + '\r\n');
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buffer, tail]);
  const result = await requestJson('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
    timeoutMs: 30000,
  });
  const imageKey = result.json?.data?.image_key;
  if (!(result.status >= 200 && result.status < 300 && result.json?.code === 0 && imageKey)) {
    throw new Error(result.json?.msg || result.text || '\u98de\u4e66\u56fe\u7247\u4e0a\u4f20\u5931\u8d25 HTTP ' + result.status);
  }
  return imageKey;
}

function parseFeishuEvent(body = {}) {
  if (body.type === 'url_verification' && body.challenge) return { challenge: body.challenge };
  const event = body.event || body;
  const message = event.message || {};
  const contentRaw = message.content || '';
  let content = {};
  try { content = typeof contentRaw === 'string' ? JSON.parse(contentRaw) : contentRaw; } catch (_) {}
  const text = String(content.text || content.content || '').trim();
  const chatId = message.chat_id || event.chat_id || event.open_chat_id || '';
  const openId = event.sender?.sender_id?.open_id || event.sender?.sender_id?.user_id || '';
  return {
    eventId: body.header?.event_id || event.event_id || message.message_id || '',
    messageId: message.message_id || '',
    chatId,
    openId,
    receiveId: chatId || openId,
    receiveIdType: chatId ? 'chat_id' : 'open_id',
    text,
  };
}

function extractImagePrompt(text = '') {
  const raw = String(text || '').trim();
  const match = raw.match(/^(?:\/image|\/img|\u751f\u56fe|\u751f\u6210\u56fe\u7247|\u753b\u56fe|\u753b\u4e00\u5f20|\u751f\u6210\u56fe\u50cf)[:：\s]*(.+)$/i);
  if (match) return match[1].trim();
  if (/\u751f\u6210.*\u56fe|\u753b.*\u56fe|\u56fe\u7247/.test(raw)) return raw;
  return '';
}

async function testFeishu(platform) {
  try {
    await getFeishuTenantToken(platform);
    return { ok: true, msg: '\u98de\u4e66\u8fde\u63a5\u6210\u529f' };
  } catch (error) {
    return { ok: false, msg: '\u98de\u4e66\u8fde\u63a5\u5931\u8d25\uff1a' + error.message };
  }
}

async function testPlatform(platform) {
  if (!platform) return { ok: false, msg: '频道不存在' };
  if (!isConfigured(platform)) return { ok: false, msg: '必填配置不完整' };
  if (platform.id === 'feishu') return testFeishu(platform);
  return { ok: true, msg: '已保存配置；该频道暂未实现在线校验' };
}

router.get('/', (req, res) => res.ok(load()));
router.put('/', (req, res) => {
  const merged = saveGateway({ ...load(), ...req.body });
  res.ok(merged);
});

router.post('/:id/test', async (req, res) => {
  try {
    const data = load();
    const platform = data.platforms.find(p => p.id === req.params.id);
    if (!platform) return res.fail('频道不存在', 404, 404);
    if (req.body?.config && typeof req.body.config === 'object') platform.config = req.body.config;
    if (typeof req.body?.enabled === 'boolean') platform.enabled = req.body.enabled;
    platform.configured = isConfigured(platform);

    const result = await testPlatform(platform);
    platform.connected = !!result.ok;
    platform.statusMsg = result.msg;
    platform.checkedAt = Date.now();
    if (platform.id === 'feishu') {
      platform.enabled = platform.configured && !!result.ok;
    } else {
      platform.enabled = !!platform.enabled && platform.configured;
    }
    saveGateway(data);
    if (platform.id === 'feishu' && platform.enabled && platform.connected) {
      try {
        const streamStatus = await feishuStream.startFromConfig({ force: true });
        platform.streamConnected = !!streamStatus.connected;
        platform.streamStatusMsg = streamStatus.msg || '';
        platform.statusMsg = streamStatus.connected ? '\u98de\u4e66\u957f\u8fde\u63a5\u5df2\u8fde\u63a5' : platform.statusMsg;
        saveGateway(data);
      } catch (streamError) {
        platform.streamConnected = false;
        platform.streamStatusMsg = streamError.message || '\u957f\u8fde\u63a5\u542f\u52a8\u5931\u8d25';
        platform.statusMsg = '\u98de\u4e66\u51ed\u8bc1\u6709\u6548\uff0c\u4f46\u957f\u8fde\u63a5\u542f\u52a8\u5931\u8d25\uff1a' + platform.streamStatusMsg;
        saveGateway(data);
      }
    }
    res.ok({ ...result, platform, stream: feishuStream.getStatus() });
  } catch (error) {
    res.fail(error.message || '连接测试失败', 1, 500);
  }
});

function markFeishuEvent(eventId = '') {
  const id = String(eventId || '').trim();
  if (!id) return true;
  const now = Date.now();
  for (const [key, ts] of feishuHandledEvents) {
    if (now - ts > FEISHU_EVENT_TTL_MS) feishuHandledEvents.delete(key);
  }
  if (feishuHandledEvents.has(id)) return false;
  feishuHandledEvents.set(id, now);
  return true;
}
router.get('/feishu/status', (req, res) => res.ok(feishuStream.getStatus()));

router.post('/feishu/webhook', async (req, res) => {
  const parsed = parseFeishuEvent(req.body || {});
  if (parsed.challenge) return res.json({ challenge: parsed.challenge });
  console.log('[gateway:feishu] event received', { eventId: parsed.eventId, messageId: parsed.messageId, receiveId: parsed.receiveId, receiveIdType: parsed.receiveIdType, text: parsed.text });
  if (!markFeishuEvent(parsed.eventId || parsed.messageId)) return res.ok({ duplicate: true });
  res.ok({ received: true });

  setImmediate(async () => {
    try {
      const data = load();
      const platform = data.platforms.find(p => p.id === 'feishu');
      if (!data.enabled || !platform?.enabled || !platform?.connected) { console.warn('[gateway:feishu] ignored: platform not enabled/connected', { gatewayEnabled: data.enabled, platformEnabled: platform?.enabled, connected: platform?.connected }); return; }
      if (platform.config?.verificationToken && req.body?.header?.token && req.body.header.token !== platform.config.verificationToken) { console.warn('[gateway:feishu] ignored: token mismatch'); return; }
      if (!parsed.receiveId || !parsed.text) { console.warn('[gateway:feishu] ignored: missing receiveId/text', parsed); return; }

      const prompt = extractImagePrompt(parsed.text);
      if (!prompt) { await sendFeishuMessage(platform, parsed.receiveId, parsed.receiveIdType, feishuTextMessage('????????????? / ???? / ???????????????')); return; }
      console.log('[gateway:feishu] image prompt accepted', { prompt, receiveId: parsed.receiveId, receiveIdType: parsed.receiveIdType });
      await sendFeishuMessage(platform, parsed.receiveId, parsed.receiveIdType, feishuTextMessage('\u6536\u5230\uff0c\u6b63\u5728\u672c\u5730\u751f\u6210\u56fe\u7247\uff0c\u8bf7\u7a0d\u7b49...'));
      const result = await generateImageFromPrompt({
        prompt,
        sourcePrompt: parsed.text,
        optimizedByAgent: false,
        model: 'auto',
        source: 'feishu',
        publicBase: '',
      });
      const outputs = result.outputs || [];
      if (!outputs.length) throw new Error('\u6ca1\u6709\u751f\u6210\u56fe\u7247');
      for (const output of outputs) {
        const imageKey = await uploadFeishuImage(platform, output.path);
        await sendFeishuMessage(platform, parsed.receiveId, parsed.receiveIdType, feishuImageMessage(imageKey));
      }
      await sendFeishuMessage(platform, parsed.receiveId, parsed.receiveIdType, feishuTextMessage('\u56fe\u7247\u5df2\u751f\u6210\u5e76\u53d1\u9001\u3002'));
    } catch (error) {
      try {
        const platform = load().platforms.find(p => p.id === 'feishu');
        if (platform && parsed.receiveId) await sendFeishuMessage(platform, parsed.receiveId, parsed.receiveIdType, feishuTextMessage('\u56fe\u7247\u751f\u6210\u5931\u8d25\uff1a' + error.message));
      } catch (_) {}
      console.warn('[gateway:feishu] image flow failed:', error.message);
    }
  });
});

module.exports = router;


