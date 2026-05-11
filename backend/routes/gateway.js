const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'gateway';
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

function normalize(data) {
  const oldPlatforms = Array.isArray(data?.platforms) ? data.platforms : [];
  const byKey = new Map(oldPlatforms.map(p => [p.id || String(p.name || '').toLowerCase(), p]));
  return {
    enabled: data?.enabled ?? DEFAULTS.enabled,
    platforms: DEFAULTS.platforms.map(def => {
      const old = byKey.get(def.id) || byKey.get(def.name.toLowerCase()) || {};
      const config = old.config || {};
      const configured = Object.values(config).some(Boolean) || old.configured === true;
      return { ...def, ...old, id: def.id, name: def.name, icon: def.icon, desc: def.desc, fields: def.fields, config, configured };
    }),
  };
}
function load() {
  const data = normalize(store.read(KEY, null));
  store.write(KEY, data);
  return data;
}

router.get('/', (req, res) => res.ok(load()));
router.put('/', (req, res) => {
  const merged = normalize({ ...load(), ...req.body });
  store.write(KEY, merged);
  res.ok(merged);
});

module.exports = router;
