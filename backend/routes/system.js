const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const store = require('../services/store');
const paths = require('../services/paths');
const modalBus = require('./modal');
const { stopActiveHermesChildren, activeHermesChildStats, detectHermesCommand } = require('../services/hermes');
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

function runTool(command, args = [], { cwd = PROJECT_ROOT, timeout = 8000, maxBuffer = 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer,
  });
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: result.error ? result.error.message : '',
    timedOut: result.error && result.error.code === 'ETIMEDOUT',
  };
}

function toolVersion(command, args = ['--version']) {
  const result = runTool(command, args, { timeout: 5000 });
  return {
    available: result.ok,
    version: result.ok ? (result.stdout || result.stderr).split(/\r?\n/)[0] : '',
    error: result.ok ? '' : (result.error || result.stderr || result.stdout || `${command} not found`),
  };
}

function clipped(text, limit = 1200) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  return value.slice(0, limit) + '...';
}

function classifyCommandFailure(raw, fallback = '命令执行失败。') {
  const text = String(raw || '');
  const lower = text.toLowerCase();
  if (!text.trim()) return fallback;
  if (/enoent|not recognized|not found|无法将|不是内部或外部命令/.test(lower)) {
    return '没有找到必要命令。请确认 Git 和 Node.js 已安装，并且已经加入 PATH。';
  }
  if (/authentication failed|permission denied|could not read username|terminal prompts disabled|403|401/.test(lower)) {
    return 'Git 远端需要登录或权限不足。公司电脑如果拦截 GitHub，需要先配置 Git 凭据、代理或换可访问网络。';
  }
  if (/could not resolve host|failed to connect|connection timed out|timed out|unable to access|proxy|ssl certificate|certificate|network/.test(lower)) {
    return '网络连接远端失败。常见原因是公司网络/代理/证书拦截 GitHub 或 npm registry。';
  }
  if (/your local changes|would be overwritten|untracked working tree files|please commit/.test(lower)) {
    return '本地文件有改动，Git 为了避免覆盖你的内容拒绝更新。请先备份、提交或恢复这些改动。';
  }
  if (/not possible to fast-forward|divergent|need to specify how to reconcile/.test(lower)) {
    return '本地分支和远端分叉了，不能安全自动更新，需要手动处理 Git 分支。';
  }
  if (/no such remote ref|no upstream|no tracking information|upstream/.test(lower)) {
    return '当前分支没有绑定远端 upstream，无法判断要从哪里更新。';
  }
  if (/npm err|eai_again|eresolve|etarget|econnreset|fetch failed|registry/.test(lower)) {
    return 'npm 依赖安装失败。公司网络常见原因是 npm registry 被拦截，可以切换镜像后重试。';
  }
  return fallback;
}

function runNpm(args = [], options = {}) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const finalArgs = process.platform === 'win32' ? ['/d', '/c', 'npm', ...args] : args;
  return runTool(command, finalArgs, options);
}

function npmVersion() {
  const result = runNpm(['--version'], { timeout: 5000 });
  return {
    available: result.ok,
    version: result.ok ? (result.stdout || result.stderr).split(/\r?\n/)[0] : '',
    error: result.ok ? '' : (result.error || result.stderr || result.stdout || 'npm not found'),
  };
}

function runNpmInstall({ timeout = 180000 } = {}) {
  return runNpm(['install', '--loglevel=warn'], {
    cwd: PROJECT_ROOT,
    timeout,
    maxBuffer: 1024 * 1024 * 6,
  });
}

function parseAheadBehind(text) {
  const match = String(text || '').match(/^(\d+)\s+(\d+)$/);
  return match ? { ahead: Number(match[1]) || 0, behind: Number(match[2]) || 0 } : { ahead: 0, behind: 0 };
}

