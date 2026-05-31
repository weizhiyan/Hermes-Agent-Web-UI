/**
 * Knowledge Graph SQLite database service.
 * Manages knowledge nodes, relations, and graph queries.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const paths = require('./paths');

let db = null;

function getDbPath() {
  return path.join(paths.dataRoot(), 'knowledge.db');
}

function getDb() {
  if (db) return db;
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      category TEXT DEFAULT '临时',
      quality TEXT DEFAULT 'gray',
      quality_reason TEXT,
      tags TEXT DEFAULT '[]',
      md_path TEXT,
      source TEXT DEFAULT 'manual',
      chat_id TEXT,
      prompt_text TEXT,
      context_reply TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS node_relations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT DEFAULT 'related',
      strength REAL DEFAULT 0.5,
      created_at INTEGER,
      FOREIGN KEY (source_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_nodes_category ON knowledge_nodes(category);
    CREATE INDEX IF NOT EXISTS idx_nodes_quality ON knowledge_nodes(quality);
    CREATE INDEX IF NOT EXISTS idx_nodes_updated ON knowledge_nodes(updated_at);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON node_relations(source_id);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON node_relations(target_id);
  `);
  // Migration: add new columns if they don't exist (for existing databases)
  const columns = database.prepare("PRAGMA table_info(knowledge_nodes)").all().map(c => c.name);
  if (!columns.includes('prompt_text')) {
    database.exec("ALTER TABLE knowledge_nodes ADD COLUMN prompt_text TEXT");
  }
  if (!columns.includes('context_reply')) {
    database.exec("ALTER TABLE knowledge_nodes ADD COLUMN context_reply TEXT");
  }
  if (!columns.includes('frequency')) {
    database.exec("ALTER TABLE knowledge_nodes ADD COLUMN frequency INTEGER DEFAULT 1");
  }
}

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

// --- Node CRUD ---

function createNode({ title, summary, category, quality, quality_reason, tags, md_path, source, chat_id, prompt_text, context_reply, frequency }) {
  const database = getDb();
  const id = uuid();
  const ts = now();
  database.prepare(`
    INSERT INTO knowledge_nodes (id, title, summary, category, quality, quality_reason, tags, md_path, source, chat_id, prompt_text, context_reply, created_at, updated_at, frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, summary || null, category || '临时', quality || 'gray', quality_reason || null, JSON.stringify(tags || []), md_path || null, source || 'manual', chat_id || null, prompt_text || null, context_reply || null, ts, ts, Number(frequency) || 1);
  return getNode(id);
}

function getNode(id) {
  const database = getDb();
  const row = database.prepare('SELECT * FROM knowledge_nodes WHERE id = ?').get(id);
  if (row) row.tags = parseTags(row.tags);
  return row || null;
}

function appendNodeFilters(sql, params, { category, quality, search, start, end } = {}) {
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (quality) { sql += ' AND quality = ?'; params.push(quality); }
  if (search) {
    sql += ' AND (title LIKE ? OR summary LIKE ? OR prompt_text LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (start) { sql += ' AND created_at >= ?'; params.push(Number(start)); }
  if (end) { sql += ' AND created_at <= ?'; params.push(Number(end)); }
  return sql;
}

function listNodes({ category, quality, search, limit, offset, start, end } = {}) {
  const database = getDb();
  const params = [];
  let sql = appendNodeFilters('SELECT * FROM knowledge_nodes WHERE 1=1', params, { category, quality, search, start, end });
  sql += ' ORDER BY updated_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(limit); }
  if (offset) { sql += ' OFFSET ?'; params.push(offset); }
  const rows = database.prepare(sql).all(...params);
  rows.forEach(r => { r.tags = parseTags(r.tags); });
  return rows;
}

function updateNode(id, updates) {
  const database = getDb();
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    if (['title', 'summary', 'category', 'quality', 'quality_reason', 'md_path', 'source', 'chat_id', 'prompt_text', 'context_reply', 'frequency'].includes(key)) {
      fields.push(`${key} = ?`);
      params.push(value);
    } else if (key === 'tags') {
      fields.push('tags = ?');
      params.push(JSON.stringify(value));
    }
  }
  if (!fields.length) return getNode(id);
  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);
  database.prepare(`UPDATE knowledge_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getNode(id);
}

function deleteNode(id) {
  const database = getDb();
  database.prepare('DELETE FROM node_relations WHERE source_id = ? OR target_id = ?').run(id, id);
  database.prepare('DELETE FROM knowledge_nodes WHERE id = ?').run(id);
  return true;
}

function countNodes({ category, quality, search, start, end } = {}) {
  const database = getDb();
  const params = [];
  const sql = appendNodeFilters('SELECT COUNT(*) as count FROM knowledge_nodes WHERE 1=1', params, { category, quality, search, start, end });
  return database.prepare(sql).get(...params).count;
}

// --- Relation CRUD ---

function createRelation({ source_id, target_id, relation_type, strength }) {
  const database = getDb();
  const id = uuid();
  database.prepare(`
    INSERT INTO node_relations (id, source_id, target_id, relation_type, strength, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, source_id, target_id, relation_type || 'related', strength || 0.5, now());
  return { id, source_id, target_id, relation_type: relation_type || 'related', strength: strength || 0.5 };
}

function listRelations({ node_id } = {}) {
  const database = getDb();
  if (node_id) {
    return database.prepare('SELECT * FROM node_relations WHERE source_id = ? OR target_id = ?').all(node_id, node_id);
  }
  return database.prepare('SELECT * FROM node_relations').all();
}

function deleteRelation(id) {
  getDb().prepare('DELETE FROM node_relations WHERE id = ?').run(id);
  return true;
}

// --- Graph data (for frontend) ---

function getGraphData({ category, quality, search, start, end } = {}) {
  const database = getDb();
  const nodes = listNodes({ category, quality, search, start, end });
  const nodeIds = new Set(nodes.map(n => n.id));

  let relations;
  if (nodeIds.size === 0) {
    relations = [];
  } else {
    relations = database.prepare('SELECT * FROM node_relations').all();
    relations = relations.filter(r => nodeIds.has(r.source_id) && nodeIds.has(r.target_id));
  }

  // Count relations per node for sizing
  const relCount = {};
  relations.forEach(r => {
    relCount[r.source_id] = (relCount[r.source_id] || 0) + 1;
    relCount[r.target_id] = (relCount[r.target_id] || 0) + 1;
  });

  return {
    nodes: nodes.map(n => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      category: n.category,
      quality: n.quality,
      tags: n.tags,
      md_path: n.md_path,
      source: n.source,
      prompt_text: n.prompt_text,
      chat_id: n.chat_id,
      frequency: n.frequency || 1,
      created_at: n.created_at,
      updated_at: n.updated_at,
      relations: relCount[n.id] || 0,
    })),
    edges: relations.map(r => ({
      id: r.id,
      source: r.source_id,
      target: r.target_id,
      type: r.relation_type,
      strength: r.strength,
    })),
  };
}

// --- Categories stats ---

function getCategoryStats({ start, end } = {}) {
  const database = getDb();
  const params = [];
  const where = appendNodeFilters('WHERE 1=1', params, { start, end });
  const rows = database.prepare(`
    SELECT category, COUNT(*) as count,
           SUM(CASE WHEN quality = 'green' THEN 1 ELSE 0 END) as green,
           SUM(CASE WHEN quality = 'yellow' THEN 1 ELSE 0 END) as yellow,
           SUM(CASE WHEN quality = 'orange' THEN 1 ELSE 0 END) as orange,
           SUM(CASE WHEN quality = 'red' THEN 1 ELSE 0 END) as red,
           SUM(CASE WHEN quality = 'gray' THEN 1 ELSE 0 END) as gray
    FROM knowledge_nodes ${where} GROUP BY category ORDER BY count DESC
  `).all(...params);
  return rows;
}

function getQuestionStats({ start, end } = {}) {
  const database = getDb();
  const params = [];
  const where = appendNodeFilters('WHERE 1=1', params, { start, end });
  const rows = database.prepare(`
    SELECT category, quality, source, created_at, frequency
    FROM knowledge_nodes ${where}
  `).all(...params);
  const categories = {};
  const qualities = {};
  const sources = {};
  const days = {};
  let reusable = 0;
  for (const row of rows) {
    categories[row.category || '???'] = (categories[row.category || '???'] || 0) + 1;
    qualities[row.quality || 'gray'] = (qualities[row.quality || 'gray'] || 0) + 1;
    sources[row.source || 'manual'] = (sources[row.source || 'manual'] || 0) + 1;
    const day = new Date((row.created_at || 0) * 1000).toISOString().slice(0, 10);
    days[day] = (days[day] || 0) + 1;
    if ((row.frequency || 1) > 1) reusable++;
  }
  return {
    total: rows.length,
    reusable,
    categories: Object.entries(categories).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    qualities,
    sources,
    timeline: Object.entries(days).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// --- Import from Markdown files ---

function importFromMdFile({ title, summary, category, tags, md_path, quality }) {
  const database = getDb();
  // Check if already imported
  const existing = database.prepare('SELECT id FROM knowledge_nodes WHERE md_path = ?').get(md_path);
  if (existing) {
    return updateNode(existing.id, { title, summary, category, tags, quality: quality || 'gray' });
  }
  return createNode({ title, summary, category, tags, md_path, quality: quality || 'gray', source: 'import' });
}

function findNodeByPrompt(prompt_text) {
  const database = getDb();
  return database.prepare('SELECT id FROM knowledge_nodes WHERE prompt_text = ?').get(prompt_text) || null;
}

function findNodeByMdPath(md_path) {
  const database = getDb();
  return database.prepare('SELECT id FROM knowledge_nodes WHERE md_path = ?').get(md_path) || null;
}

function incrementFrequency(id) {
  const database = getDb();
  database.prepare('UPDATE knowledge_nodes SET frequency = frequency + 1, updated_at = ? WHERE id = ?').run(now(), id);
}

function getLastChatNode(chat_id) {
  const database = getDb();
  return database.prepare('SELECT id, category FROM knowledge_nodes WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1').get(chat_id) || null;
}

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = {
  getDb,
  createNode,
  getNode,
  listNodes,
  updateNode,
  deleteNode,
  countNodes,
  createRelation,
  listRelations,
  deleteRelation,
  getGraphData,
  getCategoryStats,
  getQuestionStats,
  importFromMdFile,
  findNodeByPrompt,
  findNodeByMdPath,
  incrementFrequency,
  getLastChatNode,
  close,
};
