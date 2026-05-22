const express = require('express');
const store = require('../services/store');

const router = express.Router();

function estimateTokens(content) {
  return Math.ceil(String(content || '').length / 3);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function labelForDate(key) {
  const [, m, d] = key.split('-');
  return `${m}/${d}`;
}

function resolveRange(query) {
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const range = String(query.range || '30d');
  if (range === 'today' || range === '1d') {
    return { range: 'today', start: todayStart, end: Date.now(), days: 1 };
  }
  if (range === '7d') {
    return { range: '7d', start: todayStart - 6 * 86400000, end: Date.now(), days: 7 };
  }
  if (range === 'custom' && query.start && query.end) {
    const start = startOfDay(new Date(query.start)).getTime();
    const end = startOfDay(new Date(query.end)).getTime() + 86400000 - 1;
    const days = Math.max(1, Math.min(120, Math.ceil((end - start + 1) / 86400000)));
    return { range: 'custom', start, end, days };
  }
  return { range: '30d', start: todayStart - 29 * 86400000, end: Date.now(), days: 30 };
}

function blankBucket(ts) {
  const key = dateKey(ts);
  return { date: key, label: labelForDate(key), tokens: 0, messages: 0, sessions: 0 };
}

router.get('/', (req, res) => {
  const chats = store.read('chats', []);
  const { range, start, end, days } = resolveRange(req.query || {});
  const today = new Date().toDateString();
  let totalTokens = 0;
  let todayTokens = 0;
  let rangeTokens = 0;
  let totalMessages = 0;
  let todayMessages = 0;
  let rangeMessages = 0;
  let rangeSessions = 0;
  const models = {};
  const sources = {};
  const dailyMap = new Map();

  for (let i = 0; i < days; i++) {
    const ts = start + i * 86400000;
    const bucket = blankBucket(ts);
    dailyMap.set(bucket.date, bucket);
  }

  chats.forEach(chat => {
    const model = chat.model || 'default';
    const source = chat.source || 'WebUI';
    let sessionTouched = false;
    if (!models[model]) models[model] = { tokens: 0, messages: 0, sessions: 0, cost: 0 };
    if (!sources[source]) sources[source] = { tokens: 0, messages: 0, sessions: 0 };
    (chat.messages || []).forEach(msg => {
      const ts = msg.ts || chat.updatedAt || chat.createdAt || Date.now();
      const tokens = estimateTokens(msg.content);
      totalTokens += tokens;
      totalMessages += 1;
      models[model].tokens += tokens;
      models[model].messages += 1;
      sources[source].tokens += tokens;
      sources[source].messages += 1;
      if (new Date(ts).toDateString() === today) {
        todayTokens += tokens;
        todayMessages += 1;
      }
      if (ts >= start && ts <= end) {
        rangeTokens += tokens;
        rangeMessages += 1;
        sessionTouched = true;
        const bucket = dailyMap.get(dateKey(ts));
        if (bucket) {
          bucket.tokens += tokens;
          bucket.messages += 1;
        }
      }
    });
    if (sessionTouched) {
      rangeSessions += 1;
      const key = dateKey(chat.updatedAt || chat.createdAt || Date.now());
      const bucket = dailyMap.get(key);
      if (bucket) bucket.sessions += 1;
    }
    models[model].sessions += 1;
    sources[source].sessions += 1;
  });

  for (const model of Object.values(models)) model.cost = Number((model.tokens * 0.000003).toFixed(4));
  res.ok({
    range,
    start,
    end,
    todayTokens,
    todayMessages,
    rangeTokens,
    rangeMessages,
    rangeSessions,
    totalTokens,
    totalMessages,
    totalSessions: chats.length,
    daily: [...dailyMap.values()],
    models,
    sources,
  });
});
module.exports = router;
