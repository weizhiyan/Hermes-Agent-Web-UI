#!/usr/bin/env node
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod/v4');
const fs = require('fs');
const path = require('path');

process.chdir(path.join(__dirname, '..'));

const paths = require('../services/paths');
const {
  DOC_FOLDERS,
  parseFrontmatter,
  stripFrontmatter,
  summarizeMarkdown,
  normalizeTags,
  normalizeDocFolder,
  safeFilePart,
  saveKnowledgeMarkdown,
  ensureMarkdownFrontmatter,
} = require('../services/knowledgeCapture');

const ALLOWED_FOLDERS = ['输出文档', '临时收件箱'];
const MAX_READ_BYTES = Math.max(1024 * 1024, Number(process.env.WEBUI_KNOWLEDGE_MCP_MAX_READ_BYTES || 8 * 1024 * 1024));
const MAX_WRITE_BYTES = Math.max(1024 * 1024, Number(process.env.WEBUI_KNOWLEDGE_MCP_MAX_WRITE_BYTES || 8 * 1024 * 1024));

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: true, data }, null, 2) }] };
}

function fail(error) {
  const message = error && error.message ? error.message : String(error || 'unknown error');
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }, null, 2) }], isError: true };
}

function withErrorHandling(fn) {
  return async (args) => {
    try {
      return ok(await fn(args || {}));
    } catch (error) {
      return fail(error);
    }
  };
}

function rootDir() {
  const root = paths.mdLibraryRoot();
  fs.mkdirSync(root, { recursive: true });
  for (const folder of ALLOWED_FOLDERS) fs.mkdirSync(path.join(root, folder), { recursive: true });
  return root;
}

function normalizeFolder(folder = '临时收件箱') {
  const trimmed = String(folder || '临时收件箱').trim();
  if (ALLOWED_FOLDERS.includes(trimmed)) return trimmed;
  // 兼容别名
  const aliasMap = { output: '输出文档', outputs: '输出文档', docs: '输出文档', inbox: '临时收件箱', draft: '临时收件箱', temp: '临时收件箱' };
  return aliasMap[trimmed.toLowerCase()] || '临时收件箱';
}

function isInside(parent, target) {
  const rel = path.relative(parent, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveDocPath(inputPath = '') {
  const root = path.resolve(rootDir());
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('path required');
  const full = path.resolve(path.isAbsolute(raw) ? raw : path.join(root, raw));
  if (!isInside(root, full)) throw new Error('path outside knowledge library is not allowed');
  if (path.extname(full).toLowerCase() !== '.md') throw new Error('only markdown files are allowed');
  return full;
}

function relativeDocPath(filePath) {
  return path.relative(rootDir(), filePath).replace(/\\/g, '/');
}

function uniqueTargetPath(dir, fileName) {
  const ext = path.extname(fileName) || '.md';
  const base = safeFilePart(path.basename(fileName, ext), '未命名文档');
  let target = path.join(dir, base + ext);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(dir, `${base}-${index}${ext}`);
    index += 1;
  }
  return target;
}

function readMarkdown(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('not a file');
  if (stat.size > MAX_READ_BYTES) throw new Error(`file too large (max ${MAX_READ_BYTES} bytes)`);
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function writeMarkdown(filePath, content) {
  const text = String(content || '');
  if (Buffer.byteLength(text, 'utf8') > MAX_WRITE_BYTES) throw new Error(`content too large (max ${MAX_WRITE_BYTES} bytes)`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, filePath);
}

function markdownMeta(filePath, content = null) {
  const text = content == null ? readMarkdown(filePath) : String(content || '');
  const fm = parseFrontmatter(text);
  const stat = fs.statSync(filePath);
  return {
    title: fm.title || path.basename(filePath, '.md'),
    tags: normalizeTags(fm.tags),
    summary: fm.summary || summarizeMarkdown(text),
    status: fm.status || 'draft',
    source: fm.source || 'agent',
    path: relativeDocPath(filePath),
    fullPath: filePath,
    folder: relativeDocPath(filePath).split('/')[0] || '',
    size: stat.size,
    updated: fm.updated || new Date(stat.mtimeMs).toISOString(),
  };
}

function listMarkdownFiles({ folder = '', tags = [] } = {}) {
  const root = rootDir();
  const wantedFolder = folder ? normalizeFolder(folder) : '';
  const wantedTags = normalizeTags(tags).map(t => t.toLowerCase());
  const folders = wantedFolder ? [wantedFolder] : ALLOWED_FOLDERS;
  const out = [];
  for (const item of folders) {
    const dir = path.join(root, item);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.toLowerCase().endsWith('.md')) continue;
      const filePath = path.join(dir, name);
      try {
        const meta = markdownMeta(filePath);
        const lowerTags = meta.tags.map(t => String(t).toLowerCase());
        if (wantedTags.length && !wantedTags.every(tag => lowerTags.includes(tag))) continue;
        out.push(meta);
      } catch (_) {}
    }
  }
  return out.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
}

