const express = require('express');
const store = require('../services/store');
const paths = require('../services/paths');

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
  toolPermissions: {
    commandPolicy: 'safe',
    logApprovals: true,
    requireApprovalForRisky: true,
  },
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
  const merged = {
    ...DEFAULTS,
    ...value,
    toolPermissions: {
      ...DEFAULTS.toolPermissions,
      ...(value.toolPermissions || {}),
    },
    promptToggles: {
      ...DEFAULTS.promptToggles,
      ...(value.promptToggles || {}),
    },
  };
  return {
    ...merged,
    effectivePaths: {
      dataRootDir: paths.dataRoot(),
      memoryDir: paths.memoryRoot(),
      imageDir: paths.imageRoot(),
      historyDir: paths.historyDir(),
      mdLibraryDir: paths.mdLibraryRoot(),
    },
  };
}

router.get('/', (req, res) => res.ok(withDefaults(store.read(KEY, DEFAULTS))));

router.put('/', (req, res) => {
  const merged = withDefaults({ ...store.read(KEY, DEFAULTS), ...req.body });
  delete merged.effectivePaths;
  store.write(KEY, merged);
  res.ok(withDefaults(merged));
});

module.exports = router;
