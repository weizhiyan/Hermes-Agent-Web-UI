const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const store = require('../services/store');
const paths = require('../services/paths');
const modalBus = require('./modal');
const { DOC_FOLDERS, LEGACY_DOC_FOLDERS, VAULT_CATEGORIES, stripFrontmatter, parseFrontmatter, firstHeading, summarizeMarkdown, inferMdType, normalizeTags, safeFilePart, normalizeDocFolder, ensureMarkdownFrontmatter, uniqueMarkdownPath, saveKnowledgeMarkdown, captureKnowledge } = require('../services/knowledgeCapture');

const router = express.Router();
const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..'));

function mdLibraryRoot() {
  return paths.mdLibraryRoot();
}

function roots() {
  return [...new Set([
    path.resolve(store.DATA_DIR),
    ...paths.roots(),
    PROJECT_ROOT,
    mdLibraryRoot(),
  ])];
}

function allowed(target) {
  const full = path.resolve(target);
  return roots().some(root => full === root || full.startsWith(root + path.sep));
}

function allowedCommand(cmd) {
  const name = String(cmd || '').trim().toLowerCase();
  return ['node', 'npm', 'npx', 'git', 'powershell', 'pwsh', 'cmd'].includes(name);
}

function appendLog(entry = {}) {
  try {
    const logs = store.read('logs', []);
    logs.push({ ts: Date.now(), source: 'security', ...entry });
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    store.write('logs', logs);
  } catch (_) {}
}

function commandRisk(command, args = []) {
  const full = [command, ...args].join(' ').toLowerCase();
  const dangerous = [
    /\brm\s+-rf\b/,
    /\brmdir\b.*\/s/,
    /\bdel\b.*\/s/,
    /remove-item\b.*(-recurse|-force)/,
    /format\b/,
    /diskpart\b/,
    /shutdown\b/,
    /restart-computer\b/,
    /stop-computer\b/,
    /\breg\s+(delete|add)\b/,
    /set-executionpolicy\b/,
    /invoke-expression|\biex\b/,
    /curl\b.*\|\s*(sh|bash|powershell|pwsh)/,
    /wget\b.*\|\s*(sh|bash|powershell|pwsh)/,
  ];
  if (dangerous.some(re => re.test(full))) return { level: 'blocked', reason: '命中危险命令规则' };
  if (/\b(git\s+push|git\s+clean|git\s+reset\s+--hard|npm\s+publish|docker\s+system\s+prune)\b/.test(full)) return { level: 'risky', reason: '可能修改远程或清理本地数据' };
  return { level: 'safe', reason: '安全命令' };
}


function approvalAccepted(answers) {
  if (!Array.isArray(answers)) return false;
  return answers.some(item => {
    const selected = Array.isArray(item.selected) ? item.selected.join(' ').toLowerCase() : '';
    return selected.includes('approve') || selected.includes('allow') || selected.includes('确认执行') || selected.includes('允许执行');
  });
}

function executeCommandPayload(command, args, cwd, timeoutMs, risk) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGTERM'); } catch (_) {}
    }, Math.max(1000, Math.min(Number(timeoutMs) || 30000, 120000)));
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); if (stdout.length > 60000) stdout = stdout.slice(-60000); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); if (stderr.length > 60000) stderr = stderr.slice(-60000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ command, args, cwd, code, killed, stdout, stderr, durationMs: Date.now() - startedAt, risk });
    });
  });
}

function runGit(args, { timeout = 8000 } = {}) {
  const result = spawnSync('git', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: result.error ? result.error.message : '',
  };
}

function parseAheadBehind(text) {
  const match = String(text || '').match(/^(\d+)\s+(\d+)$/);
  return match ? { ahead: Number(match[1]) || 0, behind: Number(match[2]) || 0 } : { ahead: 0, behind: 0 };
}

