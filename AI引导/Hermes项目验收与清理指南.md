# Hermes 项目验收与清理指南

这份文档给后续接手 Hermes Agent WebUI 的 AI 使用，目标是避免重复启用旧 UI、误删用户数据，或让前后端状态不一致。

## 当前 UI 入口

- 正式入口是项目根目录的 `index.html`。
- 正式前端逻辑是项目根目录的 `app-new.js`。
- 根页面只应保留 `frontend/js/hermes-artifact.js` 作为 Markdown / Artifact 预览面板。
- `frontend/index.html`、`frontend/css/*`、除 `frontend/js/hermes-artifact.js` 外的旧模块化前端都属于旧 UI，不应重新接入。

## 验收重点

- 对话页左侧应同时显示 WebUI 对话和 Hermes CLI 终端会话。
- CLI 终端会话是只读快照，可以查看和从 WebUI 隐藏，但不能改名、置顶或写回原 CLI 历史。
- WebUI 对话可以删除、改名、置顶，并自动导出脱敏 Markdown。
- 历史记录弹窗和历史页面都应提供删除/隐藏入口，不能只靠多选批量处理。
- 如果当前选中 CLI 只读会话并发送新消息，应该自动新建 WebUI 对话。
- 敏感字段必须脱敏：`X-Auth-Token`、`Authorization: Bearer`、`api_key`、`token`、`secret`、`password`、`sk-*`。

## 后端验收

- `/api/health` 返回正常，且响应头禁用缓存。
- `/api/chats` 返回 WebUI 对话列表，预览内容已脱敏。
- `/api/chats/:id` 返回完整对话，消息内容已脱敏。
- `/api/cli/sessions` 可以读取 Hermes CLI 历史；失败时返回空数组，不阻塞 WebUI。
- `/api/cli/sessions/:id` 可以读取单个 CLI 会话，并标记 `readOnly: true`。
- `DELETE /api/cli/sessions/:id` 只是在 WebUI 隐藏 CLI 会话，不删除 CLI 本地真实历史。
- `/api/system/md-library` 读取独立 MD 输出库，不应混入 `backend/data/history-md/` 聊天归档。
- `/api/usage` 返回当前范围、每日 buckets、模型分布和来源分布；没有真实模型 usage 时可以明确标记为本地估算。
- `/api/system/files` 应返回 `path`、`parent`、`roots` 和文件项绝对路径，前端文件页才能正确导航。

## 启动验收

- `start.bat` 和 `一键启动.bat` 应保持纯 ASCII 内容和 CRLF 换行。
- 启动脚本应先清理 `.hermes-server.pid` 记录的旧进程和 8787 端口占用。
- 启动脚本应从项目根目录运行 `node backend\server.js`，日志写入 `logs\server.log`。
- 启动脚本应轮询 `/api/health`，健康后再打开 `http://127.0.0.1:8787/`。

## 清理边界

- 可以删除旧 UI：`frontend/index.html`、`frontend/css/*`、除 `hermes-artifact.js` 外的 `frontend/js/*`、根目录旧版 `app.js` / `style.css`。
- 可以删除临时测试文件：`modify_*.js`、`temp_*.py`、`sse-test.html`、`.tmp/`。
- 不要删除用户数据：`backend/data/`、`.claude/`、`AI引导/`、技能数据、记忆文件、历史 Markdown。
- 不要删除 Agent 输出库：默认 `backend/data/output-md/`，也可能是用户在设置页指定的任意目录。
- 删除前要确认根 `index.html` 没有引用对应文件。

## 右侧 Markdown 预览验收

- 标题栏应显示“Markdown 预览”，文件标题显示在下方标题条。
- 右侧边缘可拖拽调整宽度，面板打开时左边是主色 1.5px 单边描边。
- 点击“历史文件”后读取的是 Agent 输出 MD 库，不是聊天历史记录。
- 卡片有“预览”和“打开文件”两个按钮；点击标题也能预览。
- 预览态顶部有“返回”，返回后才显示卡片列表。
- 没有 MD 文件时显示空状态，并给出当前读取目录。

## 给接手 AI 的提醒

遇到“恢复今天改动”这类请求时，先查根页面依赖和启动脚本，再查 `app-new.js` 的对话/历史/CLI 逻辑。不要把旧 `frontend/index.html` 当成正式页面继续修。
