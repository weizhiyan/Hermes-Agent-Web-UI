# Hermes Agent WebUI Introduction

Hermes Agent WebUI 是一个运行在本地的 Agent 工作台。它不是一个单纯的聊天页面，而是围绕 Hermes Agent 构建的可视化控制层：把对话、模型、技能、记忆、文件、Markdown 预览、图像生成和本地历史组织到一个统一界面里。

它的目标很简单：让 Agent 继续保持真实执行能力，同时把日常使用体验做得更直观、更可控、更适合长期工作。

## What It Is

Hermes Agent WebUI 由一个轻量前端和一个本地 Node.js 后端组成。

- 前端负责 Web 交互、对话渲染、文件预览、模型/技能/Agent 管理。
- 后端负责保存本地数据、连接 Hermes Agent CLI、管理模型配置、处理图片和文件接口。
- 普通对话默认经过 Hermes Agent，而不是绕过 Agent 直接请求模型。

这种设计让 WebUI 更像一个“本地 Agent 控制台”，而不是只能发送消息的壳。

## Key Features

### Agent Chat

对话页面支持 WebUI 会话和 Hermes CLI 历史会话统一查看。WebUI 会话可以继续对话、删除、归档；CLI 会话作为只读快照展示，避免误改终端历史。

对话支持：

- 流式回复。
- 思考过程展示。
- 工具调用状态展示。
- 终止当前任务。
- Markdown 渲染和表格滚动。
- 图片预览、复制图片、打开所在文件夹。

### Agent Management

WebUI 内置 Agent 管理能力。每个 Agent 可以配置：

- 名称。
- 头像。
- 启用 / 关闭状态。
- 默认模型。
- Agent 提示词。
- 可用技能。

对话页面可以切换当前 Agent，新建会话会记录当时使用的 Agent。

### Model Configuration

模型配置以 Provider 为核心组织，支持从远程接口获取模型、测试连接、加入模型库，并按场景选择模型。

当前核心场景包括：

- 普通对话。
- 深度推理。
- 图像生成。

模型库是共享的，一个模型可以用于多个场景或多个 Agent。

### Skill Center

技能中心用于管理本地技能。技能可以来自本地文件夹，也可以通过 WebUI 导入和编辑。

技能中心支持：

- 技能启用开关。
- 技能 Markdown 预览。
- 技能文件查看和编辑。
- 与 Agent 管理联动，为不同 Agent 选择不同技能。

### Memory Storage

记忆系统分为核心记忆和对话记忆。

- 核心记忆保存长期偏好、身份、工具和项目规则。
- 对话记忆保存聊天归档，并可进一步压缩成更适合上下文注入的摘要。

WebUI 会显示真实文件路径，方便迁移和排查。

### Local Files And Markdown Preview

设置页的文件系统支持目录树浏览和右侧预览。

支持预览：

- Markdown。
- 文本文件。
- 图片文件。

右侧 Markdown 预览主要用于已经落盘的本地输出文件，而不是把普通聊天内容误认为文件。

### Image Generation

图像生成不是临时 URL 展示，而是完整的本地文件链路。

流程：

1. 用户上传或粘贴图片。
2. WebUI 保存输入图到本地。
3. 用户输入 `生成图像：` 或点击图像按钮。
4. 默认先由 Agent 在不改变用户意图的前提下优化提示词。
5. 后端调用图像模型生成图片。
6. 输出图片保存到本地并回显到对话框。

如果用户开启“跳过 Agent”，WebUI 会直接使用用户提示词调用图像模型。

### AgentAsk

AgentAsk 是 WebUI 的交互式提问机制。当 Agent 需要用户选择、确认或补充信息时，可以触发结构化弹窗，而不是把选择题写成普通文本。

它支持：

- 单选。
- 多选。
- 多题 tab。
- 其他输入。
- 选项说明文案。
- 回答后自动写回对话并继续执行。

## Data And Privacy

Hermes Agent WebUI 默认把运行数据保存在本地：

- 会话：`backend/data/chats.json`
- 模型：`backend/data/models.json`
- 设置：`backend/data/settings.json`
- 技能：`backend/data/skills.json`
- 图片索引：`backend/data/images.json`
- 图片文件：`backend/data/images/`
- 记忆：`backend/data/memory/`
- Markdown 输出：`backend/data/output-md/`

项目不会把 `backend/data` 作为静态目录直接开放。图片和文件访问通过后端安全接口处理。

## Project Structure

```text
Hermes Agent/
├── index.html              # WebUI shell and styles
├── app-new.js              # Frontend application logic
├── backend/
│   ├── server.js           # Express backend entry
│   ├── routes/             # REST and SSE routes
│   ├── services/           # Hermes, model, memory and storage services
│   └── data/               # Local runtime data
├── frontend/js/
│   └── hermes-artifact.js  # Markdown / artifact preview panel
├── docs/                   # Project documentation
└── 一键启动.bat             # Windows launcher
```

## Quick Start

Windows:

```bat
一键启动.bat
```

Manual:

```powershell
cd backend
npm install
node server.js
```

Then open:

```text
http://127.0.0.1:8787/
```

## Who It Is For

Hermes Agent WebUI is designed for users who want:

- A local-first Agent workspace.
- Better visual control over model, skill and memory configuration.
- A safer bridge between CLI Agent workflows and browser-based interaction.
- A reusable WebUI that can be moved to another computer and adapted by a new Agent.

## Documentation

- [Documentation Index](./README.md)
- [API Reference](./API_REFERENCE.md)
- [AI Handoff Guide](./AI_HANDOFF_GUIDE.md)
- [AgentAsk Acceptance Guide](./ACCEPTANCE_AGENTASK.md)
