const express = require('express');
const store = require('../services/store');
const { detectHermesCommand } = require('../services/hermes');

const router = express.Router();

function probeHermes(_settings) {
  const hermesCmd = detectHermesCommand();
  if (!hermesCmd) {
    return {
      available: false,
      command: '',
      version: '',
      error: 'Hermes Agent CLI not found. Install native Hermes on Windows and ensure hermes is on PATH.',
      type: 'none',
      path: '',
    };
  }

  return {
    available: true,
    command: hermesCmd.cmd || 'hermes',
    version: hermesCmd.output || (hermesCmd.version ? `Hermes Agent v${hermesCmd.version}` : 'unknown'),
    error: '',
    type: 'native',
    path: hermesCmd.path || '',
    stale: !!hermesCmd.stale,
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
      { name: 'WebUI Image', desc: 'webui_image_generate tool', enabled: true, tools: ['webui_image_generate'] },
      { name: 'WebUI Video', desc: 'webui_video_generate tool', enabled: true, tools: ['webui_video_generate'] },
      { name: 'WebUI Markdown Image', desc: 'webui_markdown_insert_image tool', enabled: true, tools: ['webui_markdown_insert_image'] },
      { name: 'Skills', desc: '技能提示词注入', enabled: skills.some(s => s.on) },
      { name: 'Memory', desc: '历史会话检索', enabled: true },
      { name: 'Gateway', desc: '平台通道管理', enabled: store.read('gateway', {}).enabled === true },
      { name: 'Cron', desc: '定时任务配置', enabled: true },
    ],
  });
});

module.exports = router;


