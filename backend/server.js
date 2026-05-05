/**
 * Hermes Agent backend entry.
 * Lightweight Express server exposing REST APIs under /api.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

const chatRoutes = require('./routes/chat');
const skillRoutes = require('./routes/skills');
const modelRoutes = require('./routes/models');
const settingRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Unified response helper
app.use((req, res, next) => {
  res.ok = (data = null) => res.json({ code: 0, data, msg: 'ok' });
  res.fail = (msg = 'error', code = 1, status = 400) =>
    res.status(status).json({ code, data: null, msg });
  next();
});

app.get('/api/health', (req, res) => res.ok({ uptime: process.uptime() }));

app.use('/api/chats', chatRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/settings', settingRoutes);

// Optional: serve frontend statically when deployed together
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.fail(err.message || 'internal error', 500, 500);
});

app.listen(PORT, () => {
  console.log(`[hermes] backend listening on http://127.0.0.1:${PORT}`);
});
