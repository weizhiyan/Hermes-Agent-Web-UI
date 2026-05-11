# Hermes 模型、角色、技能联动指南

这份文档给后续接手 Hermes Agent WebUI 的 AI 使用，目标是避免只改前端展示，而漏掉真实联动。

## 模型连接

模型配置的核心数据在 `backend/data/models.json`，后端接口是 `/api/models`。

模型库字段建议保持：

```json
{
  "id": "deepseek:deepseek-r1",
  "provider": "deepseek",
  "name": "deepseek-r1",
  "base": "https://api.deepseek.com",
  "key": "sk-xxx",
  "enabled": true,
  "apiFormat": "openai-chat",
  "authType": "bearer",
  "authHeader": "",
  "tags": ["reasoning"]
}
```

当前稳定支持的直连格式是 `openai-chat`，也就是 OpenAI Chat Completions 兼容接口。DeepSeek、多数中转站、New API、One API、SiliconFlow 等通常都可用这个格式。

预留格式：

- `ollama`：本地 Ollama，获取模型走 `/api/tags`，对话直连后续再补完整适配。
- `anthropic`：Anthropic Messages API，认证常用 `x-api-key`，目前仅做字段预留。
- `gemini`：Gemini API，认证常用 key 或查询参数，当前仅做字段预留。

认证方式：

- `bearer`：请求头 `Authorization: Bearer <key>`。
- `x-api-key`：请求头 `x-api-key: <key>`。
- `api-key`：请求头 `api-key: <key>`。
- `custom`：使用 `authHeader` 指定自定义请求头。
- `none`：无需认证，比如部分本地模型服务。

## 应用场景

`scenarios` 负责把模型分到三个应用场景：

- `chat`：普通对话，默认用于对话页“自动”模型。
- `reasoning`：深度推理，用于复杂任务、分身协作、代码和规划。
- `image`：图像生成，后续图像能力优先调用这里。

对话页模型选择逻辑：

- 默认是 `auto`，按当前角色或 `scenarios.chat` 自动选择。
- 用户手动选择某个模型后，才覆盖自动模式。
- 切换角色不应该强行把模型按钮改成手动模型。

## 角色配置

角色配置在小脑瓜的“角色配置”页，前端保存在 `localStorage.hermes.profiles`。

角色字段：

- `id`：角色 ID。
- `name`：角色名称。
- `modelId`：关联模型库里的模型 ID，或 `auto`。
- `model`：显示用模型名。
- `systemPrompt`：角色规则，会注入对话请求的 `profilePrompt`。
- `color`：角色头像颜色。

对话页的“默认助手”按钮用于切换当前角色。切换后，请求 `/api/chats/:id/messages` 时会带上：

- `profileId`
- `profilePrompt`
- `model`

后端在 `backend/routes/chat.js` 中把 `profilePrompt` 写入系统提示词。

## 分身页面

原“群聊”已改名为“分身”。

分身添加支持两种方式：

- 选择小脑瓜已有角色。
- 在分身页面临时自定义一个分身，填写名称、模型、提示词。

分身请求走 `/api/chats/gc-stream`，默认 scene 是 `reasoning`。如果分身绑定了模型，则优先传这个模型；否则走场景模型。

如果分身输出长 Markdown，前端会显示“预览 Markdown”按钮，打开弹窗查看排版后的内容。

## 技能中心

技能列表来自 `/api/skills`。

技能文件后端接口：

- `GET /api/skills/:id/files`：列出技能目录下的 md/json/yaml/txt 文件，支持子目录。
- `GET /api/skills/:id/file?path=SKILL.md`：读取文件。
- `PUT /api/skills/:id/file?path=SKILL.md`：保存文件。

前端点击技能文件后，应显示：

- 实际文件路径。
- 可编辑文本框。
- Markdown 文件的预览区域。

后续 AI 修改技能中心时，不要只改本地假数据，必须检查这三个接口是否仍可用。

## 验收重点

每次改完至少检查：

- 模型配置页能添加模型、获取模型、按 Provider 分组、测试连接。
- 对话页三个弹窗从对应按钮上方弹出：角色、技能、模型。
- 对话页默认模型保持“自动”，除非用户手动选模型。
- 小脑瓜角色能用于对话页，也能用于分身页面。
- 分身页面能选择已有角色，也能自定义分身。
- 技能中心能看到真实文件路径，能编辑并保存 Markdown。

## 回复速度与工具链取舍

- 默认 Agent 模式走 Hermes CLI，保留工具调用、命令确认、安全扫描等能力，首 token 可能比直连模型慢。
- 设置页“快速模式”会跳过 Hermes Agent 直接调用模型 API，速度更快，但不支持 Hermes 工具链。
- 如果用户反馈回复慢，优先检查：
- `backend/services/hermes.js` 是否缓存了 Hermes CLI 探测结果，避免每条消息都同步探测 WSL/本机命令。
- 设置页“历史记录保留”是否过大，普通使用建议 12-20 轮。
- 模型配置是否使用远端中转或网络较慢的 Provider。
- 不要为了提速默认强制开启快速模式，除非用户接受“不支持工具调用”的取舍。
