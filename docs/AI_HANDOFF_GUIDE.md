# Hermes Agent AI Handoff Guide

最后更新：2026-05-13。

这份文档给后续接手 Hermes Agent WebUI 的 AI / Agent 使用。目标是让新的 Agent 在新电脑、新路径、新模型环境中，也能理解 WebUI 的边界、数据目录、模型联动、记忆、技能、图像生成、语雀接入和本地文件分类，不要只改前端展示或写死旧电脑路径。

## 1. 核心定位

- Hermes WebUI 是交互层，不是假数据演示页。初始状态可以为空，但模型、技能、记忆、图片、Markdown、历史对话都必须来自真实后端或本地文件。
- 普通对话必须经过 Hermes Agent，不允许绕过 Agent 直接和模型聊天。
- 只有用户在图像按钮里开启“跳过 Agent 直连生图”时，图像生成才可以直接调用图片 API。
- 用户在 WebUI 对话里要求修改 WebUI 自身时，Agent 要提示切换到 CLI / 代码维护模式；当前 WebUI 会话只做检查、解释、数据配置和非核心文件操作。
- 不要把 `C:\Users\Administrator\Desktop\Hermes Agent` 写死进业务逻辑。默认目录来自当前项目根目录，用户指定目录优先。

## 2. WebUI 自保护规则

来自 WebUI 对话页的请求，默认禁止修改核心代码和服务文件，除非用户明确说“现在不用 WebUI，在 CLI/代码维护模式中修改项目”。

禁止范围：

- `index.html`
- `app-new.js`
- `frontend/`
- `backend/routes/`
- `backend/services/`
- `backend/server.js`
- 启动脚本、模型连接核心逻辑、页面样式和路由

允许范围：

- 读取并解释文件
- 给出修改方案
- 更新用户授权的数据文件
- 写入第三方 API 配置、记忆文件、图片/Markdown 输出目录、`backend/data` 下业务数据
- 指导用户切换到 CLI / 代码维护模式后再修改核心代码

## 3. 跨电脑与新 Agent 适配

新电脑安装或从 GitHub 拉取后，Agent 应先确认项目根目录，不要沿用旧电脑绝对路径。常规步骤：

1. 检查项目是否有 `backend/package.json`、根目录 `index.html`、`app-new.js`。
2. 检查 `backend/data` 是否存在，不存在就创建空目录，但不要生成假会话、假模型、假技能。
3. 如用户提供旧电脑数据目录，优先迁移 `backend/data/*.json`、`backend/data/images/`、`backend/data/memory/`、`backend/data/output-md/`。
4. 检查 `backend/data/settings.json` 里的路径字段，例如 `mdLibraryDir`、记忆目录、Hermes CLI 路径；若仍指向旧电脑，提示用户重新指定。
5. 检查 `backend/data/models.json` 中 Provider、Base URL、API Key、认证方式、场景模型；不要默认使用旧 Key 测试，除非用户明确授权。
6. 启动后先测 `/api/health`，再测模型连接，最后测普通 Agent 对话和图像生成。

默认数据位置：

- 后端数据：`backend/data`
- WebUI 会话：`backend/data/chats.json`
- CLI 隐藏列表：`backend/data/cli-hidden-sessions.json`
- 模型配置：`backend/data/models.json`
- 设置配置：`backend/data/settings.json`
- 技能索引：`backend/data/skills.json`
- 本地技能副本：`backend/data/skills-local/`
- 图像索引：`backend/data/images.json`
- 上传图片：`backend/data/images/inputs/YYYY-MM/`
- 生成图片：`backend/data/images/outputs/YYYY-MM/`
- 对话 Markdown 归档：`backend/data/history-md/`
- Agent 输出 Markdown 库：默认 `backend/data/output-md/`，也可由设置里的 `mdLibraryDir` 指定
- 核心记忆：`backend/data/memory/core/`

## 4. 模型配置与场景联动

模型数据在 `backend/data/models.json`，后端接口是 `/api/models`。模型库是全局共享的，一个模型可以用于多个场景或多个 Agent。

推荐字段：

```json
{
  "id": "deepseek:deepseek-r1",
  "provider": "deepseek",
  "name": "deepseek-r1",
  "base": "https://api.deepseek.com",
  "key": "sk-xxx",
  "enabled": true,
  "apiFormat": "openai-chat",
  "authType": "bearer",
  "authHeader": "",
  "tags": ["reasoning"]
}
```

场景：

