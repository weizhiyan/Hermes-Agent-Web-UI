# 设计文档：WebUI 文档编辑联动 + Agent Dock 稳定性修复

## 概述

**功能名称：** 文档编辑联动与 Agent Dock 状态修复  
**目标：** 让左侧 Agent 对右侧 Markdown 文档的编辑更可靠、更可见、更适合高频操作；同时修复普通对话下 Agent Dock 高亮残留。  
**优先级：** P0

## 背景

当前 WebUI 已有右侧知识库/Artifact 文档预览、源码编辑、局部编辑入口，以及左侧聊天上下文 chip。但高频场景下还缺少稳定闭环：

- Agent 知道当前文档，但不够强制写回真实文件。
- Agent 完成后，右侧文档不会可靠自动刷新。
- 用户看不出文件是否被改、改了哪里。
- 局部编辑缺少文件路径、行号、选区预览等上下文。
- 从 Agent 主对话切回普通对话时，dock/activeProfile 容易残留高亮。

## 方案

采用「最小但稳定闭环」方案，不做大重构，不引入重型编辑器，优先保证高频操作稳定：

1. 后端增加安全的 Markdown 文档读写/状态接口。
2. 前端 Artifact 模块维护当前文档快照。
3. 发送消息时把当前文档上下文明确注入 prompt，要求修改真实文件。
4. SSE onDone 后检测当前文件 mtime/hash/内容变化。
5. 变化后自动刷新右侧文档，并显示绿色 diff 高亮提示。
6. 局部编辑弹窗补齐文件路径、行号、选区预览、多步骤指令。
7. selectChat 统一处理普通对话/固定 Agent 主对话的 activeProfile，修 dock 残留。

### 架构

```
左侧聊天 sendMessage
  -> activeArtifactContext()
  -> 注入当前 Markdown 文件路径/标题/选区/行号
  -> 后端 /api/chats/:id/messages SSE
  -> Agent 工具写回文件
  -> SSE done
  -> 前端 checkArtifactFileChanged()
  -> /api/knowledge/file?path=...
  -> 刷新右侧预览/源码
  -> 显示 diff 高亮/保存状态
```

### 组件

- **backend/routes/knowledge.js**
  - 新增文档读写/状态接口。
  - 限制路径只能在 `paths.mdLibraryRoot()` 内。
  - 返回 content、mtime、size、hash、path。

- **frontend/js/hermes-artifact.js**
  - 暴露当前 Markdown 上下文：path/title/size/selection/lineStart/lineEnd/snapshot。
  - 增加文档状态快照与刷新函数。
  - Agent 完成后可被 app-new.js 调用检查文件变化。
  - 提供绿色 diff/changed 行临时高亮。

- **app-new.js**
  - sendMessage 注入文档编辑上下文。
  - SSE onDone 调用 Artifact 文件变更检测。
  - selectChat 修复普通对话 activeProfile/default 状态。
  - Agent Dock active 只由当前 chat 是否固定 Agent 主对话决定。

## 数据流

### 普通文档编辑

```
用户打开右侧 Markdown
  -> HermesArtifact.getCurrentMarkdownContext()
  -> 用户对左侧 Agent 说“改一下第二段”
  -> sendMessage 附加：文件路径、标题、当前选区、行号、必须写回真实文件
  -> Agent 使用文件工具改文件
  -> onDone 检测文件 hash/mtime 变化
  -> 自动刷新文档
  -> toast + 绿色高亮变更区域
```

### 局部编辑

```
用户选中一段文字
  -> 点击局部编辑
  -> 弹窗显示：文件路径、行号、选中内容预览、多步骤输入框
  -> 提交后左侧输入框填充结构化编辑指令
  -> Agent 执行
  -> onDone 刷新 + 高亮
```

### Agent Dock

```
selectChat(id)
  -> 如果 isFixedAgentMainChat(chat): activeProfile = chat.agentId
  -> 否则 activeProfile = 'default'
  -> save + renderPage
  -> renderAgentDock 只高亮固定 Agent 主对话
```

## 约束

- 不修改 API 请求地址，不能改成 `http://172.27.96.1:3381/v1`。
- 只服务当前 root WebUI：`index.html + app-new.js + frontend/js/hermes-artifact.js`。
- 不恢复旧 frontend/ 作为主 UI。
- Codex 在当前 WSL 不可用，主要使用 Claude Code + Hermes 自检。
- 大文件编辑要避免整文件误伤；优先小 patch、保留现有风格。
- 路径读写必须限制在 Markdown 库根目录内，防止路径穿越。
- onDone 检测必须容错：Agent 没改文件时不报错，只提示未检测到文件变化或静默。

## 成功标准

- [ ] 打开右侧 Markdown 后，左侧输入区显示当前文档 chip。
- [ ] 发送编辑请求时，Agent prompt 明确包含真实文件路径与“必须写回文件”。
- [ ] Agent 修改文件后，SSE done 自动刷新右侧文档。
- [ ] 改动后显示绿色 diff/changed 行高亮，数秒后自动淡出。
- [ ] 局部编辑弹窗显示文件路径、行号、选中内容预览。
- [ ] 局部编辑支持多步骤指令输入，不只是一句 prompt。
- [ ] 普通对话不再保留 Agent Dock 高亮；固定 Agent 主对话才高亮对应 Agent。
- [ ] `node --check app-new.js` 通过。
- [ ] `node --check frontend/js/hermes-artifact.js` 通过。
- [ ] `node --check backend/routes/knowledge.js` 通过。
- [ ] smoke test：`/api/health`、首页、`/api/knowledge/markdown` 或等价接口可用。

## 执行策略

1. 先让 Claude Code 实现：后端文档接口 + 前端联动 + Dock 修复。
2. Hermes 主控做 diff review、语法检查、接口 smoke test。
3. 如 review 发现问题，再让 Claude Code 或 Hermes 小范围修复。

---

*批准日期：2026-06-01*
