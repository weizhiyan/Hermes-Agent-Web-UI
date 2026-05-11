# Hermes Agent — API 对接文档

> 本文档描述 Hermes Agent WebUI 的所有 API 接口，以及 Hermes Agent CLI 的输出标记格式，供第三方软件或 Agent 对接使用。

---

## 一、项目架构

```
Hermes Agent/
├── backend/                    # Express API 服务（端口 8787）
│   ├── server.js               # 入口
│   ├── routes/
│   │   ├── chat.js             # 对话历史 CRUD
│   │   ├── skills.js           # 技能管理
│   │   ├── models.js           # 模型配置
│   │   ├── settings.js         # 系统设置
│   │   ├── gateway.js          # 消息网关（TG/Discord/Slack/钉钉/飞书/企微）
│   │   ├── agent.js            # Hermes CLI 检测与调用
│   │   ├── cron.js             # 定时任务
│   │   ├── usage.js            # 用量统计
│   │   └── system.js           # 系统信息
│   └── services/
│       ├── hermes.js           # Hermes CLI 流式输出解析
│       ├── llm.js              # LLM 统一接口
│       └── store.js            # JSON 文件持久化
│
├── index.html                  # WebUI 前端（单文件，可独立部署）
└── app-new.js                  # 前端 JS 逻辑（可独立使用）
```

---

## 二、快速启动

### 一键启动（Windows）

```bash
双击运行 "一键启动.bat"
```

或手动启动：

```bash
cd backend
npm install
node server.js
# 服务运行于 http://127.0.0.1:8787
```

---

## 三、HTTP API

> 所有请求基础路径：`http://127.0.0.1:8787`
> 统一响应格式：`{ code: 0, data: ..., msg: "ok" }`
> 错误格式：`{ code: 1, data: null, msg: "错误描述" }`

### 3.1 健康检查

```
GET /api/health
```

**响应：**
```json
{ "code": 0, "data": { "uptime": 12345.67 }, "msg": "ok" }
```

---

### 3.2 对话历史（/api/chats）

#### 列出所有会话

```
GET /api/chats
```

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "uuid",
      "title": "会话标题",
      "model": "hermes-agent",
      "source": "WebUI",
      "updatedAt": 1746543600000,
      "createdAt": 1746543600000,
      "preview": "最后一条消息...",
      "messageCount": 12
    }
  ]
}
```

#### 创建新会话

```
POST /api/chats
Content-Type: application/json

{
  "title": "会话标题",     // 可选
  "model": "hermes-agent", // 可选
  "source": "WebUI"        // 可选
}
```

#### 获取单个会话

```
GET /api/chats/:id
```

#### 更新会话标题

```
PATCH /api/chats/:id
Content-Type: application/json

{ "title": "新标题" }
```

#### 删除会话

```
DELETE /api/chats/:id
```

#### 导出为 Markdown

```
GET /api/chats/:id/markdown
```

#### 发送消息并流式回复

```
POST /api/chats/:id/stream
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "你好", "ts": 1746543600000 }
  ]
}
```

**响应：SSE 流式 (`Content-Type: text/event-stream`)**

每行格式：

```
event: thinking
data: {"text": "用户说: 你好"}

event: tool
data: {"name": "read_file", "preview": "Reading src/main.py", "status": "started"}

event: tool_complete
data: {"name": "read_file", "duration": 234}

event: token
data: {"text": "你好，"}

event: done
data: {}

event: error
data: {"text": "错误信息"}
```

---

### 3.3 技能管理（/api/skills）

#### 获取技能列表

```
GET /api/skills
```

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "code-review",
      "name": "代码评审",
      "description": "逐行审阅代码并给出重构建议",
      "category": "开发",
      "source": "builtin",
      "enabled": true,
      "modified": false,
      "pinned": true,
      "useCount": 42,
      "viewCount": 128,
      "patchCount": 3,
      "files": ["SKILL.md", "review-template.md"]
    }
  ]
}
```

#### 切换技能启用状态

```
PUT /api/skills/toggle
Content-Type: application/json

{ "id": "code-review", "enabled": false }
```

#### 切换置顶状态

```
PUT /api/skills/pin
Content-Type: application/json

{ "id": "code-review", "pinned": true }
```

#### 获取技能文件列表

```
GET /api/skills/:category/:skill/files
```

#### 读取技能文件内容

```
GET /api/skills/:category/:skill/files/:filename
```

---

### 3.4 模型配置（/api/models）

#### 获取模型列表

```
GET /api/models
```

#### 保存模型配置

```
PUT /api/models
Content-Type: application/json

{
  "provider": "anthropic",
  "model": "claude-opus-4-7",
  "base": "https://api.anthropic.com",
  "key": "sk-...",
  "temperature": 0.7,
  "topP": 1,
  "maxTokens": 2048
}
```

#### 测试模型连接

```
POST /api/models/test
Content-Type: application/json

{
  "provider": "anthropic",
  "model": "claude-opus-4-7",
  "base": "https://api.anthropic.com",
  "key": "sk-..."
}
```

---

### 3.5 系统设置（/api/settings）

#### 获取设置

```
GET /api/settings
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "lang": "zh",
    "stream": true,
    "history": 20,
    "systemPrompt": "",
    "api": "http://127.0.0.1:8088",
    "hermesModel": "hermes-agent",
    "hermesPath": ""
  }
}
```

#### 保存设置

```
PUT /api/settings
Content-Type: application/json

{
  "lang": "zh",
  "stream": true,
  "api": "http://127.0.0.1:8088"
}
```

