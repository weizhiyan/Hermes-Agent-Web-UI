# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地优先的 AI 工作台，围绕聊天、模型配置、Agent Profile、技能、记忆、图片生成、Markdown 预览和历史归档设计。

默认访问地址：

```text
http://127.0.0.1:3381/
```

## 快速开始

Windows 用户推荐：

1. 安装 Node.js 18+。
2. 第一次使用双击 `install.bat`，它会检查环境、安装依赖，并询问是否直接启动。
3. 日常使用双击 `start.bat`。
4. 打开 `http://127.0.0.1:3381/`。

如果需要手动启动：

```powershell
npm install
npm start
```

## 主要功能

- 流式 AI 对话。
- 普通聊天直连模型 API，复杂任务自动切换 Hermes Agent。
- 模型 Provider / Base URL / API Key 管理。
- 模型测速与失败回退模型配置。
- Agent Profile 与按需 Skill 注入。
- 核心记忆、用户偏好和 Agent 规则注入。
- 图片上传、图片生成和图生图工作流。
- Markdown / Artifact 预览。
- 对话历史 Markdown 归档。
- 外部数据目录配置，方便迁移和备份。
- 命令执行安全策略和审批日志。

## 本地数据目录

建议在设置中配置外部数据目录，例如：

```text
D:\\HermesData
```

推荐结构：

```text
core
skill
images
history-md
output-md
```

这样更新 WebUI 代码时，不会影响个人记忆、图片和输出文档。换电脑或换硬盘时，只需要在设置页重新指向新路径。

## 安装与更新

- 安装说明：`docs/INSTALLATION.md`
- WebUI 介绍：`docs/WEBUI_INTRO.md`
- 优化说明：`docs/OPTIMIZATION_NOTES.md`
- Skill 逻辑：`docs/技能中心逻辑说明.md`

如果项目来自 GitHub，可以在设置页的“更新中心”点击“检查远端 / 安全更新”，也可以关闭 WebUI 后双击 `update.bat`。

`update.bat` 会先检查 Git、Node.js、npm、本地改动和远端连接；如果公司电脑拦截 GitHub 或 npm，会在窗口里显示更明确的失败原因。

也可以手动执行：

```powershell
git pull --ff-only
npm install
```

## 默认端口

```text
3381
```

健康检查：

```text
http://127.0.0.1:3381/api/health
```