function replaceFrontmatter(content, patch = {}) {
  const existing = parseFrontmatter(content);
  const body = stripFrontmatter(content).trimStart();
  const meta = {
    title: patch.title || existing.title || '未命名文档',
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : normalizeTags(existing.tags),
    created: patch.created || existing.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    source: patch.source || existing.source || 'agent',
    status: patch.status || existing.status || 'draft',
    summary: patch.summary || existing.summary || summarizeMarkdown(body),
  };
  return ensureMarkdownFrontmatter(body, meta).content;
}

function ensureTwoFolderLayout() {
  const root = rootDir();
  const legacyDirs = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !ALLOWED_FOLDERS.includes(entry.name))
    .map(entry => path.join(root, entry.name));
  const outputDir = path.join(root, '输出文档');
  const moved = [];
  const skipped = [];
  for (const dir of legacyDirs) {
    for (const name of fs.readdirSync(dir)) {
      const src = path.join(dir, name);
      const stat = fs.statSync(src);
      if (!stat.isFile() || !name.toLowerCase().endsWith('.md')) {
        skipped.push(relativeDocPath(src));
        continue;
      }
      const dest = uniqueTargetPath(outputDir, name);
      fs.renameSync(src, dest);
      moved.push({ from: relativeDocPath(src), to: relativeDocPath(dest) });
    }
    try { fs.rmdirSync(dir); } catch (_) {}
  }
  return { moved, skipped, folders: fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) };
}

const server = new McpServer({ name: 'hermes-webui-knowledge', version: '0.1.0' });

server.registerTool(
  'knowledge_create',
  {
    description: 'Create a self-contained Markdown knowledge document. Content may include Base64 data:image markdown images. The file is written under 临时收件箱 by default or 输出文档 when requested.',
    inputSchema: {
      title: z.string().describe('Document title.'),
      content: z.string().describe('Markdown body. Base64 images are allowed and should be embedded as data:image URLs.'),
      tags: z.array(z.string()).optional().describe('Tags for classification.'),
      folder: z.string().optional().describe('Target folder: 临时收件箱 or 输出文档. Default: 临时收件箱.'),
    },
  },
  withErrorHandling(async ({ title, content, tags = [], folder = '临时收件箱' }) => {
    const result = saveKnowledgeMarkdown(content, { title, tags, folder: normalizeFolder(folder), source: 'agent', status: 'draft' });
    return { ...result, path: relativeDocPath(result.path), fullPath: result.path };
  })
);

server.registerTool(
  'knowledge_search',
  {
    description: 'Search knowledge Markdown documents by keyword, tags, and folder. Returns title, tags, summary, and path.',
    inputSchema: {
      query: z.string().describe('Keyword to search in title, summary, tags, path, and body.'),
      tags: z.array(z.string()).optional().describe('All tags that must be present.'),
      folder: z.string().optional().describe('Optional folder filter: 临时收件箱 or 输出文档.'),
    },
  },
  withErrorHandling(async ({ query = '', tags = [], folder = '' }) => {
    const q = String(query || '').toLowerCase();
    return listMarkdownFiles({ folder, tags }).filter(item => {
      if (!q) return true;
      const content = readMarkdown(resolveDocPath(item.path)).toLowerCase();
      return [item.title, item.summary, item.path, item.tags.join(' '), content].join('\n').toLowerCase().includes(q);
    });
  })
);

