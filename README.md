# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地优先的 AI 工作台，围绕聊天、模型配置、Agent Profile、技能、记忆、图片生成、Markdown 预览和历史归档设计。

## 快速开始

Windows 用户：

1. 安装 Node.js 18+。
2. 双击 `start.bat`。
3. 打开 `http://127.0.0.1:3381/`。

首次启动会自动安装后端依赖。

## 主要功能

- 流式 AI 对话。
- 模型 Provider / Base URL / API Key 管理。
- Agent Profile 与技能注入。
- 核心记忆和 Agent 规则。
- 图片上传、图片生成和图生图工作流。
- Markdown / Artifact 预览。
- 对话历史 Markdown 归档。
- 外部数据目录配置，方便迁移和备份。

## 本地数据目录

建议在设置中配置外部数据目录，例如：

```text
F:\AI\Hermes Agent\记忆
```

默认结构：

```text
memory
images
history-md
output-md
```

这样更新 WebUI 代码时不会影响个人记忆、图片和输出文档。

## 安装与更新

- 安装说明：`docs/INSTALLATION.md`
- WebUI 介绍：`docs/WEBUI_INTRO.md`
- 优化说明：`docs/OPTIMIZATION_NOTES.md`
- Git 更新：双击 `update.bat`

## 默认端口

```text
3381
```

健康检查：

```text
http://127.0.0.1:3381/api/health
```
