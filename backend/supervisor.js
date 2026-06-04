const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'logs');
const pidFile = path.join(root, '.hermes-server.pid');
const port = process.env.WEBUI_PORT || process.env.HERMES_WEBUI_PORT || '3381';
const maxRestarts = Number(process.env.WEBUI_MAX_RESTARTS || 20);
const restartDelayMs = Number(process.env.WEBUI_RESTART_DELAY_MS || 1500);

fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));

let restarts = 0;
let child = null;
let stopping = false;

function log(message) {
  const line = `[supervisor] ${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(path.join(logDir, 'supervisor.log'), line);
  process.stdout.write(line);
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

  const out = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });
  const err = fs.createWriteStream(path.join(logDir, 'server.err.log'), { flags: 'a' });
  child.stdout.pipe(out);
  child.stderr.pipe(err);

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

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('uncaughtException', (error) => {
  log(`uncaughtException ${error && error.stack ? error.stack : error}`);
});
process.on('unhandledRejection', (reason) => {
  log(`unhandledRejection ${reason && reason.stack ? reason.stack : reason}`);
});

startServer();
