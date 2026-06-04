const fs = require('fs');
const path = require('path');

const BUILTIN_SKILL_DIR = path.join(__dirname, '..', 'data', 'skills-builtin');

const DEFINITIONS = [
  {
    id: 'image2',
    dir: 'image2',
    icon: '图',
    name: 'image2',
    desc: 'Image2 / WebUI 生图提示词、图生图与工具调用规则。',
    category: '图像生成',
    tags: ['内置', '生图', 'Image2', '提示词'],
    triggers: ['生图', '生成图片', '生成图像', '出图', '画图', '改图', '修图', '海报', '插画', '头像', 'image2', 'webui_image_generate'],
    priority: 100,
  },
  {
    id: 'expression-enhancement',
    dir: 'expression-enhancement',
    icon: '表',
    name: '表达增强',
    desc: '将零碎想法补充完善、统一结构并增强表达。',
    category: '表达与写作',
    tags: ['内置', '表达', '润色', '写作'],
    triggers: ['表达增强', '润色', '优化表达', '改写', '文案', '标题', '结构梳理', '补充完善', '分享稿'],
    priority: 85,
  },
  {
    id: 'superpower',
    dir: 'superpower',
    icon: 'SP',
    name: 'superpower',
    desc: '复杂任务的计划、执行、验证与交付工作流。',
    category: '工作流增强',
    tags: ['内置', '工作流', '计划', '验收'],
    triggers: ['superpower', '计划', '验收标准', '分步骤', '深度排查', '复杂任务', '工作流', '继续修改'],
    priority: 70,
  },
];

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function builtinSkills() {
  return DEFINITIONS.map(def => {
    const root = path.join(BUILTIN_SKILL_DIR, def.dir);
    const prompt = readText(path.join(root, 'SKILL.md'));
    const description = def.description || def.desc;
    return {
      id: def.id,
      icon: def.icon,
      name: def.name,
      desc: def.desc,
      description,
      tags: def.tags,
      triggers: def.triggers,
      source: 'builtin',
      category: def.category,
      on: true,
      enabled: true,
      priority: def.priority,
      prompt,
      path: root,
      builtin: true,
    };
  });
}

function isBuiltinLike(item = {}) {
  const id = String(item.id || '').replace(/^external-/, '').toLowerCase();
  const name = String(item.name || '').trim().toLowerCase();
  const hint = String(item.path || item.id || item.name || '').toLowerCase();
  return DEFINITIONS.some(def => {
    const defId = def.id.toLowerCase();
    const defName = def.name.toLowerCase();
    if (id === defId || name === defName) return true;
    if (def.id === 'expression-enhancement' && /表达增强|design-writing-polisher/i.test(hint)) return true;
    if (def.id === 'superpower' && /superpower|superpowers|using-superpowers|writing-skills/i.test(hint)) return true;
    return false;
  });
}

module.exports = { builtinSkills, isBuiltinLike, BUILTIN_SKILL_DIR };
