# Hermes Agent WebUI — AI 修改指南

> 本文档面向 AI 代码助手，帮助你在不阅读全部源码的情况下快速定位修改点、避免误改。

---

## 一、项目结构（只有 2 个文件需要关注）

```
Hermes Agent/
├── index.html          ← HTML 骨架 + 全部 CSS（~450 行）
├── app-new.js          ← 全部 JavaScript 逻辑（~810 行）
├── app.js              ← 旧版 JS，已废弃，不要改
├── DESIGN.md           ← 旧版 Framer 设计规范，已废弃
├── awesome-design-md/  ← 设计规范参考库（只读参考，不要改）
│   └── design-md/figma/DESIGN.md   ← 当前生效的设计规范源文件
└── backend/            ← 后端数据，前端不涉及
```

**你只需要改 `index.html` 和 `app-new.js` 这两个文件。**

---

## 二、架构概览

| 层 | 文件 | 职责 | 改动频率 |
|---|---|---|---|
| 结构+样式 | `index.html` | HTML 骨架（侧边栏+主内容区+弹窗）+ 全部 CSS | 低 |
| 逻辑 | `app-new.js` | 状态管理、页面渲染、用户交互 | 高 |
| 设计规范 | `awesome-design-md/design-md/figma/DESIGN.md` | 只读参考 | 不改 |

**核心机制：** 单页应用，无框架。`app-new.js` 中的 `renderPage()` 根据 `state.page` 调用对应的 `render*()` 函数，将 HTML 字符串注入 `#mainContent`。侧边栏导航通过 `navigate(pageId)` 驱动。

---

## 三、index.html 分区地图

### 3.1 CSS 变量区（第 8~40 行）— 改风格改这里

```css
:root{ ... }              /* 通用变量：字体、圆角、间距、过渡 */
[data-theme="light"]{ ... } /* 浅色主题全部颜色变量 */
[data-theme="dark"]{ ... }  /* 深色主题全部颜色变量 */
```

**变量命名规则：**

| 前缀 | 含义 | 示例 |
|---|---|---|
| `--c-*` | 颜色 | `--c-primary`, `--c-ink`, `--c-block-lime` |
| `--r-*` | 圆角 | `--r-sm:6px`, `--r-pill:50px` |
| `--s-*` | 间距 | `--s-md:16px`, `--s-xxl:48px` |
| `--font-*` | 字体族 | `--font-ui`, `--font-mono` |

**改风格只需改 CSS 变量，不要改组件样式里的具体值。** 例如想换主色调，改 `--c-primary` 即可全局生效。

### 3.2 组件样式区（第 41~382 行）— 一般不需要改

按模块组织，顺序如下：

| 行范围 | 模块 | 改动场景 |
|---|---|---|
| 41~67 | 全局重置、滚动条、app-layout | 极少改 |
| 68~102 | 侧边栏 `.sidebar` 系列 | 改侧边栏宽度/样式 |
| 103~112 | 页面头部 `.page-header` | 极少改 |
| 113~126 | 按钮 `.btn` 系列 | 改按钮风格 |
| 127~136 | 卡片 `.card`、色块 `.color-block` | 改卡片风格 |
| 137~150 | 标签页 `.tabs`、弹窗 `.modal` | 极少改 |
| 151~200 | 对话模块 `.chat-*`、`.msg-*` | 改对话界面 |
| 201~220 | 历史记录、群聊 | 极少改 |
| 221~260 | 任务、技能 | 极少改 |
| 261~290 | 记忆存储 | 极少改 |
| 291~330 | 模型配置、用量统计 | 极少改 |
| 331~360 | 频道、设置 | 极少改 |
| 361~382 | 角色、网关、日志、文件、终端 | 极少改 |

### 3.3 Figma 语义工具类（第 388~406 行）— 扩展风格用这些

```css
.fig-display-xl    /* 86px/340 标题 */
.fig-headline      /* 26px/540 小标题 */
.fig-body          /* 18px/320 正文 */
.fig-eyebrow       /* 18px/400 mono 大写标签 */
.fig-caption       /* 12px/400 mono 大写说明 */
.fig-color-block   /* 色块容器（r-lg + s-xxl 内距） */
.fig-pill-btn-primary    /* 黑底白字 pill 按钮 */
.fig-pill-btn-secondary  /* 白底黑字 pill 按钮 */
.fig-pill-btn-magenta    /* 品红 pill 按钮 */
.fig-icon-btn      /* 40px 圆形图标按钮 */
```

**新增页面或组件时，优先使用 `.fig-*` 工具类，保持风格统一。**

### 3.4 HTML 骨架（第 408~428 行）— 几乎不需要改

