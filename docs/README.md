# Hermes Agent Documentation

这是 Hermes Agent WebUI 的文档入口。为了方便发布到 GitHub，项目说明、API、AI 接手规则和验收材料都集中在 `docs/` 下。

## 文档目录

- [API_REFERENCE.md](./API_REFERENCE.md)：后端 API、SSE 事件和对接协议。
- [WEBUI_INTRODUCTION.md](./WEBUI_INTRODUCTION.md)：适合放在 GitHub 上的 WebUI 项目介绍。
- [AI_HANDOFF_GUIDE.md](./AI_HANDOFF_GUIDE.md)：给后续 AI / Agent 接手项目用的总指南，包含自保护、跨电脑适配、模型、技能、记忆、图像生成、语雀、安全和样式规范。
- [ACCEPTANCE_AGENTASK.md](./ACCEPTANCE_AGENTASK.md)：AgentAsk 弹窗验收指南。
- [archive/DESIGN_REFERENCE.md](./archive/DESIGN_REFERENCE.md)：旧设计参考归档。
- [archive/PROJECT_SUMMARY_v0.01.md](./archive/PROJECT_SUMMARY_v0.01.md)：早期项目总结归档。

## 维护规则

- 根目录只保留 `README.md` 作为 GitHub 首页入口。
- 新增长期文档优先放进 `docs/`。
- 过期设计、旧方案、历史总结放进 `docs/archive/`。
- 运行数据、聊天导出、模型数据、图片索引不要放进 `docs/`，它们属于 `backend/data/`。
- 修改 WebUI 机制后，同步更新 [AI_HANDOFF_GUIDE.md](./AI_HANDOFF_GUIDE.md)。