function getUpdateStatus({ fetchRemote = false } = {}) {
  const packageVersion = readPackageVersion();
  const isRepo = runGit(['rev-parse', '--is-inside-work-tree']);
  if (!isRepo.ok || isRepo.stdout !== 'true') {
    return {
      isGitRepo: false,
      packageVersion,
      projectRoot: PROJECT_ROOT,
      message: '当前目录不是 Git 克隆项目，无法通过 GitHub 自动检测更新。',
    };
  }
  const fetchResult = fetchRemote ? runGit(['fetch', '--tags', '--prune'], { timeout: 30000 }) : null;
  const branch = runGit(['branch', '--show-current']).stdout || 'detached';
  const localCommit = runGit(['rev-parse', '--short', 'HEAD']).stdout || '';
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remote = runGit(['remote', '-v']).stdout.split(/\r?\n/).find(line => /\(fetch\)$/.test(line)) || '';
  const dirty = runGit(['status', '--porcelain']).stdout;
  let ahead = 0;
  let behind = 0;
  if (upstream.ok && upstream.stdout) {
    const counts = runGit(['rev-list', '--left-right', '--count', 'HEAD...' + upstream.stdout]);
    ({ ahead, behind } = parseAheadBehind(counts.stdout));
  }
  const latestTag = runGit(['describe', '--tags', '--abbrev=0']).stdout || '';
  const currentTag = runGit(['describe', '--tags', '--exact-match', 'HEAD']).stdout || '';
  return {
    isGitRepo: true,
    packageVersion,
    projectRoot: PROJECT_ROOT,
    branch,
    upstream: upstream.ok ? upstream.stdout : '',
    remote,
    localCommit,
    currentTag,
    latestTag,
    ahead,
    behind,
    dirtyCount: dirty ? dirty.split(/\r?\n/).filter(Boolean).length : 0,
    hasLocalChanges: !!dirty,
    fetched: fetchRemote,
    fetchOk: fetchResult ? fetchResult.ok : null,
    fetchError: fetchResult && !fetchResult.ok ? (fetchResult.stderr || fetchResult.error || 'git fetch failed') : '',
    updateCommand: 'git pull --ff-only && npm install',
    safeToPull: behind > 0 && ahead === 0 && !dirty,
  };
}

function readPackageVersion() {
  try {
    const raw = fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8').replace(/^\uFEFF/, '');
    const pkg = JSON.parse(raw);
    return String(pkg.version || 'unknown');
  } catch (_) {
    return 'unknown';
  }
}

function redactBackupSecrets(value) {
  if (Array.isArray(value)) return value.map(redactBackupSecrets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (/key|token|secret|password|authorization/i.test(key)) out[key] = val ? '[REDACTED]' : val;
      else out[key] = redactBackupSecrets(val);
    }
    return out;
  }
  return value;
}

function listBackupFiles(root, limit = 400) {
  const result = [];
  const base = path.resolve(root);
  function walk(dir, depth = 0) {
    if (result.length >= limit || depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (result.length >= limit) break;
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      let stat = null;
      try { stat = fs.statSync(full); } catch { continue; }
      if (entry.isDirectory()) walk(full, depth + 1);
      else result.push({ path: full, relativePath: path.relative(base, full).replace(/\\/g, '/'), size: stat.size, mtime: stat.mtimeMs });
    }
  }
  if (fs.existsSync(base)) walk(base, 0);
  return result;
}

function backupManifest() {
  const settings = store.read('settings', {});
  const rootsToScan = [...new Set([store.DATA_DIR, ...paths.roots(), mdLibraryRoot()].filter(Boolean).map(p => path.resolve(p)))];
  return {
    createdAt: new Date().toISOString(),
    packageVersion: readPackageVersion(),
    projectRoot: PROJECT_ROOT,
    dataDir: store.DATA_DIR,
    roots: rootsToScan,
    settings: redactBackupSecrets(settings),
    models: redactBackupSecrets(store.read('models', {})),
    skills: store.read('skills', []),
    chatsIndex: store.read('chats', []).map(chat => ({ id: chat.id, title: chat.title, ts: chat.ts, updatedAt: chat.updatedAt, messageCount: Array.isArray(chat.messages) ? chat.messages.length : 0 })),
    gateways: redactBackupSecrets(store.read('gateways', [])),
    memories: redactBackupSecrets(store.read('memories', {})),
    files: rootsToScan.map(root => ({ root, files: listBackupFiles(root) })),
    note: 'This backup intentionally redacts API keys/tokens/passwords. File contents are not embedded; file lists and main WebUI config are included.',
  };
}
function safeCommandCwd(cwd) {
  const dir = path.resolve(normalizeIncomingPath(cwd || PROJECT_ROOT));
  return allowed(dir) ? dir : PROJECT_ROOT;
}