```
.app-layout
  ├── .mobile-backdrop          （移动端遮罩）
  ├── .hamburger                （移动端汉堡按钮）
  ├── .sidebar                  （侧边栏，固定结构）
  │   ├── .sidebar-logo         （Logo + 品牌名）
  │   ├── .collapse-btn         （折叠按钮）
  │   ├── #sidebarNav           （导航菜单，JS 动态渲染）
  │   ├── .model-selector       （模型选择器）
  │   ├── .profile-selector     （角色选择器）
  │   └── .sidebar-footer       （状态 + 主题切换 + 版本号）
  ├── #mainContent              （主内容区，JS 动态渲染）
  └── .modal-overlay            （弹窗容器）
```

**侧边栏 HTML 是静态的，导航项由 JS 渲染。主内容区完全由 JS 渲染。**

---

## 四、app-new.js 分区地图

### 4.1 工具层（第 1~6 行）— 不要改

```js
const $, $$, LS, esc   // DOM 选择器、localStorage 封装、HTML 转义
```

### 4.2 SVG 图标字典（第 8~38 行）— 新增图标加这里

```js
const SVG = { chat: '...', history: '...', ... }
```

**新增导航项或按钮需要图标时，先在 `SVG` 对象里添加。**

### 4.3 全局状态（第 40~60 行）— 新增状态加这里

```js
const state = {
  theme, page, sidebarCollapsed,
  model, settings, skills, chats, currentChat,
  memories, selectedChannel, activeProfile, gateways,
}
```

**新增功能模块需要持久化的数据，加到 `state` 里，并在 `save()` 函数中添加对应的 `LS.set()`。**

### 4.4 导航配置（第 62~82 行）— 改导航菜单改这里

```js
const NAV = [
  { group:'对话', items:[ {id:'chat', label:'对话', icon:'chat'}, ... ] },
  { group:'任务', items:[ ... ] },
  { group:'配置', items:[ ... ] },
  { group:'系统', items:[ ... ] },
]
```

**新增页面：在 `NAV` 中添加一项 `{id, label, icon}`，然后写对应的 `render*()` 函数。**

### 4.5 核心函数（第 84~170 行）— 一般不需要改

| 函数 | 作用 |
|---|---|
| `save()` | 持久化所有 state 到 localStorage |
| `navigate(page)` | 切换页面，重渲染侧边栏+主内容 |
| `toggleTheme()` | 切换深色/浅色主题 |
| `toggleSidebar()` | 折叠/展开侧边栏 |
| `renderSidebar()` | 渲染侧边栏导航项 |
| `renderPage()` | 根据 `state.page` 调用对应 `render*()` |
| `afterRender()` | 页面渲染后初始化（聊天自动滚底、终端聚焦等） |

### 4.6 页面渲染函数（第 171~760 行）— 主要修改区

每个页面一个 `render*()` 函数，返回 HTML 字符串。对应关系：

| 函数 | 页面 | 行号 |
|---|---|---|
| `renderChat()` | 对话 | ~171 |
| `renderHistory()` | 历史记录 | ~319 |
| `renderGroupChat()` | 群聊 | ~344 |
| `renderSearch()` | 搜索 | ~368 |
| `renderJobs()` | 任务管理 | ~398 |
| `renderSkills()` | 技能中心 | ~419 |
| `renderMemory()` | 记忆存储 | ~469 |
| `renderModels()` | 模型配置 | ~493 |
| `renderUsage()` | 用量统计 | ~545 |
| `renderChannels()` | 频道 | ~576 |
| `renderSettings()` | 设置 | ~600 |
| `renderProfiles()` | 角色配置 | ~659 |
| `renderGateways()` | 网关 | ~681 |
| `renderLogs()` | 日志 | ~692 |
| `renderFiles()` | 文件 | ~713 |
| `renderTerminal()` | 终端 | ~745 |

### 4.7 交互函数（穿插在各渲染函数之后）

| 函数 | 作用 |
|---|---|
| `sendMessage()` | 发送聊天消息 |
| `callBackend()` | 调用后端 API |
| `mockReply()` | 离线模拟回复 |
| `newChat()` / `selectChat()` / `clearChat()` | 会话管理 |
| `toggleSkill()` / `addSkill()` | 技能开关/添加 |
| `saveModel()` / `testModel()` | 模型配置保存/测试 |
| `saveSettings()` / `pingApi()` / `resetAll()` | 设置保存/连接测试/重置 |
| `execTerm()` | 终端命令执行 |
| `openModal()` / `closeModal()` | 弹窗控制 |
| `toast()` | 轻提示 |
| `askUser()` | Agent 反向提问弹窗入口 |

### 4.8 Agent 反向提问弹窗（AgentAsk 对象）

**位置**：`app-new.js` 末尾（`toast()` 之后、初始化代码之前）

