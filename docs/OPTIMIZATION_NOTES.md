# Hermes Agent WebUI 优化说明

## 1. 当前优化目标

当前优化方向是：

```text
普通聊天更快，复杂任务仍然保留 Hermes Agent 能力。
```

也就是：

- 日常聊天、问答、润色、方案讨论：直连模型 API。
- 文件、命令、代码、项目任务：自动切 Hermes Agent。
- 记忆、偏好、Agent Profile、相关 Skill：仍由 WebUI 后端注入。

## 2. 已完成优化

### 端口统一

默认端口统一为：

```text
3381
```

### 外部数据目录

支持在设置里配置：

- 数据根目录
- 记忆目录
- 图片目录
- 历史 Markdown 目录
- 输出 Markdown 目录

### 自动路由

新增自动路由：

```text
普通聊天 → direct
复杂任务 → hermes
```

执行过程会显示当前通道。

### 按需 Skill 注入

普通聊天不再全量注入所有 Skill，而是按当前问题匹配相关 Skill。

这样可以减少 Prompt 长度，提升首 token 速度。

### 执行过程优化

不再用假的“正在思考”占位。

现在展示真实事件：

- 后端流式连接
- 路由选择
- 首 token
- Hermes CLI 输出
- 工具调用
- 完成或错误

### `<think>` 解析修复

支持正常解析：

```xml
<think>...</think>
```

但直连模型默认不展示原始 `reasoning_content`，避免输出冗长或敏感推理。

## 3. 性能变化

优化前普通聊天可能走：

```text
WebUI → Hermes CLI → WSL → Agent → 模型
```

短消息也可能等待 10 秒以上。

优化后普通聊天走：

```text
WebUI → 模型 API
```

实测普通短问答约 1 到 2 秒完成，具体取决于模型 API 和网络。

## 4. 保留能力

虽然普通聊天走直连，但仍保留：

- 会话历史
- 核心记忆
- Agent 规则
- Agent Profile
- 相关 Skill
- Markdown 知识片段

复杂任务仍能走 Hermes Agent。

## 5. 后续可优化方向

### 常驻 Hermes Worker

如果未来还想提升复杂任务速度，可以考虑让 Hermes Agent 常驻，而不是每次 spawn CLI。

### 更精确的 Skill 匹配

当前 Skill 匹配是轻量关键词规则。后续可以加入：

- Skill 元数据
- 触发条件字段
- embedding 检索
- 用户手动固定 Skill

### 路由策略 UI

后续可以在设置页增加更明确的选项：

- 自动
- 始终直连
- 始终 Hermes Agent

### 模型测速

可以增加模型首包测速，帮助选择最快的普通聊天模型。