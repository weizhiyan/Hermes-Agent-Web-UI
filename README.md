# Hermes Agent WebUI
<img width="2252" height="1277" alt="Clipboard - 2026-05-31 13 18 57" src="https://github.com/user-attachments/assets/4d66ae8a-d3d0-4ba7-b030-b2588d43a46e" />
<img width="2545" height="1415" alt="Clipboard - 2026-05-31 13 20 17" src="https://github.com/user-attachments/assets/b2cf3dcf-a439-4a9b-993b-45b54204e521" />
<img width="2544" height="1418" alt="image" src="https://github.com/user-attachments/assets/da94f243-b5eb-486d-8144-7a398163e40b" />
<img width="2546" height="1418" alt="image" src="https://github.com/user-attachments/assets/d3903248-6f3f-4e4b-9a02-b4dafcea5fdc" />

Hermes Agent WebUI 是一个本地优先的 AI 工作台，围绕聊天、模型配置、Agent Profile、技能、记忆、图片生成、Markdown 预览和历史归档设计。

默认访问地址：

```text
http://127.0.0.1:3381/
```

## 快速开始

Windows 用户推荐：

1. 安装 Node.js 18+。
2. 双击 `start.bat`。
3. 打开 `http://127.0.0.1:3381/`。

首次启动会自动安装后端依赖。如果需要手动启动：

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

如果项目来自 GitHub，可以双击 `update.bat` 或手动执行：

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

