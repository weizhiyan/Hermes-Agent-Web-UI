/**
 * Modal / Notification SSE channel.
 * Exposes:
 *   GET  /api/sse/notify  — persistent SSE connection (frontend)
 *   POST /api/sse/modal   — push modal event to all connected clients (backend/agent)
 *   POST /api/sse/toast   — push toast event to all connected clients (backend/agent)
 */
const express = require('express');
const router = express.Router();

/** @type {Set<import('express').Response>} */
const sseClients = new Set();

// ── Frontend: persistent SSE connection ──────────────────────────
router.get('/notify', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial heartbeat
  res.write('event: connected\ndata: {}\n\n');

  sseClients.add(res);
  console.log(`[modal-sse] client connected (${sseClients.size} total)`);

  // Keep-alive every 30s
  const keepAlive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    console.log(`[modal-sse] client disconnected (${sseClients.size} total)`);
  });
});

// ── Push a modal event ───────────────────────────────────────────
router.post('/modal', (req, res) => {
  const { title, html, width } = req.body;
  if (!html) return res.fail('html is required');

  const eventData = { title: title || '', html, width: width || '520px' };
  let sent = 0;

  for (const client of sseClients) {
    try {
      client.write(`event: modal\ndata: ${JSON.stringify(eventData)}\n\n`);
      sent++;
    } catch {
      sseClients.delete(client);
    }
  }

  res.ok({ sent });
  console.log(`[modal-sse] pushed modal to ${sent} clients: "${(title || html).slice(0, 40)}"`);
});

// ── Push a toast event ───────────────────────────────────────────
router.post('/toast', (req, res) => {
  const { msg, type } = req.body;
  if (!msg) return res.fail('msg is required');

  const eventData = { msg, type: type || 'info' };
  let sent = 0;

  for (const client of sseClients) {
    try {
      client.write(`event: toast\ndata: ${JSON.stringify(eventData)}\n\n`);
      sent++;
    } catch {
      sseClients.delete(client);
    }
  }

  res.ok({ sent });
  console.log(`[modal-sse] pushed toast to ${sent} clients: "${msg.slice(0, 40)}"`);
});

module.exports = router;
module.exports.sseClients = sseClients;
