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
const gatewayRoutes = require('./routes/gateway');
const agentRoutes = require('./routes/agent');
const cronRoutes = require('./routes/cron');
const usageRoutes = require('./routes/usage');
const systemRoutes = require('./routes/system');
const cliRoutes = require('./routes/cli');
const modalRoutes = require('./routes/modal');
const memoryRoutes = require('./routes/memory');
const imageRoutes = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '30mb' }));

// Unified response helper
app.use((req, res, next) => {
  res.ok = (data = null) => res.json({ code: 0, data, msg: 'ok' });
  res.fail = (msg = 'error', code = 1, status = 400) =>
    res.status(status).json({ code, data: null, msg });
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.get('/api/health', (req, res) => res.ok({
  uptime: process.uptime(),
  cwd: process.cwd(),
  entry: __filename,
}));

app.use('/api/chats', chatRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/cli', cliRoutes);
app.use('/api/sse', modalRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/images', imageRoutes);

// Protect sensitive directories
app.use((req, res, next) => {
  const denied = ['/backend/data/', '/.git/', '/node_modules/', '/logs/', '/.claude/'];
  if (denied.some(d => req.path.startsWith(d))) {
    return res.status(403).json({ code: 403, msg: 'forbidden' });
  }
  next();
});

// Serve latest root-level UI (index.html + app-new.js)
app.use('/', express.static(path.join(__dirname, '..')));
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.fail(err.message || 'internal error', 500, 500);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hermes] backend listening on http://0.0.0.0:${PORT}`);
});
