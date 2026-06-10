/**
 * Hermes Python Bridge - Node.js side (simplified)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BRIDGE_SCRIPT = path.join(__dirname, 'hermes-python-bridge.py');
const PYTHON = 'python';

let bridgeProcess = null;
let lineBuffer = '';
let callbacks = {};

function ensureBridge() {
  return new Promise((resolve, reject) => {
    if (bridgeProcess) {
      callbacks = {};
      return resolve();
    }

    if (!fs.existsSync(BRIDGE_SCRIPT)) {
      return reject(new Error('Bridge not found: ' + BRIDGE_SCRIPT));
    }

    bridgeProcess = spawn(PYTHON, [BRIDGE_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    bridgeProcess.stdout.on('data', (chunk) => {
      lineBuffer += chunk.toString();
      let idx;
      while ((idx = lineBuffer.indexOf('\n')) !== -1) {
        const line = lineBuffer.slice(0, idx).trim();
        lineBuffer = lineBuffer.slice(idx + 1);
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          const t = event.type;
          if (callbacks[t]) callbacks[t](event);
          if (callbacks['*']) callbacks['*'](t, event);
        } catch (e) {
          console.log('[bridge:stdout:raw] ' + line.slice(0, 80));
        }
      }
    });

    bridgeProcess.stderr.on('data', (chunk) => {
      if (callbacks._stderr) callbacks._stderr(chunk.toString());
    });

    bridgeProcess.on('exit', (code) => {
      bridgeProcess = null;
      if (callbacks._exit) callbacks._exit(code);
    });

    bridgeProcess.on('error', (err) => {
      bridgeProcess = null;
      if (callbacks._error) callbacks._error(err.message);
    });

    resolve();
  });
}

function sendChat(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureBridge();
    } catch (e) {
      return reject(e);
    }

    // Register callbacks
    console.log('[bridge:sendChat] registering callbacks for: ' + opts.message.slice(0,40));
    callbacks = {};
    if (opts.onToolStart)       callbacks['tool:start']    = opts.onToolStart;
    if (opts.onToolOutput)      callbacks['tool:output']    = opts.onToolOutput;
    if (opts.onToolComplete)    callbacks['tool:complete']  = opts.onToolComplete;
    if (opts.onText)            callbacks['text']           = opts.onText;
    if (opts.onThinking)        callbacks['thinking']       = opts.onThinking;
    if (opts.onError)           callbacks['error']          = opts.onError;
    
    callbacks['done'] = (event) => {
      callbacks = {};
      resolve(event);
    };
    
    // Timeout
    const timeout = setTimeout(() => {
      callbacks = {};
      reject(new Error('Chat timeout'));
    }, opts.timeout || 30 * 60 * 1000);

    // Override done for cleanup
    const origDone = callbacks['done'];
    callbacks['done'] = (event) => {
      clearTimeout(timeout);
      origDone(event);
    };

    // Send
    const cmd = JSON.stringify({ action: 'chat', message: opts.message, session_id: opts.session_id || '' });
    bridgeProcess.stdin.write(cmd + '\n');
  });
}

function stopChat() {
  if (bridgeProcess) {
    bridgeProcess.stdin.write(JSON.stringify({ action: 'stop' }) + '\n');
  }
}

function killBridge() {
  callbacks = {};
  if (bridgeProcess) {
    try { bridgeProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n'); } catch (_) {}
    bridgeProcess.kill();
    bridgeProcess = null;
  }
}

module.exports = { ensureBridge, sendChat, stopChat, killBridge };