function getUpdateStatus({ fetchRemote = false } = {}) {
  const packageVersion = readPackageVersion();
  const gitInfo = toolVersion('git');
  const nodeInfo = toolVersion('node');
  const npmInfo = npmVersion();
  const dependenciesInstalled = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules')) && fs.existsSync(path.join(PROJECT_ROOT, 'backend', 'node_modules'));
  if (!gitInfo.available) {
    return {
      isGitRepo: false,
      packageVersion,
      projectRoot: PROJECT_ROOT,
      git: gitInfo,
      node: nodeInfo,
      npm: npmInfo,
      dependenciesInstalled,
      canRepairDependencies: npmInfo.available,
      message: '没有检测到 Git，不能在线更新代码。请安装 Git for Windows，或下载最新版压缩包覆盖安装。',
      reason: 'git_missing',
      nextAction: '安装 Git 后重启 WebUI，再回到这里点击“检查远端”。',
    };
  }
  const isRepo = runGit(['rev-parse', '--is-inside-work-tree']);
  if (!isRepo.ok || isRepo.stdout !== 'true') {
    return {
      isGitRepo: false,
      packageVersion,
      projectRoot: PROJECT_ROOT,
      git: gitInfo,
      node: nodeInfo,
      npm: npmInfo,
      dependenciesInstalled,
      canRepairDependencies: npmInfo.available,
      message: '当前目录不是 Git 克隆项目，无法通过 GitHub 自动检测更新。',
      reason: 'not_git_repo',
      nextAction: '如果这是下载的压缩包版本，请下载新版压缩包替换；如果想一键更新，建议用 Git 克隆项目。',
    };
  }
  const fetchResult = fetchRemote ? runGit(['fetch', '--tags', '--prune'], { timeout: 30000 }) : null;
  const branch = runGit(['branch', '--show-current']).stdout || 'detached';
  const localCommit = runGit(['rev-parse', '--short', 'HEAD']).stdout || '';
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remote = runGit(['remote', '-v']).stdout.split(/\r?\n/).find(line => /\(fetch\)$/.test(line)) || '';
  const dirty = runGit(['status', '--porcelain']).stdout;
  const allDirtyFiles = dirty ? dirty.split(/\r?\n/).filter(Boolean) : [];
  const dirtyFiles = allDirtyFiles.slice(0, 12);
  let ahead = 0;
  let behind = 0;
  let countsError = '';
  if (upstream.ok && upstream.stdout) {
    const counts = runGit(['rev-list', '--left-right', '--count', 'HEAD...' + upstream.stdout]);
    if (counts.ok) ({ ahead, behind } = parseAheadBehind(counts.stdout));
    else countsError = counts.stderr || counts.error || counts.stdout || '';
  }
  const latestTag = runGit(['describe', '--tags', '--abbrev=0']).stdout || '';
  const currentTag = runGit(['describe', '--tags', '--exact-match', 'HEAD']).stdout || '';
  const fetchError = fetchResult && !fetchResult.ok ? (fetchResult.stderr || fetchResult.error || fetchResult.stdout || 'git fetch failed') : '';
  const dirtyCount = allDirtyFiles.length;
  const hasRemoteProblem = fetchRemote && fetchResult && !fetchResult.ok;
  const hasLocalChanges = !!dirty;
  const noUpstream = !upstream.ok || !upstream.stdout;
  const safeToPull = !hasRemoteProblem && !noUpstream && behind > 0 && ahead === 0 && !hasLocalChanges;
  let reason = 'up_to_date';
  let message = '当前代码已是最新状态。';
  let nextAction = '如果你想重新确认 GitHub 上有没有新版本，点击“检查远端”。';
  if (hasRemoteProblem) {
    reason = 'fetch_failed';
    message = classifyCommandFailure(fetchError, '远端检查失败。');
    nextAction = '优先检查公司网络、代理、GitHub 访问权限；也可以关闭 WebUI 后双击 update.bat 查看完整日志。';
  } else if (noUpstream) {
    reason = 'no_upstream';
    message = '当前 Git 分支没有绑定远端 upstream，WebUI 不知道应该从哪个分支更新。';
    nextAction = remote ? '请在命令行设置 upstream，或重新 clone 项目。' : '当前没有 Git 远端，请重新 clone 项目或下载新版压缩包。';
  } else if (hasLocalChanges) {
    reason = 'dirty_worktree';
    message = '检测到本地文件改动，自动更新已暂停，避免覆盖你的内容。';
    nextAction = '如果这些是你自己的改动，请先备份或提交；如果只是临时文件，可以手动处理后再更新。';
  } else if (ahead > 0) {
    reason = 'ahead';
    message = '本地提交领先远端，不能安全自动快进更新。';
    nextAction = '这通常表示你本地改过代码并提交过，需要手动处理分支。';
  } else if (behind > 0) {
    reason = 'update_available';
    message = '发现远端更新，可以执行安全更新。';
    nextAction = '点击“安全更新”，完成后重启 WebUI。';
  } else if (fetchRemote && fetchResult && fetchResult.ok) {
    message = '已检查远端，当前没有可更新内容。';
  }
  return {
    isGitRepo: true,
    packageVersion,
    projectRoot: PROJECT_ROOT,
    git: gitInfo,
    node: nodeInfo,
    npm: npmInfo,
    dependenciesInstalled,
    canRepairDependencies: npmInfo.available,
    branch,
    upstream: upstream.ok ? upstream.stdout : '',
    remote,
    localCommit,
    currentTag,
    latestTag,
    ahead,
    behind,
    dirtyCount,
    dirtyFiles,
    hasLocalChanges,
    fetched: fetchRemote,
    fetchOk: fetchResult ? fetchResult.ok : null,
    fetchError: clipped(fetchError),
    countsError: clipped(countsError),
    updateCommand: 'git pull --ff-only && npm install',
    safeToPull,
    message,
    reason,
    nextAction,
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
    if (!before.git?.available) return res.fail(before.message || '没有检测到 Git，无法自动更新。', 400, 400);
    if (!before.isGitRepo) return res.fail(before.message || '当前目录不是 Git 克隆项目，无法自动更新。', 400, 400);
    if (before.fetchOk === false) return res.fail(`${before.message || '远端检查失败。'} ${before.nextAction || ''}`.trim(), 502, 502);
    if (!before.upstream) return res.fail(`${before.message || '当前分支没有 upstream，无法自动更新。'} ${before.nextAction || ''}`.trim(), 409, 409);
    if (before.hasLocalChanges) return res.fail(`${before.message || '存在本地未提交改动。'} ${before.nextAction || ''}`.trim(), 409, 409);
    if (before.ahead > 0) return res.fail(`${before.message || '本地提交领先远端，不能自动快进更新。'} ${before.nextAction || ''}`.trim(), 409, 409);
    if (before.behind <= 0) return res.ok({ message: '当前已经是最新状态。', before, after: before, logs: [] });
    const pull = runGit(['pull', '--ff-only'], { timeout: 60000 });
    if (!pull.ok) {
      const raw = pull.stderr || pull.error || pull.stdout || 'unknown error';
      return res.fail(`git pull 失败：${classifyCommandFailure(raw, 'Git 拉取失败。')} 详情：${clipped(raw)}`, 500, 500);
    }
    const install = runNpmInstall();
    if (!install.ok) {
      const raw = install.stderr || install.error || install.stdout || 'unknown error';
      return res.fail(`代码已更新，但依赖安装失败：${classifyCommandFailure(raw, 'npm install 失败。')} 详情：${clipped(raw)}`, 500, 500);
    }
    const after = getUpdateStatus({ fetchRemote: false });
    res.ok({ message: '更新完成，请重启 WebUI。', before, after, logs: [pull.stdout, install.stdout].filter(Boolean) });
  } catch (e) {
    res.fail('apply update failed: ' + e.message, 500, 500);
  }
});