**核心对象**：`AgentAsk` — 管理弹窗生命周期

| 方法 | 作用 |
|---|---|
| `AgentAsk.ask(questions, opts)` | 打开弹窗，返回 `Promise`，resolve 时返回用户回答数组 |
| `AgentAsk.dismiss()` | 关闭弹窗，resolve 返回 `null` |
| `AgentAsk.isOpen()` | 检查弹窗是否打开 |

**全局快捷函数**：`askUser(questions, opts)` — 等价于 `AgentAsk.ask()`

**questions 参数格式**：
```js
[
  {
    id: 'q1',              // 唯一标识（可选，默认 'q_0'）
    label: '选择语言',      // 问题标题
    type: 'single',         // 'single'=单选 | 'multi'=多选
    options: [              // 选项列表
      { label: 'Python', value: 'py' },
      { label: 'TypeScript', value: 'ts' },
    ],
    hint: '请选择你偏好的语言',  // 提示文字（可选）
    required: true,              // 是否必答（默认 true）
    maxLength: 500,              // 补充说明最大字数（默认 500）
    placeholder: '补充说明…',    // 输框占位文字（可选）
  },
  // ... 更多问题，每个问题一个 Tab
]
```

**opts 参数**：
```js
{ title: 'Agent 提问' }  // 弹窗标题（可选）
```

**返回值**（Promise resolve）：
```js
// 用户提交后
[
  { id: 'q1', label: '选择语言', selected: ['py'], custom: '我更喜欢 Python 3.12' },
  { id: 'q2', label: '框架选择', selected: ['react', 'vue'], custom: '' },
]
// 用户关闭弹窗 → resolve(null)
```

**CSS 类名**（`index.html` 中定义）：
| 类名 | 作用 |
|---|---|
| `.agent-panel` | 弹窗容器 |
| `.agent-panel-header` | 头部（标题+关闭按钮） |
| `.agent-tabs` / `.agent-tab` | 标签页容器/单个标签 |
| `.agent-body` | 内容区 |
| `.agent-option` / `.agent-option.selected` | 选项/已选中 |
| `.agent-option-radio` / `.agent-option-check` | 单选圆/多选框 |
| `.agent-custom-input` | 补充说明输入区 |
| `.agent-footer` | 底部（进度+按钮） |
| `.agent-progress-dot` | 进度点 |

**弹窗挂载点**：`#agentPanelSlot`（位于 `.chat-input-area` 内，输入框上方）

**修改弹窗样式**：改 `index.html` 中 `.agent-*` 系列 CSS
**修改弹窗逻辑**：改 `app-new.js` 中 `AgentAsk` 对象的方法

### 4.9 初始化（文件末尾 3 行）

```js
document.documentElement.dataset.theme = state.theme;
renderSidebar(); renderPage(); pingApi();
```

---

## 五、常见修改场景速查

### 场景 A：新增一个页面

1. `app-new.js` → `NAV` 数组中添加 `{id:'xxx', label:'页面名', icon:'xxx'}`
2. `app-new.js` → `SVG` 对象中添加对应图标（如果不存在）
3. `app-new.js` → 编写 `renderXxx()` 函数，返回 HTML 字符串
4. `app-new.js` → `renderPage()` 的 `renderers` 对象中添加映射 `xxx: renderXxx`
5. 如果需要初始化逻辑，在 `afterRender()` 中添加分支
6. 如果需要持久化数据，在 `state` 中添加字段，在 `save()` 中添加 `LS.set()`
7. 如果需要新 CSS 样式，在 `index.html` 的 `</style>` 前添加，优先使用 CSS 变量

### 场景 B：修改颜色/风格

1. **全局换色**：只改 `index.html` 中 `[data-theme="light"]` 和 `[data-theme="dark"]` 里的 `--c-*` 变量
2. **单个组件换色**：找到对应 CSS 类，改引用的变量名，不要硬编码颜色值
3. **新增色块**：在两个主题中都添加 `--c-block-xxx` 变量，并添加 `.color-block-xxx` CSS 类
4. **换字体**：改 `:root` 中的 `--font-ui` 或 `--font-mono`，同时更新 Google Fonts 链接

### 场景 C：修改某个页面的布局/内容

1. 找到对应的 `render*()` 函数
2. 修改返回的 HTML 字符串
3. 如果涉及新样式，在 `index.html` 中添加 CSS 类
4. 如果涉及新交互，在 `render*()` 函数后添加处理函数

### 场景 D：对接真实后端 API

1. 修改 `callBackend()` 函数（第 ~296 行）
2. 修改 `pingApi()` 函数（第 ~641 行）
3. 修改 `testModel()` 函数（第 ~530 行）
4. 其他页面的模拟数据（如 `renderJobs()` 中的 jobs 数组）替换为 API 调用