- `chat`：普通对话，要求响应稳定。
- `reasoning`：深度推理、提示词优化、复杂任务。
- `image`：图像生成，要求 `apiFormat` 为 `openai-image` 或兼容格式。

对话页模型选择逻辑：

- 默认“自动”，使用当前 Agent 的模型；Agent 为自动时使用 `chat` 场景。
- 用户手动选择某个聊天模型时，应传给 `/api/chats/:id/messages`。
- 图像生成接口只使用图像模型；如果对话页手动选择的是聊天模型，图像生成仍回退到 `image` 场景。

中转站 / New API / One API：

- 通常使用 `apiFormat=openai-chat`。
- `base` 可填根地址或 `/v1` 地址，后端会拼接 `/v1/chat/completions`。
- 认证默认 `bearer`，即 `Authorization: Bearer <key>`。
- 只有网关文档明确要求时才改为 `x-api-key`、`api-key` 或自定义 Header。

## 5. Agent 管理与技能联动

小脑瓜里的“Agent 管理”用于配置可切换 Agent：

- `enabled=false` 表示关闭；关闭后在对话页和分身页都不能启动。
- `name` 是显示名。
- `modelId` 是绑定模型；`auto` 表示跟随场景。
- `systemPrompt` 是 Agent 提示词。
- `skillIds` 来自技能中心，只注入当前 Agent 勾选的技能。
- `avatar` 是头像 Data URL；用户可以上传，也可以恢复默认头像。

对话页新建会话上方显示当前 Agent，点击可切换。新建对话会保存当时的 Agent 信息，历史会话打开后应恢复对应 Agent。

## 6. 技能中心

技能中心必须绑定真实文件和真实数据，不要只做 UI 卡片。

- 技能索引：`backend/data/skills.json`
- 本地技能副本：`backend/data/skills-local/`
- 技能可从本地文件夹识别，点击文件夹应能打开对应路径。
- 技能详情应能预览 `SKILL.md` 或 Markdown 简介，并支持编辑。
- 技能启用开关只决定全局默认注入；如果某个 Agent 指定了 `skillIds`，应以 Agent 勾选为准。

## 7. 记忆系统

记忆分为核心记忆和对话记忆。

核心记忆目录：

```text
backend/data/memory/core
```

建议文件：

- `AGENTS.md`：Hermes Agent 身份、行为边界、协作方式
- `PROFILE.md`：用户画像、长期工作方式、沟通偏好
- `PREFERENCES.md`：UI、交互、输出、验收偏好
- `TOOLS.md`：项目工具、路径、接口、数据位置

对话记忆目录：

```text
backend/data/history-md
```

对话记忆是聊天导出的 Markdown 原文，默认不要全量塞入上下文。需要进入模型上下文时，先压缩成结构化摘要，包括：用户目标、关键偏好、已做决策、待办、路径、风险。

用户也可能指定外部记忆文件，例如：

```text
C:\Users\Administrator\.copaw\workspaces\default\memory\2026-03-26.md
D:\某个项目\memory\xxx.md
```

这种情况下以用户指定路径优先，并在 UI 中显示真实文件地址。

## 8. 图像生成

图像生成必须保存真实文件，不要只返回临时 URL。

目录：

- 输入图：`backend/data/images/inputs/YYYY-MM/`
- 输出图：`backend/data/images/outputs/YYYY-MM/`
- 索引：`backend/data/images.json`
- 安全访问：`GET /api/images/file/:id`

当前流程：

1. 用户截图粘贴或上传图片。
2. 前端调用 `POST /api/images/upload` 保存输入图。
3. 对话框显示缩略图。
4. 用户点击“图像”按钮，只插入 `生成图像：`。
5. 默认不跳过 Agent：前端先调用 `POST /api/images/optimize-prompt`，由 Agent 在不改变用户意思的前提下优化提示词。
6. 再调用 `POST /api/images/generate` 生成图片。
7. 如果是二次改图，前端会自动把上一张生成图作为参考图传入；后端允许 `input` 和 `output` 图片都作为编辑输入。
8. 输出图命名使用“日期 + 原始提示词摘要 + 短 id”，例如 `20260513-183005_可爱小猫_outabc.png`。
9. 生成结果以 Markdown 图片回显到对话框，图片悬停显示复制图片和打开所在文件夹图标。

只有“跳过 Agent 直连生图”开启时，才直接用用户提示词调用图片 API。否则必须让 Agent 优化提示词。

## 9. 本地 Markdown 输出与分类

右侧 Markdown 预览只预览已经落盘的输出文件，不直接把普通聊天内容当成文件预览。

数据来源：