router.post('/update-repair-deps', (req, res) => {
  try {
    const before = getUpdateStatus({ fetchRemote: false });
    if (!before.node?.available) return res.fail('没有检测到 Node.js，无法安装依赖。请安装 Node.js 18+ 后重启 WebUI。', 400, 400);
    if (!before.npm?.available) return res.fail('没有检测到 npm，无法安装依赖。请重新安装 Node.js LTS，安装时勾选 npm。', 400, 400);
    const install = runNpmInstall();
    if (!install.ok) {
      const raw = install.stderr || install.error || install.stdout || 'unknown error';
      return res.fail(`依赖修复失败：${classifyCommandFailure(raw, 'npm install 失败。')} 详情：${clipped(raw)}`, 500, 500);
    }
    const after = getUpdateStatus({ fetchRemote: false });
    res.ok({ message: '依赖修复完成，请重启 WebUI。', before, after, logs: [install.stdout].filter(Boolean) });
  } catch (e) {
    res.fail('repair dependencies failed: ' + e.message, 500, 500);
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


function modelDiagnostics(settings, models) {
  const modelScope = settings.quickMode ? 'webui' : 'agent';
  const cfg = models && (models.webui || models.agent) ? (models[modelScope] || models.webui || models.agent || {}) : models;
  const library = Array.isArray(cfg.library) ? cfg.library : [];
  const enabled = library.filter(m => m && m.enabled !== false);
  const imageId = cfg.scenarios && cfg.scenarios.image;
  const imageModel = enabled.find(m => m.id === imageId || m.name === imageId) || enabled.find(m => m.kind === 'image' || m.apiFormat === 'openai-image' || m.apiFormat === 'openai_image');
  return { modelScope, total: library.length, enabled: enabled.length, imageModel, current: cfg.current || cfg.scenarios?.chat || '' };
}

function agentHealthItems() {
  const settings = store.read('settings', {});
  const models = store.read('models', {});
  const active = activeHermesChildStats();
  const modelInfo = modelDiagnostics(settings, models);
  const hermesCmd = detectHermesCommand();
  return [
    { key: 'webui', label: 'WebUI', status: 'ok', detail: 'Backend API is connected' },
    { key: 'hermes', label: 'Hermes', status: active.length ? 'busy' : (hermesCmd ? 'ok' : 'warn'), detail: active.length ? `Running ${active.length} Hermes child process(es)` : (hermesCmd ? `Detected Windows native Hermes CLI${hermesCmd.version ? ` (${hermesCmd.version})` : ''}` : 'Windows native Hermes CLI not detected') },
    { key: 'models', label: 'Models', status: modelInfo.enabled ? 'ok' : 'warn', detail: `Scope ${modelInfo.modelScope}, enabled ${modelInfo.enabled}/${modelInfo.total}${modelInfo.current ? `, default ${modelInfo.current}` : ''}` },
    { key: 'image', label: 'Image', status: modelInfo.imageModel ? 'ok' : 'warn', detail: modelInfo.imageModel ? `Image model configured: ${modelInfo.imageModel.name || modelInfo.imageModel.id || 'unnamed model'}` : 'No enabled image model detected' },
    { key: 'mcp', label: 'MCP', status: 'ok', detail: 'Hermes native runtime mounts the webui_image toolset' },
  ];
}


router.get('/diagnostics', (_req, res) => {
  const startedAt = Date.now();
  try {
    const settings = store.read('settings', {});
    const models = store.read('models', {});
    const logs = store.read('logs', []);
    const hermesCmd = detectHermesCommand();
    const active = activeHermesChildStats();
    const modelInfo = modelDiagnostics(settings, models);
    const recentErrors = logs.filter(item => ['error', 'warn'].includes(String(item.level || '').toLowerCase())).slice(-20);
    const dirs = {
      store: store.DATA_DIR,
      dataRoot: paths.dataRoot(),
      memory: paths.memoryRoot(),
      images: paths.imageRoot(),
      history: paths.historyDir(),
      mdLibrary: paths.mdLibraryRoot(),
    };
    const dirStatus = Object.entries(dirs).map(([key, dir]) => {
      let writable = false;
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        writable = true;
      } catch (_) {}
      return { key, path: dir, exists: fs.existsSync(dir), writable };
    });
    res.ok({
      ts: Date.now(),
      elapsedMs: Date.now() - startedAt,
      platform: process.platform,
      node: process.version,
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      hermes: hermesCmd || null,
      activeHermes: active,
      modelInfo,
      health: agentHealthItems(),
      dirs: dirStatus,
      logs: { total: logs.length, recentErrors },
      settings: { quickMode: !!settings.quickMode, routingMode: settings.routingMode || 'auto', agentRuntime: 'cli' },
    });
  } catch (e) {
    res.fail('diagnostics failed: ' + e.message, 500, 500);
  }
});

router.get('/agent-health', (_req, res) => {
  res.ok({ items: agentHealthItems(), ts: Date.now() });
});

router.get('/hermes-processes', (_req, res) => {
  res.ok({ processes: activeHermesChildStats() });
});

router.post('/restart-hermes', (req, res) => {
  const result = stopActiveHermesChildren(String(req.body?.reason || 'manual-restart'));
  appendLog({ type: 'hermes-restart', level: 'warn', msg: '\u5df2\u8bf7\u6c42\u91cd\u542f Hermes \u5b50\u8fdb\u7a0b', ...result });
  res.ok(result);
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
      const tags = [...new Set([
        ...normalizeTags(fm.tags),
        ...normalizeTags(fm.tag),
        ...normalizeTags(fm.labels),
        ...normalizeTags(fm.label),
        ...normalizeTags(fm.categories),
        ...normalizeTags(fm.category),
      ])];
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
    const knownCategoryFolders = new Set();
    const vaultCategories = VAULT_CATEGORIES.map(item => {
      knownCategoryFolders.add(item.folder);
      for (const alias of item.aliases || []) knownCategoryFolders.add(alias);
      return { ...item, files: filesFlat.filter(f => f.folder === item.folder || (item.aliases || []).includes(f.folder)) };
    });
    for (const group of folderGroups) {
      if (!group.name || knownCategoryFolders.has(group.name)) continue;
      const id = 'folder-' + Buffer.from(group.name).toString('base64url');
      vaultCategories.push({ id, label: group.name, folder: group.name, dynamic: true, files: group.files || [] });
    }
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
  const rawFolder = String(req.body?.folder || '').trim();
  if (!filePath || !allowed(filePath)) return res.fail('path not allowed', 403, 403);
  try {
    const root = mdLibraryRoot();
    const currentFolders = new Set();
    if (fs.existsSync(root)) {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) currentFolders.add(entry.name);
      }
    }
    const folder = currentFolders.has(rawFolder) ? rawFolder : normalizeDocFolder(rawFolder, '');
    if (!folder || folder === '临时收件箱' && rawFolder !== '临时收件箱') return res.fail('invalid folder', 400, 400);
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




