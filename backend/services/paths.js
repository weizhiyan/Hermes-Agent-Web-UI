const fs = require('fs');
const path = require('path');
const store = require('./store');

const DEFAULT_EXTERNAL_ROOT = path.resolve(process.env.HERMES_DATA_ROOT || store.DATA_DIR);

function cleanPath(value = '') {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function resolveConfiguredPath(value, fallback) {
  const raw = cleanPath(value);
  return path.resolve(raw || fallback);
}

function settings() {
  return store.read('settings', {}) || {};
}

function dataRoot() {
  const cfg = settings();
  return resolveConfiguredPath(cfg.dataRootDir || process.env.HERMES_DATA_ROOT, DEFAULT_EXTERNAL_ROOT);
}

function memoryRoot() {
  const cfg = settings();
  return resolveConfiguredPath(cfg.memoryDir || process.env.HERMES_MEMORY_DIR, path.join(dataRoot(), 'memory'));
}

function coreMemoryDir() {
  return path.join(memoryRoot(), 'core');
}

function historyDir() {
  const cfg = settings();
  return resolveConfiguredPath(cfg.historyDir || process.env.HERMES_HISTORY_DIR, path.join(dataRoot(), 'history-md'));
}

function imageRoot() {
  const cfg = settings();
  return resolveConfiguredPath(cfg.imageDir || process.env.HERMES_IMAGE_DIR, path.join(dataRoot(), 'images'));
}

function imageInputDir() {
  return path.join(imageRoot(), 'inputs');
}

function imageOutputDir() {
  return path.join(imageRoot(), 'outputs');
}

function mdLibraryRoot() {
  const cfg = settings();
  return resolveConfiguredPath(cfg.mdLibraryDir || process.env.HERMES_MD_LIBRARY_DIR, path.join(dataRoot(), 'output-md'));
}

function safeAgentId(value = 'default') {
  const clean = String(value || 'default').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return clean || 'default';
}

function agentsRoot() {
  return path.join(dataRoot(), 'agents');
}

function agentRoot(agentId = 'default') {
  return path.join(agentsRoot(), safeAgentId(agentId));
}

function agentSoulDir(agentId = 'default') {
  return path.join(agentRoot(agentId), 'soul');
}

function agentMemoryDir(agentId = 'default') {
  return path.join(agentRoot(agentId), 'memory');
}

function agentWorkspaceDir(agentId = 'default') {
  return path.join(agentRoot(agentId), 'workspace');
}

function agentKnowledgeDir(agentId = 'default') {
  return path.join(agentRoot(agentId), 'knowledge');
}

function ensureAgentDirs(agentId = 'default') {
  [agentRoot(agentId), agentSoulDir(agentId), agentMemoryDir(agentId), agentWorkspaceDir(agentId), agentKnowledgeDir(agentId)].forEach(ensureDir);
  return {
    root: agentRoot(agentId),
    soulDir: agentSoulDir(agentId),
    memoryDir: agentMemoryDir(agentId),
    workspaceDir: agentWorkspaceDir(agentId),
    knowledgeDir: agentKnowledgeDir(agentId),
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureWorkspaceDirs() {
  [
    dataRoot(),
    memoryRoot(),
    coreMemoryDir(),
    historyDir(),
    imageRoot(),
    imageInputDir(),
    imageOutputDir(),
    mdLibraryRoot(),
    agentsRoot(),
  ].forEach(ensureDir);
}

function roots() {
  return [
    store.DATA_DIR,
    dataRoot(),
    memoryRoot(),
    historyDir(),
    imageRoot(),
    mdLibraryRoot(),
  ].map(item => path.resolve(item));
}

module.exports = {
  DEFAULT_EXTERNAL_ROOT,
  dataRoot,
  memoryRoot,
  coreMemoryDir,
  historyDir,
  imageRoot,
  imageInputDir,
  imageOutputDir,
  mdLibraryRoot,
  safeAgentId,
  agentsRoot,
  agentRoot,
  agentSoulDir,
  agentMemoryDir,
  agentWorkspaceDir,
  agentKnowledgeDir,
  ensureAgentDirs,
  ensureDir,
  ensureWorkspaceDirs,
  roots,
};
