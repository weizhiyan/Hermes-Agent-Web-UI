# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地优先的 AI 工作台，用于在浏览器里管理 AI 对话、模型、Agent Profile、Skill、记忆、图片生成、Markdown 输出和本地任务执行。

默认访问地址：

```text
http://127.0.0.1:3381/
```

> 隐私说明：项目文档只使用通用示例路径，不包含个人电脑路径、账号、密钥或私有数据。建议把记忆、图片和输出文件放在项目目录外部，便于更新、备份和迁移。

<p align="center">
  <img width="1918" height="924" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/a5dd440e-4eec-497f-a303-8638db7bd47d" />
  <img width="1918" height="921" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/9efa00c4-251b-4bf9-ad24-95a9d0f9835e" />
  <img width="1916" height="917" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/d206fbcc-38c9-4a07-ba57-c2b355e52e7f" />
  <img width="1915" height="910" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/ab5ab8cf-f9da-4e47-b881-60c1a4749581" />
  <img width="1921" height="920" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/e1eb3eb0-cbe2-48b4-ac3e-b8a740c7557f" />
  <img width="1917" height="912" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/63fd03c9-f71e-4541-aa4b-ac71afeb5faa" />
</p>

## 主要能力

- **流式对话**：支持实时输出、执行过程展示和首包耗时观察。
- **智能路由**：普通聊天优先直连模型，复杂文件、命令、代码任务可走 Hermes Agent。
- **模型管理**：支持 Provider、Base URL、认证方式、模型库、场景模型和失败回退模型。
- **模型测速**：记录首包时间和总耗时，可一键选择最快普通聊天模型。
- **Agent Profile**：为不同角色配置模型、系统提示词和绑定 Skill。
- **Skill 按需注入**：根据用户问题匹配相关 Skill，减少无关 Prompt 干扰。
- **记忆注入**：支持核心记忆、用户偏好、Agent 规则和轻量知识库检索。
- **图片工作流**：支持图片上传、图片生成、图生图和统一图片目录管理。
- **Markdown / Artifact**：支持长文、教程、方案、报告等内容预览和输出归档。
- **安全审批**：高风险命令默认需要确认，危险命令会被拦截并记录日志。
- **更新中心**：检查本地 Git 状态和远端更新，不自动覆盖本地文件。
- **备份导出**：导出设置、模型配置、Skill、聊天索引和数据目录清单，敏感字段自动脱敏。

## 快速开始

### Windows

推荐直接双击：

```bat
start.bat
```

或使用 PowerShell：

```powershell
.\start.ps1
```

首次启动如果缺少依赖，可以手动执行：

```powershell
npm install
npm start
```

启动后打开：

```text
http://127.0.0.1:3381/
```

### Linux / macOS

```bash
npm install
npm start
```

## 安装方式

从 GitHub 克隆：

```bash
git clone https://github.com/weizhiyan/Hermes-Agent-Web-UI.git
cd Hermes-Agent-Web-UI
npm install
npm start
```

如果不熟悉 Git，也可以在 GitHub 页面点击：

```text
Code → Download ZIP
```

这种方式下载的是当前最新版。

## 版本与历史版本

- 仓库主页默认显示 `main` 分支，也就是当前最新版。
- `Code → Download ZIP` 下载的是最新版源码。
- 如果想下载旧版本，请进入 GitHub 的 `Tags` 或 `Releases`，选择对应标签，例如 `v1.1.0`、`v1.2.0`、`v1.3.0`。

使用 Git 切换历史版本：

```powershell
git fetch --tags
git checkout v1.2.0
npm install
```

回到最新版：

```powershell
git checkout main
git pull --ff-only
npm install
```

## 更新 WebUI

如果你是通过 Git 克隆的项目，可以双击：

```bat
update.bat
```

或手动执行：

```powershell
git pull --ff-only
npm install
```

更新后重启 WebUI。

设置页里的“更新中心”可以检查：

- 当前分支
- 当前提交
- 当前标签
- 本地是否有改动
- 远端是否有新版本

更新中心只做检测，不会自动执行 `git pull`，避免覆盖本地修改。

## 数据目录建议

建议把长期数据放在项目目录外部，例如：

```text
D:\HermesData
```

推荐结构：

```text
D:\HermesData\memory
D:\HermesData\skill
D:\HermesData\images
D:\HermesData\history-md
D:\HermesData\output-md
D:\HermesData\backups
```

这样做的好处：

- 更新 WebUI 代码时不会影响长期数据。
- 换电脑时只需要复制数据目录。
- 备份更简单。
- 不会把个人记忆、图片、历史输出误提交到 GitHub。

## 配置入口

打开 WebUI 后，在设置页可以配置：

- 数据根目录
- 记忆目录
- 图片目录
- 历史归档目录
- Markdown 输出库目录
- 模型 Provider / Base URL / API Key
- Agent 路由策略
- 工具权限与安全策略

API Key、Token、密码等敏感信息只应保存在本地，不要提交到 GitHub。

## 端口

默认端口统一为：

```text
3381
```

健康检查：

```text
http://127.0.0.1:3381/api/health
```

## 文档

- `docs/INSTALLATION.md`：安装、更新和版本切换说明。
- `docs/WEBUI_INTRO.md`：WebUI 功能、逻辑和使用方式介绍。
- `docs/OPTIMIZATION_NOTES.md`：当前优化点和后续方向。
- `CHANGELOG.md`：版本更新记录。

## 安全建议

- 不要把 API Key、Token、密码写进公开文档。
- 不要把个人记忆目录、图片输出目录、聊天历史提交到 GitHub。
- 高风险命令执行前建议保持弹窗确认开启。
- 更新前建议先使用“一键备份导出”。