---

## 六、不要改的区域

| 区域 | 原因 |
|---|---|
| `app.js` | 旧版代码，已废弃 |
| `DESIGN.md` | 旧版 Framer 规范，已废弃 |
| `awesome-design-md/` | 第三方设计规范库，只读参考 |
| `backend/` | 后端数据，前端不涉及 |
| `index.html` 第 408~428 行 HTML 骨架 | 侧边栏结构固定，导航项由 JS 渲染 |
| `app-new.js` 第 1~6 行工具函数 | 通用工具，无业务逻辑 |
| CSS 变量的命名规则 | `--c-`/`--r-`/`--s-`/`--font-` 前缀是约定，不要打破 |

---

## 七、设计规范速查（Figma 风格）

> 完整规范见 `awesome-design-md/design-md/figma/DESIGN.md`

### 核心原则

1. **单色系统核心**：黑白为主，色块为叙事
2. **Pill 是唯一按钮形状**：所有文字 CTA 用 `--r-pill`，图标按钮用 `--r-full`
3. **色块替代阴影**：用饱和背景面板区分区域，不用 box-shadow 做层级
4. **字重驱动层级**：同字号用 320/330/480/540 等精细权重区分，不用颜色深浅
5. **Mono 仅用于标签**：`figmaMono` 只出现在 eyebrow 和 caption，不用于正文

### 色块调色板

| 变量 | 浅色值 | 深色值 | 用途 |
|---|---|---|---|
| `--c-block-lime` | `#dceeb1` | `#2a3a1a` | 系统/FAQ |
| `--c-block-lilac` | `#c5b0f4` | `#2a1f4a` | 设计/发布 |
| `--c-block-cream` | `#f4ecd6` | `#3a3420` | 模板/温暖 |
| `--c-block-pink` | `#efd4d4` | `#3a2020` | 柔和强调 |
| `--c-block-mint` | `#c8e6cd` | `#1a3a22` | 成功/自然 |
| `--c-block-coral` | `#f3c9b6` | `#3a2a1a` | 开发者/温暖 |
| `--c-block-navy` | `#1f1d3d` | `#1f1d3d` | 深色叙事（两主题相同） |

### 排版 Token

| Token | 尺寸 | 权重 | 字距 | CSS 类 |
|---|---|---|---|---|
| display-xl | 86px | 340 | -1.72px | `.fig-display-xl` |
| display-lg | 64px | 340 | -0.96px | `.fig-display-lg` |
| headline | 26px | 540 | -0.26px | `.fig-headline` |
| subhead | 26px | 340 | -0.26px | `.fig-subhead` |
| body-lg | 20px | 330 | -0.14px | `.fig-body-lg` |
| body | 18px | 320 | -0.26px | `.fig-body` |
| body-sm | 16px | 330 | -0.14px | `.fig-body-sm` |
| eyebrow | 18px | 400 | +0.54px | `.fig-eyebrow` |
| caption | 12px | 400 | +0.60px | `.fig-caption` |

---

## 八、数据持久化 Key 映射

| localStorage Key | state 字段 | 默认值 |
|---|---|---|
| `hermes.theme` | `state.theme` | `'dark'` |
| `hermes.model` | `state.model` | `{provider:'anthropic', model:'claude-opus-4-7', ...}` |
| `hermes.settings` | `state.settings` | `{lang:'zh', stream:true, ...}` |
| `hermes.skills` | `state.skills` | 6 个内置技能 |
| `hermes.chats` | `state.chats` | `[]` |
| `hermes.memories` | `state.memories` | `{core:'', context:'', episodes:[]}` |
| `hermes.gateways` | `state.gateways` | `[]` |

---

## 九、快速定位口诀

- **改颜色** → `index.html` 搜 `--c-`
- **改圆角** → `index.html` 搜 `--r-`
- **改间距** → `index.html` 搜 `--s-`
- **改某个页面** → `app-new.js` 搜 `renderXxx()`
- **加新页面** → 改 `NAV` + 写 `render*()` + 加 `renderers` 映射
- **加新图标** → `app-new.js` 的 `SVG` 对象
- **加新状态** → `state` 对象 + `save()` 函数
- **改对话逻辑** → `sendMessage()` + `callBackend()` + `mockReply()`
- **改侧边栏** → `renderSidebar()` + `NAV` 配置 + `index.html` `.sidebar` CSS
- **改主题切换** → `toggleTheme()` + `[data-theme]` CSS 变量
- **改 Agent 弹窗样式** → `index.html` 搜 `.agent-`
- **改 Agent 弹窗逻辑** → `app-new.js` 搜 `AgentAsk`
- **调用 Agent 提问** → `askUser(questions, opts)` 返回 Promise