#### 测试连接

```
POST /api/settings/ping
```

---

### 3.6 消息网关（/api/gateway）

#### 获取网关配置

```
GET /api/gateway
```

#### 保存网关配置

```
PUT /api/gateway
Content-Type: application/json

{
  "enabled": true,
  "platforms": [
    {
      "id": "telegram",
      "configured": true,
      "enabled": true,
      "config": { "botToken": "123456:ABC-...", "webhookUrl": "https://..." }
    }
  ]
}
```

**支持的平台：**

| 平台 | ID | 必填配置字段 |
|---|---|---|
| Telegram Bot | `telegram` | `botToken`, `webhookUrl` |
| Discord | `discord` | `botToken`, `clientId`, `guildId` |
| Slack | `slack` | `botToken`, `signingSecret`, `appToken` |
| 钉钉 | `dingtalk` | `appKey`, `appSecret`, `robotCode` |
| 飞书 | `feishu` | `appId`, `appSecret`, `verificationToken` |
| 企微/微信 | `wechat` | `corpId`, `agentId`, `secret` |

---

### 3.7 Hermes CLI（/api/agent）

#### 检测 Hermes CLI 状态

```
GET /api/agent/status
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "available": true,
    "command": "wsl -> hermes",
    "version": "hermes 0.1.0",
    "type": "wsl",
    "error": ""
  }
}
```

---

### 3.8 用量统计（/api/usage）

```
GET /api/usage
GET /api/usage/daily
GET /api/usage/monthly
```

---

### 3.9 系统信息（/api/system）

```
GET /api/system/info
```

---

## 四、Hermes Agent CLI 输出标记格式

> 如果你通过 Hermes Agent CLI（WSL/Linux）调用推理，CLI 的 **stdout** 使用特定标记输出中间过程，前端会自动解析这些标记渲染思考过程和工具调用。

### 4.1 标记格式

| 标记 | 含义 | 示例 |
|---|---|---|
| `[REASONING]` | 思考过程 | `[REASONING] 用户在说 "你好"，我需要以友好方式回应。` |
| `[THINKING]` | 思考过程（同 REASONING） | `[THINKING] 首先分析上下文...` |
| `[TOOL:START name]` | 工具调用开始 | `[TOOL:START read_file]` |
| `[TOOL:START name {"args":"json"}]` | 带参数的工具调用 | `[TOOL:START read_file {"path":"/src/main.py"}]` |
| `[TOOL:END name]` | 工具调用结束 | `[TOOL:END read_file]` |
| `[TOOL:END name {"is_error":false,"duration":234}]` | 带结果的工具结束 | `[TOOL:END read_file {"is_error":false,"preview":"...","duration":234}]` |
| `[ERROR message]` | 错误信息 | `[ERROR] 连接超时` |
| `[TITLE title]` | 标题提取 | `[TITLE] 用户问题摘要` |
| `[AGENT:name]` | Agent 标识（过滤掉） | `[AGENT:claude] ...` |

### 4.2 完整示例

```
[REASONING] 用户询问了关于 Python 环境配置的问题...
[TOOL:START search_code {"query":"python environment setup","scope":"docs/"}
[TOOL:END search_code {"is_error":false,"preview":"Found 3 matches...","duration":145}]
[REASONING] 找到了相关信息，现在整理回答...
好的，关于 Python 环境配置，我建议按以下步骤进行：
1. 使用虚拟环境
2. 配置 pyproject.toml
...
[TITLE] Python 环境配置指南
```

### 4.3 解析器源码位置

解析逻辑在 [backend/services/hermes.js](file:///C:/Users/Administrator/Desktop/Hermes%20Agent/backend/services/hermes.js#L4-L50) 的 `parseAgentLine()` 函数中。

### 4.4 在第三方软件中使用

如果第三方软件调用 Hermes CLI，直接让 CLI 输出上述标记格式即可，前端 WebUI 的 SSE 流会原样传递 stdout 内容。

---

## 五、前端 WebUI API 集成点

> 如果你想让外部软件接入 WebUI 的对话能力，有以下方式。

### 5.1 方式一：直接调用后端 HTTP API

1. 启动后端 `node backend/server.js`
2. 通过 `POST /api/chats/:id/stream` 发送消息，SSE 流式接收
3. 前端轮询 `/api/chats/:id` 获取最新消息

### 5.2 方式二：WebSocket（未来扩展）

当前版本未实现 WebSocket，如需实时双向通信可自行扩展。

### 5.3 方式三：前端注入（仅本地）

在浏览器控制台直接调用前端暴露的函数：

```js
// 发送消息（需要先切换到对话页面）
sendMessage()

// 调用 Agent 提问弹窗
askUser([
  {
    id: 'q1',
    label: '选择语言',
    type: 'single',
    options: [
      { label: 'Python', value: 'py' },
      { label: 'TypeScript', value: 'ts' }
    ]
  }
]).then(answers => {
  console.log('用户回答:', answers);
});

// 获取当前对话
currentChat()

// 获取所有技能
state.skills

// 获取群聊房间
state.groupChat.rooms
```

---

## 六、响应代码

| code | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 通用错误 |
| `404` | 资源不存在 |
| `500` | 服务器内部错误 |

---

## 七、CORS 说明

后端已配置 `cors()` 中间件，允许来自任意源的请求。部署时可通过环境变量 `ORIGIN` 限制来源。

---

## 八、环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8787` | 后端监听端口 |
| `ORIGIN` | `*` | CORS 允许来源 |
| `DATA_DIR` | `./data` | 数据存储目录 |
