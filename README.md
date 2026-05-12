# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地 Web 交互层，用于连接 Hermes Agent、管理模型/技能/记忆/文件，并支持对话、分身、Markdown 预览和图像生成。

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

打开 `http://127.0.0.1:8787/`。

## Documentation

项目文档统一放在 [docs](./docs/)：

- [Documentation Index](./docs/README.md)
- [API Reference](./docs/API_REFERENCE.md)
- [AI Handoff Guide](./docs/AI_HANDOFF_GUIDE.md)
- [AgentAsk Acceptance Guide](./docs/ACCEPTANCE_AGENTASK.md)

归档资料在 [docs/archive](./docs/archive/)。

## Main Entry Points

- Frontend shell and styles: `index.html`
- Frontend logic: `app-new.js`
- Backend entry: `backend/server.js`
- Runtime data: `backend/data/`
