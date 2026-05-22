const express = require('express');
const store = require('../services/store');

const router = express.Router();
const KEY = 'settings';

const DEFAULTS = {
  theme: 'dark',
  lang: 'zh',
  stream: true,
  autoTitle: true,
  history: 16,
  systemPrompt: '',
  /** API 根地址（可选）。空则前端使用当前页面 origin。 */
  api: '',
  hermesModel: '',
  hermesPath: '',
  quickMode: false,
  routingMode: 'auto',
  hermesApiServerUrl: '',
  hermesApiServerKey: '',
  dataRootDir: '',
  memoryDir: '',
  imageDir: '',
  historyDir: '',
  mdLibraryDir: '',
  debugPerf: false,
  promptToggles: {
    webuiRules: true,
    coreMemory: true,
    agentRules: true,
    userSystemPrompt: true,
    profilePrompt: true,
    skills: true,
    knowledgeSearch: true,
  },
  knowledgeSearchLimit: 3,
};

function withDefaults(value = {}) {
  return {
    ...DEFAULTS,
    ...value,
    promptToggles: {
      ...DEFAULTS.promptToggles,
      ...(value.promptToggles || {}),
    },
  };
}

router.get('/', (req, res) => res.ok(withDefaults(store.read(KEY, DEFAULTS))));

router.put('/', (req, res) => {
  const merged = withDefaults({ ...store.read(KEY, DEFAULTS), ...req.body });
  store.write(KEY, merged);
  res.ok(merged);
});

module.exports = router;
