# Hermes Agent WebUI

本地优先的 Hermes WebUI，面向对话、文件预览、记忆、技能与分身协作。

## 亮点

- 黑白极简风格，优先浅色模式。
- 右侧 Markdown / Artifact 预览，支持历史文件和版本切换。
- 对话流式输出、思考块、工具调用块统一展示。
- 支持 `.env`、Docker Compose、Windows / PowerShell / Shell 一键启动。
- 版本化发布，适合按 `v1.0.0`、`v1.0.1` 这种方式打包下载。

## 当前版本

- 当前版本：`v1.0.0`
- 版本记录：[`CHANGELOG.md`](CHANGELOG.md)

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

## 文件结构

- `index.html`：前端壳和样式
- `app-new.js`：前端主逻辑
- `backend/server.js`：后端入口
- `backend/data/`：运行数据
- `frontend/css/hermes-theme-vars.css`：可手改的主题变量
- `.env`：可选运行配置，和启动脚本、Docker Compose 共用

## 发布约定

- 主分支保留最新稳定开发内容。
- 每次大版本单独打 tag，例如 `v1.1.0`。
- GitHub Release 以 tag 为准，附带版本压缩包和改动说明。