- 聊天归档：`backend/data/history-md/`
- Agent 输出文章、报告、方案、教程等：默认 `backend/data/output-md/` 或设置里的 `mdLibraryDir`
- 文件内容读取：`GET /api/system/file-content?path=...`
- 图片/二进制预览：`GET /api/system/file-raw?path=...`
- 文件树：`GET /api/system/files?dir=...`

分类策略：

- “全部”：按更新时间倒序。
- “按类型”：读取 frontmatter 的 `type`，没有则根据路径、文件名、正文关键词推断。
- “按文件夹”：用户新建一级文件夹即可成为分类。
- “按标签”：读取 frontmatter 的 `tags` 或 `tag`。

推荐 Markdown frontmatter：

```md
---
title: Hermes 语雀接入方案
type: 方案
tags: [语雀, API, 知识库]
summary: 用后端代理安全同步语雀知识库
created: 2026-05-13
---
```

## 10. 语雀与第三方 API

语雀绑定属于知识库 / 工具集成，不是模型 Provider，也不应该放在频道网关里混用。

安全规则：

- 不要在聊天、Markdown、日志、截图里输出真实 Token、API Key、Cookie、Password。
- 不要执行 `curl | bash`、`curl | sh`、`curl | python`。
- 调试接口优先走后端代理，例如未来的 `/api/integrations/yuque/*`。
- 如果用户曾经在聊天中贴过 Token，应建议用户轮换 Token。

推荐接入流程：

1. 在设置页保存 `baseUrl`、`authType`、`token`、`userId`。
2. Token 只保存在本机数据文件，不回显原文。
3. 后端测试连接，返回状态、账号名和错误摘要。
4. 获取知识库列表，让用户勾选同步。
5. 同步内容写入 `backend/data/knowledge/yuque/` 或用户指定目录。
6. 对话调用知识库时只注入必要摘要。

## 11. AgentAsk 弹窗

当 Agent 需要用户选择或确认时，优先输出结构化 `<ask_user>`，不要把选择题写成普通文本。

推荐格式：

```xml
<ask_user>
{
  "title": "需要你确认",
  "questions": [
    {
      "question": "请选择处理方式",
      "multiSelect": false,
      "options": [
        {"label": "继续执行", "description": "按当前方案继续"},
        {"label": "先暂停", "description": "等待更多信息"}
      ]
    }
  ]
}
</ask_user>
```

如果有“其他”，允许用户不填内容也能提交。单选题选择后可自动进入下一题，多选题由用户手动进入下一步。

## 12. 项目验收清单

- `/api/health` 正常。
- `/api/chats` 返回 WebUI 对话，内容脱敏。
- `/api/cli/sessions` 返回 CLI 历史，失败时不阻塞 WebUI。
- 普通对话走 Hermes Agent，不直连模型。
- 模型选择能传到后端，Agent 模型和场景模型逻辑一致。
- 图像生成默认先 Agent 优化提示词，再调用图像模型；跳过 Agent 开关生效。
- 粘贴截图不会清空输入框文本。
- 生成图能预览、复制、打开所在文件夹。
- 设置文件页能展开目录树，右侧能预览 Markdown、文本和图片。
- 小脑瓜记忆显示真实路径，编辑有取消。
- 技能中心能识别本地技能文件并预览 Markdown。
- 深色 / 浅色模式使用 CSS 变量，不硬编码大面积颜色。
- 敏感字段必须脱敏。

## 13. 目录与样式修改指南

正式入口：

- 正式页面：`index.html`
- 正式前端逻辑：`app-new.js`
- 后端入口：`backend/server.js`
- Markdown / Artifact 预览组件：`frontend/js/hermes-artifact.js`
- 旧 UI：`frontend/index.html` 及旧模块化前端不要重新接入，除非用户明确要求迁移。

前端修改位置：

- 全局 CSS 变量、布局、组件样式：`index.html` 的 `<style>`。
- 页面渲染、状态、事件、API 调用：`app-new.js`。
- 对话页：`renderChat()`、`sendMessage()`、`selectChat()`、`renderSessionList()`、`enhanceMessageMarkdown()`。
- 图像上传和生成：`saveImageFiles()`、`sendImageGenerationMessage()`、`directImageContext()`。
- 小脑瓜 / 技能中心：`renderSkillCenter()`、`renderSkills()`、`renderMemory()`、`renderProfilesV2()`。
- Agent 管理：`profileModal()`、`doAddProfileV2()`、`doEditProfileV2()`、`profileAvatarHtml()`。
- 设置页：`renderSettingsPage()`、`renderModels()`、`renderFiles()`、`renderUsage()`。
- 文件树和预览：`buildFilesViewHtml()`、`buildFilesHtml()`、`toggleFileFolder()`、`viewFileAbs()`。

