# Hermes Agent API Reference

本文档记录当前 Hermes Agent WebUI 后端的真实接口。默认服务地址：

```text
http://127.0.0.1:8787
```

统一 JSON 响应：

```json
{ "code": 0, "data": {}, "msg": "ok" }
```

错误响应：

```json
{ "code": 1, "data": null, "msg": "错误描述" }
```

## Health

```http
GET /api/health
```

返回后端运行状态、工作目录和入口文件。

## Chats

```http
GET /api/chats
POST /api/chats
GET /api/chats/:id
PUT /api/chats/:id
DELETE /api/chats/:id
GET /api/chats/:id/markdown
POST /api/chats/:id/messages
POST /api/chats/gc-stream
GET /api/chats/exports/history
GET /api/chats/exports/folder
```

`POST /api/chats/:id/messages` 使用 SSE 返回：

- `token`：普通回复增量。
- `reasoning`：思考内容增量。
- `tool`：工具调用开始。
- `tool_complete`：工具调用完成。
- `title`：标题更新。
- `done`：完成。
- `error`：错误。

请求示例：

```json
{
  "content": "你好",
  "scene": "chat",
  "model": "auto",
  "profileId": "default",
  "profileName": "默认助手",
  "profilePrompt": "",
  "profileSkillIds": []
}
```

## CLI Sessions

```http
GET /api/cli/sessions
GET /api/cli/sessions/:id
DELETE /api/cli/sessions/:id
```

CLI 会话是只读快照。删除接口只是在 WebUI 隐藏，不删除真实 CLI 历史。

## Models

```http
GET /api/models
PUT /api/models
POST /api/models/library
DELETE /api/models/library/:id
POST /api/models/fetch-remote
POST /api/models/test
```

模型库字段示例：

```json
{
  "id": "provider:model-name",
  "provider": "provider",
  "name": "model-name",
  "base": "https://example.com/v1",
  "key": "sk-xxx",
  "enabled": true,
  "apiFormat": "openai-chat",
  "authType": "bearer",
  "authHeader": "",
  "tags": ["reasoning"]
}
```

场景字段：

- `chat`：普通对话。
- `reasoning`：深度推理和提示词优化。
- `image`：图像生成。

## Images

```http
GET /api/images
GET /api/images/file/:id
POST /api/images/upload
POST /api/images/optimize-prompt
POST /api/images/generate
```

上传图片：

```json
{
  "dataUrl": "data:image/png;base64,...",
  "fileName": "clipboard.png",
  "mime": "image/png",
  "source": "clipboard",
  "publicBase": "http://127.0.0.1:8787"
}
```

生成图片：

```json
{
  "prompt": "优化后的图片提示词",
  "sourcePrompt": "用户原始提示词",
  "optimizedByAgent": true,
  "attachmentIds": ["in_xxx", "out_xxx"],
  "model": "auto",
  "size": "1024x1024",
  "chatId": "uuid",
  "publicBase": "http://127.0.0.1:8787"
}
```

图片会保存到：

- 输入图：`backend/data/images/inputs/YYYY-MM/`
- 输出图：`backend/data/images/outputs/YYYY-MM/`
- 索引：`backend/data/images.json`

## Skills

```http
GET /api/skills
POST /api/skills
PUT /api/skills/:id
DELETE /api/skills/:id
GET /api/skills/folder
GET /api/skills/:id/files
GET /api/skills/:id/file
PUT /api/skills/:id/file
GET /api/skills/:id/files/:file
PUT /api/skills/:id/files/:file
POST /api/skills/describe
POST /api/skills/import
POST /api/skills/:id/open-folder
```

技能数据：

- 索引：`backend/data/skills.json`
- 本地技能副本：`backend/data/skills-local/`

## Memory

```http
GET /api/memory
GET /api/memory/core/:id
PUT /api/memory/core/:id
GET /api/memory/conversation/:id
```

核心记忆默认在 `backend/data/memory/core/`。

## System And Files

```http
GET /api/system/logs
POST /api/system/logs
GET /api/system/files
GET /api/system/file-content
GET /api/system/file-raw
GET /api/system/md-library
POST /api/system/open-path
```

文件接口只允许访问项目数据目录、项目目录和 MD 输出库等安全根目录。

## Settings

```http
GET /api/settings
PUT /api/settings
```

## Usage

```http
GET /api/usage
```

支持 `range`、`from`、`to` 查询参数。

## Gateway

```http
GET /api/gateway
PUT /api/gateway
```

频道 / 网关配置。

## Cron Jobs

```http
GET /api/cron
POST /api/cron
PUT /api/cron/:id
DELETE /api/cron/:id
```

## Agent

```http
GET /api/agent
```

检测 Hermes CLI / Agent 环境。

## Modal SSE

```http
GET /api/sse/notify
POST /api/sse/modal
POST /api/sse/toast
```

用于 WebUI 内部弹窗和提示。