server.registerTool(
  'knowledge_read',
  {
    description: 'Read a complete Markdown knowledge document including frontmatter and Base64 embedded images.',
    inputSchema: { path: z.string().describe('Relative or absolute path to a Markdown file under the knowledge library.') },
  },
  withErrorHandling(async ({ path: inputPath }) => {
    const filePath = resolveDocPath(inputPath);
    return { ...markdownMeta(filePath), content: readMarkdown(filePath) };
  })
);

server.registerTool(
  'knowledge_list',
  {
    description: 'List knowledge Markdown documents, optionally filtered by folder and tags.',
    inputSchema: {
      folder: z.string().optional().describe('Optional folder filter: 临时收件箱 or 输出文档.'),
      tags: z.array(z.string()).optional().describe('All tags that must be present.'),
    },
  },
  withErrorHandling(async ({ folder = '', tags = [] }) => listMarkdownFiles({ folder, tags }))
);

server.registerTool(
  'knowledge_edit',
  {
    description: 'Edit a knowledge Markdown document. Modes: replace_all, replace, append.',
    inputSchema: {
      path: z.string().describe('Relative or absolute path to a Markdown file under the knowledge library.'),
      mode: z.enum(['replace_all', 'replace', 'append']).describe('Edit mode.'),
      content: z.string().describe('New content, replacement content, or appended content.'),
      find: z.string().optional().describe('Text to find when mode is replace.'),
    },
  },
  withErrorHandling(async ({ path: inputPath, mode, content, find = '' }) => {
    const filePath = resolveDocPath(inputPath);
    const current = readMarkdown(filePath);
    let next;
    if (mode === 'replace_all') {
      const fm = parseFrontmatter(current);
      next = ensureMarkdownFrontmatter(content, { ...fm, updated: new Date().toISOString() }).content;
    } else if (mode === 'replace') {
      if (!find) throw new Error('find is required for replace mode');
      if (!current.includes(find)) throw new Error('find text not found');
      next = current.replace(find, String(content || ''));
      next = replaceFrontmatter(next, parseFrontmatter(next));
    } else if (mode === 'append') {
      next = current.replace(/\s*$/, '') + '\n\n' + String(content || '').trim() + '\n';
      next = replaceFrontmatter(next, parseFrontmatter(next));
    } else {
      throw new Error('unsupported edit mode');
    }
    writeMarkdown(filePath, next);
    return markdownMeta(filePath, next);
  })
);

server.registerTool(
  'knowledge_update_tags',
  {
    description: 'Update tags in the frontmatter of a knowledge Markdown document.',
    inputSchema: {
      path: z.string().describe('Relative or absolute path to a Markdown file under the knowledge library.'),
      tags: z.array(z.string()).describe('Replacement tag list.'),
    },
  },
  withErrorHandling(async ({ path: inputPath, tags }) => {
    const filePath = resolveDocPath(inputPath);
    const next = replaceFrontmatter(readMarkdown(filePath), { tags });
    writeMarkdown(filePath, next);
    return markdownMeta(filePath, next);
  })
);

server.registerTool(
  'knowledge_move',
  {
    description: 'Move a knowledge Markdown document between 临时收件箱 and 输出文档.',
    inputSchema: {
      path: z.string().describe('Relative or absolute path to a Markdown file under the knowledge library.'),
      target_folder: z.string().describe('Target folder: 临时收件箱 or 输出文档.'),
    },
  },
  withErrorHandling(async ({ path: inputPath, target_folder }) => {
    const filePath = resolveDocPath(inputPath);
    const folder = normalizeFolder(target_folder);
    const dir = path.join(rootDir(), folder);
    fs.mkdirSync(dir, { recursive: true });
    const dest = uniqueTargetPath(dir, path.basename(filePath));
    fs.renameSync(filePath, dest);
    return markdownMeta(dest);
  })
);

if (process.env.WEBUI_KNOWLEDGE_MCP_MIGRATE_LEGACY === '1') {
  try { ensureTwoFolderLayout(); } catch (error) { console.error('[hermes-webui-knowledge-mcp:migrate]', error.message); }
}

server.connect(new StdioServerTransport()).catch((error) => {
  console.error('[hermes-webui-knowledge-mcp]', error);
  process.exit(1);
});