后端修改位置：

- 路由注册：`backend/server.js`
- 对话和 Agent 流式调用：`backend/routes/chat.js`
- CLI 历史读取：`backend/routes/cli.js`
- 模型配置、获取、测试、场景：`backend/routes/models.js`
- 设置：`backend/routes/settings.js`
- 技能：`backend/routes/skills.js`
- 记忆：`backend/routes/memory.js`、`backend/services/memory.js`
- 图像上传、提示词优化、生成、图片文件访问：`backend/routes/images.js`
- 文件树、文件预览、打开文件夹、Markdown 输出库：`backend/routes/system.js`
- 用量统计：`backend/routes/usage.js`
- Hermes CLI 调用：`backend/services/hermes.js`
- 模型 / Agent 流统一入口：`backend/services/llm.js`
- JSON 持久化：`backend/services/store.js`
- 脱敏：`backend/services/security.js`

数据目录：

- `backend/data/chats.json`：WebUI 对话。
- `backend/data/models.json`：模型库和场景选择。
- `backend/data/settings.json`：全局设置，包括 API 地址和 Markdown 输出库目录。
- `backend/data/skills.json`：技能索引。
- `backend/data/skills-local/`：本地技能内容。
- `backend/data/images.json`：图片索引。
- `backend/data/images/inputs/YYYY-MM/`：上传和粘贴的图片。
- `backend/data/images/outputs/YYYY-MM/`：生成图片。
- `backend/data/history-md/`：聊天 Markdown 归档。
- `backend/data/output-md/`：Agent 输出文章/报告/方案的默认库。
- `backend/data/memory/core/`：核心记忆文件。

颜色变量规范：

- `--c-primary`：主按钮、主色块、关键强调。
- `--c-on-primary`：主按钮上的文字或图标。
- `--c-ink`：标题、主要正文、重要图标。
- `--c-ink-muted`：辅助说明、路径、时间、二级信息。
- `--c-canvas`：页面最底层背景。
- `--c-surface1`：卡片、弹窗、输入框、一级面板。
- `--c-surface2`：二级面板、轻背景、悬浮块。
- `--c-hairline`：普通分割线和边框。
- `--c-hairline-soft`：弱分割线、轻边框。
- `--c-accent`：当前主题强调色。
- `--c-accent-soft`：悬停背景、轻选中。
- `--c-accent-muted`：选中背景、较强提示。
- `--c-success`：成功状态。
- `--c-error`：错误和危险操作。
- `--c-warning`：警告状态。
- `--c-overlay`：遮罩。
- `--c-input-bg`：对话输入框背景。

间距和圆角：

- 圆角变量：`--r-xs`、`--r-sm`、`--r-md`、`--r-lg`、`--r-xl`、`--r-pill`、`--r-full`。
- 间距变量：`--s-xxs`、`--s-xs`、`--s-sm`、`--s-md`、`--s-lg`、`--s-xl`、`--s-xxl`。
- 常规按钮和小卡片优先用 `--r-sm` 或 `--r-md`。
- 大弹窗、预览框、主要卡片优先用 `--r-lg`。
- 头像、开关滑块用 `--r-full`。

交互风格：

- 悬停不要过重，优先使用 `background: var(--c-accent-soft)`。
- 选中状态优先使用背景色和轻边框，不要默认加粗黑描边。
- 深色模式下标题用 `--c-ink`，正文和说明用 `--c-ink-muted`。
- 弹窗、菜单、确认框都使用自定义 UI，不使用浏览器原生 `confirm`。
- 图片预览使用遮罩，图片居中，无额外描边；点击图片切换 100% 和适配大小，右上角关闭。
- 文件、图片、Markdown 相关按钮要能显示真实路径或打开所在文件夹。

修改检查：

```powershell
node --check app-new.js
node --check backend/routes/images.js
node --check backend/routes/system.js
node --check backend/routes/chat.js
git diff --check
```

如果浏览器自动化不可用，至少用接口和语法检查兜底；可用时再打开 `http://127.0.0.1:8787/` 做视觉验收。

## 14. 维护约定

只要修改了模型、图片、文件目录、记忆、技能、Agent 管理、自保护、第三方 API、安全边界中的任何机制，就同步更新本指南。这样用户把项目交给新的 Agent 时，不需要重新解释整套 WebUI 的运行方式。
