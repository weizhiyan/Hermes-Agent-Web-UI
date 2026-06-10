const express = require('express');
const {
  getOverview,
  readCoreFile,
  writeCoreFile,
  listAgentMemoryFiles,
  readAgentMemoryFile,
  writeAgentMemoryFile,
  readConversationFile,
} = require('../services/memory');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.ok(getOverview());
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/core/:id', (req, res) => {
  try {
    const item = readCoreFile(req.params.id);
    if (!item) return res.fail('memory file not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.put('/core/:id', (req, res) => {
  try {
    const item = writeCoreFile(req.params.id, req.body.content);
    if (!item) return res.fail('memory file not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/agent/:agentId', (req, res) => {
  try {
    res.ok(listAgentMemoryFiles(req.params.agentId));
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/agent/:agentId/file/:id', (req, res) => {
  try {
    const item = readAgentMemoryFile(req.params.agentId, req.params.id);
    if (!item) return res.fail('agent memory file not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.put('/agent/:agentId/file', (req, res) => {
  try {
    const item = writeAgentMemoryFile(req.params.agentId, req.body.file || 'MEMORY.md', req.body.content);
    if (!item) return res.fail('agent memory file not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.put('/agent/:agentId/file/:id', (req, res) => {
  try {
    const item = writeAgentMemoryFile(req.params.agentId, req.params.id || req.body.file || 'MEMORY.md', req.body.content);
    if (!item) return res.fail('agent memory file not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

router.get('/conversation/:id', (req, res) => {
  try {
    const item = readConversationFile(req.params.id);
    if (!item) return res.fail('conversation memory not found', 404, 404);
    res.ok(item);
  } catch (e) {
    res.fail(e.message, 500, 500);
  }
});

module.exports = router;