function normalizeIncomingPath(target) {
  const text = String(target || '');
  const win = text.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (win && process.platform !== 'win32') {
    return `/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, '/')}`;
  }
  const wsl = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (wsl && process.platform === 'win32') {
    return `${wsl[1].toUpperCase()}:\\${wsl[2].replace(/\//g, '\\')}`;
  }
  return text;
}

function toExplorerPath(target) {
  const text = String(target || '');
  const match = text.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (match) {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`;
  }
  return target;
}

function safeStat(target) {
  try { return fs.statSync(target); } catch { return null; }
}

function itemFor(dir, entry) {
  const full = path.join(dir, entry.name);
  const stat = safeStat(full);
  return {
    name: entry.name,
    path: full,
    type: entry.isDirectory() ? 'folder' : 'file',
    size: entry.isFile() && stat ? stat.size : 0,
    mtime: stat ? stat.mtimeMs : 0,
    ext: entry.isFile() ? path.extname(entry.name).toLowerCase() : '',
  };
}

router.post('/open-path', (req, res) => {
  const target = normalizeIncomingPath(req.body.path);
  if (!target || !allowed(target)) return res.fail('path not allowed', 403, 403);
  const finalTarget = fs.existsSync(target) ? target : path.dirname(target);
  if (!fs.existsSync(finalTarget)) return res.fail('path not found', 404, 404);
  const stat = safeStat(finalTarget);
  const explorerTarget = toExplorerPath(finalTarget);
  const args = stat && stat.isFile() ? ['/select,', explorerTarget] : [explorerTarget];
  spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
  res.ok({ path: finalTarget });
});

router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const logs = store.read('logs', []);
  res.ok(logs.slice(-limit));
});

router.get('/update-status', (req, res) => {
  try {
    res.ok(getUpdateStatus({ fetchRemote: String(req.query.fetch || '') === '1' }));
  } catch (e) {
    res.fail('update status failed: ' + e.message, 500, 500);
  }
});

router.post('/update-apply', (req, res) => {
  try {
    const before = getUpdateStatus({ fetchRemote: true });
    if (!before.isGitRepo) return res.fail('当前目录不是 Git 克隆项目，无法自动更新。', 400, 400);
    if (before.hasLocalChanges) return res.fail('存在本地未提交改动。请先提交或备份后再更新，避免覆盖你的工作。', 409, 409);
    if (before.ahead > 0) return res.fail('本地提交领先远端，不能自动快进更新。请手动处理分支。', 409, 409);
    if (before.behind <= 0) return res.ok({ message: '当前已经是最新状态。', before, after: before, logs: [] });
    const pull = runGit(['pull', '--ff-only'], { timeout: 60000 });
    if (!pull.ok) return res.fail('git pull 失败：' + (pull.stderr || pull.error || pull.stdout || 'unknown error'), 500, 500);
    const install = spawnSync('npm', ['install'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    });
    if (install.status !== 0) return res.fail('npm install 失败：' + (install.stderr || (install.error && install.error.message) || install.stdout || 'unknown error'), 500, 500);
    const after = getUpdateStatus({ fetchRemote: false });
    res.ok({ message: '更新完成，请重启 WebUI。', before, after, logs: [pull.stdout, install.stdout].filter(Boolean) });
  } catch (e) {
    res.fail('apply update failed: ' + e.message, 500, 500);
  }
});

router.post('/backup/export', (req, res) => {
  try {
    const backupsDir = path.join(store.DATA_DIR, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `hermes-webui-backup-${stamp}.json`;
    const target = path.join(backupsDir, fileName);
    const data = backupManifest();
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
    const stat = fs.statSync(target);
    res.ok({ fileName, path: target, size: stat.size, createdAt: data.createdAt, downloadUrl: `/api/system/file-raw?path=${encodeURIComponent(target)}` });
  } catch (e) {
    res.fail('backup failed: ' + e.message, 500, 500);
  }
});

router.post('/logs', (req, res) => {
  const logs = store.read('logs', []);
  const entry = {
    ts: Date.now(),
    level: req.body.level || 'info',
    msg: req.body.msg || '',
    source: req.body.source || 'system',
    type: req.body.type || '',
    route: req.body.route || '',
    reason: req.body.reason || '',
    chatId: req.body.chatId || '',
    title: req.body.title || '',
    durationMs: Number(req.body.durationMs || 0),
    outputChars: Number(req.body.outputChars || 0),
    error: req.body.error || '',
  };
  logs.push(entry);
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  store.write('logs', logs);
  res.ok(entry);
});

router.get('/files', (req, res) => {
  const dir = path.resolve(normalizeIncomingPath(req.query.dir || store.DATA_DIR));
  if (!allowed(dir)) return res.fail('path not allowed', 403, 403);
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => !d.name.startsWith('.'))
      .map(d => itemFor(dir, d))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
    const parent = path.dirname(dir);
    res.ok({
      path: dir,
      parent: parent !== dir && allowed(parent) ? parent : null,
      roots: [
        { id: 'data', label: '数据目录', path: path.resolve(store.DATA_DIR) },
        { id: 'workspace', label: '项目目录', path: PROJECT_ROOT },
        { id: 'data-root', label: 'Hermes 数据目录', path: paths.dataRoot() },
        { id: 'memory', label: '记忆目录', path: paths.memoryRoot() },
        { id: 'images', label: '图片目录', path: paths.imageRoot() },
        { id: 'md', label: 'MD 输出库', path: mdLibraryRoot() },
      ],
      items,
    });
  } catch (e) {
    res.ok({ path: dir, items: [], error: e.message });
  }
});

router.get('/file-content', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.query.path || ''));
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (stat.size > 1024 * 1024) return res.fail('file too large (max 1MB)', 400, 400);
    const content = fs.readFileSync(filePath, 'utf8');
    res.ok({ path: filePath, content, size: stat.size, mtime: stat.mtimeMs, ext: path.extname(filePath).toLowerCase() });
  } catch (e) {
    res.fail('read failed: ' + e.message, 500, 500);
  }
});

router.put('/file-content', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.body?.path || ''));
  const content = String(req.body?.content || '');
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) return res.fail('file too large (max 1MB)', 400, 400);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (path.extname(filePath).toLowerCase() !== '.md') return res.fail('only markdown files can be saved', 400, 400);
    const root = mdLibraryRoot();
    if (!(filePath === root || filePath.startsWith(root + path.sep))) return res.fail('only md library files can be saved', 403, 403);
    fs.writeFileSync(filePath, content, 'utf8');
    const nextStat = fs.statSync(filePath);
    res.ok({ path: filePath, size: nextStat.size, mtime: nextStat.mtimeMs });
  } catch (e) {
    res.fail('save failed: ' + e.message, 500, 500);
  }
});

router.get('/file-raw', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.query.path || ''));
  if (!filePath || !allowed(filePath)) return res.status(403).send('path not allowed');
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.status(400).send('not a file');
    if (stat.size > 30 * 1024 * 1024) return res.status(413).send('file too large');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).send('read failed: ' + e.message);
  }
});

router.post('/execute-command', async (req, res) => {
  const command = String(req.body?.command || '').trim();
  const args = Array.isArray(req.body?.args) ? req.body.args.map(item => String(item)) : [];
  const cwd = safeCommandCwd(req.body?.cwd);
  const settings = store.read('settings', {});
  const toolPermissions = { commandPolicy: 'safe', logApprovals: true, requireApprovalForRisky: true, ...(settings.toolPermissions || {}) };
  if (!command) return res.fail('command required', 400, 400);
  if (!allowedCommand(command)) return res.fail('command not allowed', 403, 403);
  if (args.join('\n').length > 4000) return res.fail('args too long', 400, 400);
  const risk = commandRisk(command, args);
  const commandText = `${command} ${args.join(' ')}`.trim();

  if (toolPermissions.commandPolicy !== 'off' && risk.level === 'blocked') {
    appendLog({ type: 'approval', level: 'warn', msg: `已阻止危险命令：${commandText}`, command, args, cwd, risk: risk.level, reason: risk.reason });
    return res.fail(`命令被安全策略阻止：${risk.reason}`, 403, 403);
  }

  const needsApproval = toolPermissions.commandPolicy !== 'off' && risk.level === 'risky' && toolPermissions.requireApprovalForRisky !== false;
  const strictBlocks = toolPermissions.commandPolicy === 'strict' && risk.level !== 'safe';
  if (needsApproval || strictBlocks) {
    appendLog({ type: 'approval', level: 'warn', msg: `等待用户审批命令：${commandText}`, command, args, cwd, risk: risk.level, reason: risk.reason });
    const approval = await modalBus.createAsk({
      title: '命令执行需要确认',
      message: `即将执行高风险命令，请确认是否允许。\n命令：${commandText}\n目录：${cwd}\n风险：${risk.reason}` ,
      questions: [{
        id: 'approval',
        label: '是否允许执行该命令？',
        type: 'single',
        options: [
          { label: '确认执行', value: 'approve', description: '我了解风险，允许 WebUI 执行该命令。' },
          { label: '取消执行', value: 'deny', description: '不要执行该命令。' },
        ],
        placeholder: '可补充审批原因',
      }],
      timeoutMs: 10 * 60 * 1000,
    }, { wait: true }).catch(error => ({ ok: false, status: error.status || 'error', error: error.message, answers: null }));
    if (!approvalAccepted(approval.answers)) {
      appendLog({ type: 'approval', level: 'warn', msg: `用户拒绝或未完成审批：${commandText}`, command, args, cwd, risk: risk.level, reason: approval.status || approval.error || risk.reason });
      return res.fail(`命令未获用户确认：${approval.status || approval.error || risk.reason}`, 403, 403);
    }
    appendLog({ type: 'approval', level: 'info', msg: `用户已确认执行命令：${commandText}`, command, args, cwd, risk: risk.level, reason: risk.reason });
  } else if (toolPermissions.logApprovals !== false) {
    appendLog({ type: 'approval', level: risk.level === 'safe' ? 'info' : 'warn', msg: `命令执行审批：${commandText}`, command, args, cwd, risk: risk.level, reason: risk.reason });
  }

  try {
    const result = await executeCommandPayload(command, args, cwd, req.body?.timeoutMs, risk);
    return res.ok(result);
  } catch (error) {
    return res.fail('execute failed: ' + error.message, 500, 500);
  }
});

function scanMarkdownFiles(root) {
  const files = [];
  const maxFiles = 500;
  const skipDirs = new Set(['.git', 'node_modules', 'history-md', 'memory']);

  function walk(dir, depth) {
    if (files.length >= maxFiles || depth > 8) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles || entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;
      const stat = safeStat(full);
      if (!stat || stat.size > 1024 * 1024) continue;
      const rel = path.relative(root, full);
      const parts = rel.split(path.sep);
      const folder = parts.length > 1 ? parts[0] : '根目录';
      let content = '';
      try { content = fs.readFileSync(full, 'utf8'); } catch { content = ''; }
      const fm = parseFrontmatter(content);
      const title = String(fm.title || firstHeading(content) || path.basename(entry.name, '.md')).trim();
      const mdType = String(fm.type || fm.category || inferMdType(entry.name, content, rel)).trim();
      const tags = [...new Set([...normalizeTags(fm.tags), ...normalizeTags(fm.tag)])];
      files.push({
        id: Buffer.from(full).toString('base64url'),
        title,
        file: entry.name,
        path: full,
        dir: path.dirname(full),
        relativePath: rel,
        folder,
        mdType,
        type: mdType,
        tags,
        summary: String(fm.summary || fm.description || summarizeMarkdown(content)).trim(),
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }

  walk(root, 0);
  return files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
}

function groupBy(list, key, label) {
  const map = new Map();
  for (const item of list) {
    const value = key(item) || label;
    if (!map.has(value)) map.set(value, { name: value, files: [] });
    map.get(value).files.push(item);
  }
  return [...map.entries()].map(([name, group]) => ({ name, type: name, tag: name, folder: name, files: group.files }))
    .sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name, 'zh-CN'));
}

router.get('/md-library', (req, res) => {
  const root = mdLibraryRoot();
  if (!allowed(root)) return res.fail('path not allowed', 403, 403);
  try {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    for (const folder of DOC_FOLDERS) fs.mkdirSync(path.join(root, folder), { recursive: true });
    const filesFlat = scanMarkdownFiles(root);
    const folderGroups = groupBy(filesFlat, f => f.folder, '根目录');
    const folders = [
      ...DOC_FOLDERS.map(name => ({ name, type: name, tag: name, folder: name, files: filesFlat.filter(f => f.folder === name) })),
      ...folderGroups.filter(group => !DOC_FOLDERS.includes(group.name)),
    ];
    const vaultCategories = VAULT_CATEGORIES.map(item => ({ ...item, files: filesFlat.filter(f => f.folder === item.folder || (item.aliases || []).includes(f.folder)) }));
    const types = groupBy(filesFlat, f => f.mdType, '其他');
    const tagItems = [];
    const tagMap = new Map();
    for (const file of filesFlat) {
      for (const tag of file.tags || []) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag).push(file);
      }
    }
    for (const [tag, files] of tagMap.entries()) tagItems.push({ tag, name: tag, files });
    tagItems.sort((a, b) => b.files.length - a.files.length || a.tag.localeCompare(b.tag, 'zh-CN'));
    res.ok({
      root,
      filesFlat,
      folders,
      vaultCategories,
      defaultCategory: 'outputs',
      types,
      tags: tagItems,
      stats: {
        total: filesFlat.length,
        folders: folders.length,
        types: types.length,
        lastUpdated: filesFlat[0]?.mtime || 0,
      },
    });
  } catch (e) {
    res.fail('scan failed: ' + e.message, 500, 500);
  }
});


router.post('/md-library', (req, res) => {
  const root = mdLibraryRoot();
  if (!allowed(root)) return res.fail('path not allowed', 403, 403);
  try {
    const raw = String(req.body.content || '').trim();
    if (!raw) return res.fail('content required', 400, 400);
    if (Buffer.byteLength(raw, 'utf8') > 1024 * 1024) return res.fail('file too large (max 1MB)', 400, 400);
    res.ok(saveKnowledgeMarkdown(raw, req.body || {}));
  } catch (e) {
    res.fail('save failed: ' + e.message, 500, 500);
  }
});


router.post('/knowledge-capture', (req, res) => {
  try {
    const result = captureKnowledge(req.body || {});
    res.ok(result);
  } catch (e) {
    res.fail('capture failed: ' + e.message, 500, 500);
  }
});

router.patch('/md-library', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.body?.path || ''));
  const rawName = String(req.body?.name || '').trim();
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  if (!rawName) return res.fail('name required', 400, 400);
  try {
    const root = mdLibraryRoot();
    if (!(filePath === root || filePath.startsWith(root + path.sep))) return res.fail('only md library files can be renamed', 403, 403);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (path.extname(filePath).toLowerCase() !== '.md') return res.fail('only markdown files can be renamed', 400, 400);
    const base = safeFilePart(rawName, path.basename(filePath, '.md')) + '.md';
    const target = path.join(path.dirname(filePath), base);
    if (path.resolve(target) !== filePath && fs.existsSync(target)) return res.fail('file already exists', 409, 409);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const updated = content.match(/^---\s*[\r\n]/)
        ? content.replace(/^(---\s*[\r\n])([\s\S]*?)([\r\n]---)/, (match, start, body, end) => {
            const nextBody = /(^|\r?\n)title\s*:/i.test(body)
              ? body.replace(/(^|\r?\n)title\s*:[^\r\n]*/i, '$1title: ' + rawName)
              : 'title: ' + rawName + '\n' + body;
            return start + nextBody + end;
          })
        : '# ' + rawName + '\n\n' + content.replace(/^#\s+.*(?:\r?\n){1,2}/, '');
      fs.writeFileSync(filePath, updated, 'utf8');
    } catch {}
    fs.renameSync(filePath, target);
    const nextStat = fs.statSync(target);
    res.ok({ path: target, file: path.basename(target), title: rawName, size: nextStat.size, mtime: nextStat.mtimeMs });
  } catch (e) {
    res.fail('rename failed: ' + e.message, 500, 500);
  }
});

router.post('/md-library/copy', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.body?.path || ''));
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const root = mdLibraryRoot();
    if (!(filePath === root || filePath.startsWith(root + path.sep))) return res.fail('only md library files can be copied', 403, 403);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (path.extname(filePath).toLowerCase() !== '.md') return res.fail('only markdown files can be copied', 400, 400);
    const parsed = path.parse(filePath);
    let target = path.join(parsed.dir, `${parsed.name} - 副本${parsed.ext}`);
    let index = 2;
    while (fs.existsSync(target)) {
      target = path.join(parsed.dir, `${parsed.name} - 副本 ${index}${parsed.ext}`);
      index += 1;
    }
    fs.copyFileSync(filePath, target);
    const nextStat = fs.statSync(target);
    res.ok({ path: target, file: path.basename(target), title: path.basename(target, '.md'), size: nextStat.size, mtime: nextStat.mtimeMs });
  } catch (e) {
    res.fail('copy failed: ' + e.message, 500, 500);
  }
});

router.post('/md-library/move', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.body?.path || ''));
  const folder = normalizeDocFolder(String(req.body?.folder || '').trim(), '');
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const root = mdLibraryRoot();
    if (!(filePath === root || filePath.startsWith(root + path.sep))) return res.fail('only md library files can be moved', 403, 403);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (path.extname(filePath).toLowerCase() !== '.md') return res.fail('only markdown files can be moved', 400, 400);
    const dir = path.join(root, folder);
    fs.mkdirSync(dir, { recursive: true });
    let target = path.join(dir, path.basename(filePath));
    if (path.resolve(target) !== filePath && fs.existsSync(target)) {
      const parsed = path.parse(target);
      let index = 2;
      do {
        target = path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`);
        index += 1;
      } while (fs.existsSync(target));
    }
    fs.renameSync(filePath, target);
    const nextStat = fs.statSync(target);
    res.ok({ path: target, file: path.basename(target), title: path.basename(target, '.md'), folder, size: nextStat.size, mtime: nextStat.mtimeMs });
  } catch (e) {
    res.fail('move failed: ' + e.message, 500, 500);
  }
});

router.delete('/md-library', (req, res) => {
  const filePath = path.resolve(normalizeIncomingPath(req.query.path || req.body?.path || ''));
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const root = mdLibraryRoot();
    if (!(filePath === root || filePath.startsWith(root + path.sep))) return res.fail('only md library files can be deleted', 403, 403);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return res.fail('not a file', 400, 400);
    if (path.extname(filePath).toLowerCase() !== '.md') return res.fail('only markdown files can be deleted', 400, 400);
    fs.unlinkSync(filePath);
    res.ok({ path: filePath });
  } catch (e) {
    res.fail('delete failed: ' + e.message, 500, 500);
  }
});
module.exports = router;




