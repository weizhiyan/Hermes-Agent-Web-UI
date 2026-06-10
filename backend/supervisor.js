const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'logs');
const pidFile = path.join(root, '.hermes-server.pid');
const port = process.env.WEBUI_PORT || process.env.HERMES_WEBUI_PORT || '3381';
const maxRestarts = Number(process.env.WEBUI_MAX_RESTARTS || 20);
const restartDelayMs = Number(process.env.WEBUI_RESTART_DELAY_MS || 1500);
const openBrowser = process.env.WEBUI_OPEN_BROWSER !== '0';
const url = `http://127.0.0.1:${port}/`;
const LOG_MAX_BYTES = Math.max(1024 * 1024, Number(process.env.WEBUI_LOG_MAX_BYTES || 10 * 1024 * 1024));
const LOG_ARCHIVE_KEEP = Math.max(1, Number(process.env.WEBUI_LOG_ARCHIVE_KEEP || 5));

fs.mkdirSync(logDir, { recursive: true });

function logStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function rotateLogFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < LOG_MAX_BYTES) return;
    const parsed = path.parse(filePath);
    const archive = path.join(parsed.dir, `${parsed.name}.${logStamp()}${parsed.ext}`);
    fs.renameSync(filePath, archive);
    const escapedName = parsed.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedExt = parsed.ext.replace('.', '\\.');
    const pattern = new RegExp('^' + escapedName + '\\.[0-9T-]+Z?' + escapedExt + '$');
    const archives = fs.readdirSync(parsed.dir)
      .filter(name => pattern.test(name))
      .map(name => ({ path: path.join(parsed.dir, name), mtime: fs.statSync(path.join(parsed.dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    archives.slice(LOG_ARCHIVE_KEEP).forEach(item => {
      try { fs.unlinkSync(item.path); } catch (_) {}
    });
  } catch (error) {
    process.stderr.write(`[supervisor] log rotate failed ${filePath}: ${error.message}\n`);
  }
}

function rotateKnownLogs() {
  ['supervisor.log', 'supervisor.err.log', 'supervisor.out.log', 'server.log', 'server.err.log'].forEach(name => rotateLogFile(path.join(logDir, name)));
}

rotateKnownLogs();
fs.writeFileSync(pidFile, String(process.pid));

let restarts = 0;
let child = null;
let stopping = false;
let browserOpened = false;

function log(message) {
  const line = `[supervisor] ${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(path.join(logDir, 'supervisor.log'), line);
  process.stdout.write(line);
}


function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${url}api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function openBrowserWhenReady() {
  if (!openBrowser || browserOpened) return;
  for (let i = 0; i < 60 && !stopping; i += 1) {
    if (await checkHealth()) {
      browserOpened = true;
      log(`ready ${url}`);
      const opener = spawn('explorer.exe', [url], {
        cwd: root,
        stdio: 'ignore',
        windowsHide: true,
        detached: true,
      });
      opener.unref();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  log(`health check timed out ${url}`);
}

function startServer() {
  const env = {
    ...process.env,
    WEBUI_PORT: port,
  };
  delete env.PORT;

  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  log(`started backend pid=${child.pid} port=${port}`);

  rotateLogFile(path.join(logDir, 'server.log'));
  rotateLogFile(path.join(logDir, 'server.err.log'));
  const out = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });
  const err = fs.createWriteStream(path.join(logDir, 'server.err.log'), { flags: 'a' });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));

  openBrowserWhenReady().catch(error => log(`openBrowser error ${error && error.stack ? error.stack : error}`));

  child.on('exit', (code, signal) => {
    out.end();
    err.end();
    log(`backend exited code=${code} signal=${signal || ''}`);
    child = null;
    if (stopping) return;
    if (restarts >= maxRestarts) {
      log(`max restarts reached (${maxRestarts}); supervisor exiting`);
      process.exitCode = 1;
      return;
    }
    restarts += 1;
    setTimeout(startServer, restartDelayMs);
  });
}

function stop() {
  stopping = true;
  if (child && !child.killed) child.kill();
  try { fs.unlinkSync(pidFile); } catch (_) {}
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', () => {
  log('SIGINT received, stopping...');
  stop();
});
process.on('SIGTERM', stop);
process.on('uncaughtException', (error) => {
  log(`uncaughtException ${error && error.stack ? error.stack : error}`);
});
process.on('unhandledRejection', (reason) => {
  log(`unhandledRejection ${reason && reason.stack ? reason.stack : reason}`);
});

startServer();
