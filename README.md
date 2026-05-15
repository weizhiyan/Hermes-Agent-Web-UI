# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地优先的 AI WebUI，重点围绕 **聊天、预览、记忆、技能、分身和模型管理** 来设计。
<img width="1918" height="924" alt="image" src="https://github.com/user-attachments/assets/a5dd440e-4eec-497f-a303-8638db7bd47d" />
<img width="1918" height="921" alt="image" src="https://github.com/user-attachments/assets/9efa00c4-251b-4bf9-ad24-95a9d0f9835e" />



它不是一个简单聊天框，而是一个能把对话内容、Markdown 文档、历史文件、思考过程、工具调用和模型配置放在同一套界面里的工作台。

## 核心功能

- **聊天区**：发送消息、连续对话、流式显示回复。
- **思考与工具**：单独显示思考过程和工具调用，方便看模型怎么做决定。
- **Markdown 预览**：右侧直接预览模型生成的 Markdown、Artifact 和历史文件。
- **文件查看**：快速打开本地 Markdown、导出内容和历史记录。
- **记忆管理**：区分核心记忆和对话记忆，便于长期使用。
- **技能与分身**：按场景切换技能、Agent 和系统提示词。
- **模型配置**：管理 Provider、Base URL、API Key 和当前模型。

## 页面里有什么

- 一个偏黑白极简的界面，默认优先浅色模式。
- 一个聊天区，保留类似 Codex / Claude 的消息流体验。
- 一个右侧预览区，用来查看 Markdown 和历史文件。
- 一个左侧会话区，用来切换历史对话和终端会话。
- 一套简单的安装方式，Windows、PowerShell、Shell、Docker 都能跑。
- 一份版本历史，方便你知道每次更新了什么。

## 亮点

- 黑白极简风格，优先浅色模式。
- 右侧 Markdown / Artifact 预览，支持历史文件和版本切换。
- 对话流式输出、思考块、工具调用块统一展示。
- 支持 `.env`、Docker Compose、Windows / PowerShell / Shell 一键启动。
- 版本化发布，适合按 `v1.0.0`、`v1.0.1` 这种方式打包下载。

## 当前版本

- 当前版本：`v1.0.0`
- 版本记录：[`CHANGELOG.md`](CHANGELOG.md)

## 适合谁

- 想要一个本地可控的 AI WebUI 的人。
- 想保留对话、文件、记忆和版本历史的人。
- 想在另一台电脑上快速复制同一套环境的人。
- 想要界面尽量简单、少折腾的人。

## 推荐下载方式

- 每个稳定版本打一个 GitHub Release。
- Release 附带一个压缩包，方便在其他电脑直接解压运行。
- 每个版本只写这版改了什么，历史版本保留在 `CHANGELOG.md`。

## 快速开始

1. 安装 `Node.js 18+`。
2. 解压项目到一个普通文件夹。
3. Windows 直接双击 `start.bat`。
4. 打开 `http://127.0.0.1:8787/`。

如果你用 PowerShell / Linux / Docker，细节见 `docs/INSTALLATION.md`。

## 安装与部署

更完整的安装、迁移和健康检查说明见：[`docs/INSTALLATION.md`](docs/INSTALLATION.md)

## 使用流程

1. 打开网页。
2. 输入消息并发送。
3. 等待模型流式回复。
4. 查看右侧 Markdown / Artifact 预览。
5. 需要时切换会话、文件、记忆、技能或模型。
