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
const relayRoutes = require('./routes/relay');
const knowledgeRoutes = require('./routes/knowledge');
const issueRoutes = require('./routes/issues');
const feishuStream = require('./services/feishuStream');
const paths = require('./services/paths');

function loadDotEnvFile(filePath) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn('[hermes] failed to load env file', filePath, error.message);
  }
}

loadDotEnvFile(path.join(__dirname, '..', '.env'));
loadDotEnvFile(path.join(__dirname, '.env'));

const app = express();
const DEFAULT_WEBUI_PORT = 3381;
const PORT = Number(process.env.WEBUI_PORT || process.env.HERMES_WEBUI_PORT || DEFAULT_WEBUI_PORT);
if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error(`Invalid WEBUI_PORT: ${process.env.WEBUI_PORT || process.env.HERMES_WEBUI_PORT}`);
}
if (process.env.PORT && !process.env.WEBUI_PORT && !process.env.HERMES_WEBUI_PORT) {
  console.warn(`[hermes] ignoring generic PORT=${process.env.PORT}; use WEBUI_PORT to change the WebUI port.`);
}

function logProcessError(type, error) {
  const message = error && error.stack ? error.stack : String(error || 'unknown error');
  console.error(`[hermes] ${type}:`, message);
}

process.on('uncaughtException', (error) => {
  logProcessError('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  logProcessError('unhandledRejection', reason);
});

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

app.use('/v1', relayRoutes);

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
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/issues', issueRoutes);

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
// Serve knowledge graph React app
app.use('/knowledge-graph', express.static(path.join(__dirname, '..', 'frontend', 'knowledge-graph', 'dist')));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  if (typeof res.fail === 'function') {
    res.fail(err.message || 'internal error', 500, 500);
    return;
  }
  res.status(500).json({ code: 500, data: null, msg: err.message || 'internal error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  try { paths.ensureWorkspaceDirs(); } catch (error) { console.warn('[hermes] failed to prepare workspace dirs:', error.message); }
  console.log(`[hermes] backend listening on http://0.0.0.0:${PORT}`);
  feishuStream.startFromConfig().catch(error => console.warn('[feishu-stream] startup skipped:', error.message));
});

server.on('error', (error) => {
  logProcessError('serverError', error);
  if (error && error.code === 'EADDRINUSE') {
    console.error(`[hermes] port ${PORT} is already in use.`);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50);
  }
});
