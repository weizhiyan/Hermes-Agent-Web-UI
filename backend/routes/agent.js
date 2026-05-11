const express = require('express');
const { spawnSync } = require('child_process');
const store = require('../services/store');
const { detectHermesCommand } = require('../services/hermes');

const router = express.Router();

function probeHermes(settings) {
  const hermesCmd = detectHermesCommand();
  if (!hermesCmd) {
    return {
      available: false,
      command: '',
      version: '',
      error: 'Hermes Agent CLI 未找到。请按官方安装说明安装，并先审阅安装脚本内容；不要使用 curl | bash 这类下载后直接执行的命令。',
      type: 'none',
    };
  }

  let versionOutput = '';
  try {
    let result;
    if (hermesCmd.type === 'wsl') {
      result = spawnSync('wsl', ['-e', 'bash', '-lc', 'hermes --version'], {
        encoding: 'utf8', timeout: 5000,
      });
    } else {
      result = spawnSync(hermesCmd.cmd, ['--version'], {
        encoding: 'utf8', shell: true, timeout: 3000,
      });
    }
    versionOutput = (result.stdout || result.stderr || '').trim();
  } catch {}

  return {
    available: true,
    command: hermesCmd.type === 'wsl' ? 'wsl → hermes' : hermesCmd.cmd,
    version: versionOutput.split('\n')[0] || 'unknown',
    error: '',
    type: hermesCmd.type,
  };
}

router.get('/', (req, res) => {
  const settings = store.read('settings', {});
  const skills = store.read('skills', []);
  const chats = store.read('chats', []);
  const hermesCli = probeHermes(settings);

  res.ok({
    status: 'running',
    uptime: `${Math.floor(process.uptime() / 60)} 分钟`,
    sessionCount: chats.length,
    memoryEnabled: true,
    skillsEnabled: skills.some(s => s.on),
    hermesCli,
    model: settings.hermesModel || 'default',
    config: {
      max_turns: settings.maxTurns || 90,
      compression_enabled: settings.compression?.enabled !== false,
      compression_threshold: settings.compression?.threshold ?? 0.5,
      compression_target_ratio: settings.compression?.target_ratio ?? 0.2,
    },
    toolsets: [
      { name: 'Hermes Agent', desc: hermesCli.available ? hermesCli.version : hermesCli.error, enabled: hermesCli.available },
      { name: 'Skills', desc: '技能提示词注入', enabled: skills.some(s => s.on) },
      { name: 'Memory', desc: '历史会话检索', enabled: true },
      { name: 'Gateway', desc: '平台通道管理', enabled: store.read('gateway', {}).enabled === true },
      { name: 'Cron', desc: '定时任务配置', enabled: true },
    ],
  });
});

module.exports = router;
