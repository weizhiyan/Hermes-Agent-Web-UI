# Hermes Agent WebUI

零依赖单页前端，双击 `index.html` 即可使用。

## 页面
- 首页：欢迎区 + KPI + 快速入口
- 对话：左侧会话列表，右侧消息流，Enter 发送 / Shift+Enter 换行
- 技能：网格卡片 + 开关 + 搜索 + 自定义添加
- 模型配置：Provider / 模型 / Base URL / Key / 采样参数
- 设置：主题、语言、流式、历史、系统提示词、后端 API、重置

## 与 Hermes Agent 后端对接

前端会按下列协议调用后端：

```
GET  {api}/api/health        -> 200 表示在线
POST {api}/api/chat          -> body: { messages, model, settings }
                                 resp: { content: string }
```

在「设置」页填入你的 Hermes Agent API 地址（默认 `http://127.0.0.1:8088`）。
未连接时自动回退到本地模拟回复，方便先调试 UI。

## 数据持久化
所有配置存在浏览器 `localStorage`：
- `hermes.settings` / `hermes.model` / `hermes.skills` / `hermes.chats`

## 后续可拓展
- 接入流式 SSE：把 `app.js` 里的 `callBackend` 改成 `EventSource` 即可
- 国际化：根据 `state.settings.lang` 切换文案
- 打包为桌面应用：用 Tauri / Electron 包一层
