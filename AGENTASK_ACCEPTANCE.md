# AgentAsk 验收文档

本文档用于让其他 AI 或测试代理在 Hermes 本地页面上复验 AgentAsk 弹窗机制。目标不是读代码推断，而是在真实页面里按用户路径执行并确认行为。

## 验收目标

确认 AgentAsk 在当前 Hermes 页面中的以下能力正常：

1. 支持单选与多选。
2. 选项支持 `description` / 辅助文案显示。
3. 选择“其他 / 自行输入”后，输入框出现在该选项卡片内部，而不是外侧。
4. 点击选项时弹窗不应跳动、抖动或明显改位。
5. 弹窗应居中显示，而不是贴右侧。
6. 弹窗无遮罩，背景页面保持可见。
7. 自定义输入框允许较长文本，不应因为长度过短而截断或消失。
8. 多题场景下可切换 tab，并保留之前输入的选择与自定义内容。
9. 提交按钮只在题目满足作答条件后可提交。
10. `ask_user` / `AskUserQuestion` 的前端解析链路能够把答案格式化写回聊天输入框，并触发发送逻辑。

## 验收环境

- 本地地址：`http://127.0.0.1:8787/`
- 服务入口参考：[backend/server.js:21-68](backend/server.js#L21-L68)
- 页面入口参考：[index.html:865-866](index.html#L865-L866)
- AgentAsk 解析与写回逻辑参考：
  - [app-new.js:1057-1127](app-new.js#L1057-L1127)
  - [app-new.js:1154-1230](app-new.js#L1154-L1230)
- AgentAsk 样式参考：
  - [index.html:650-680](index.html#L650-L680)

## 当前实现的关键点

### 1. AskUserQuestion / ask_user 解析入口
当前前端会在流式工具事件和最终消息完成事件里识别三类来源：

- `clarify`
- `ask_user`
- `AskUserQuestion`

对应逻辑位于：
- [app-new.js:1057-1127](app-new.js#L1057-L1127)
- [app-new.js:1157-1230](app-new.js#L1157-L1230)

其中支持两类输入格式：

#### 标准多题格式

```json
{
  "questions": [
    {
      "header": "Hermes Verification",
      "question": "Pick deployment targets",
      "multiSelect": true,
      "options": [
        { "label": "Local Docker", "description": "Run locally in Docker." },
        { "label": "Cloud Run", "description": "Deploy serverlessly." }
      ]
    }
  ]
}
```

#### 单题旧格式

```json
{
  "question": "Pick deployment targets",
  "multiSelect": true,
  "options": [
    { "label": "Local Docker", "value": "local" },
    { "label": "Cloud Run", "value": "cloud-run" }
  ]
}
```

### 2. 提交后的写回格式
当前前端会把用户答案格式化为：

```text
[问题标题] 用户的选择是: 选项A, 选项B - 自定义补充
```

然后写入 `#chatInput`，再调用 `sendMessage()`。

对应逻辑：
- [app-new.js:1107-1125](app-new.js#L1107-L1125)
- [app-new.js:1212-1228](app-new.js#L1212-L1228)

### 3. UI 布局与样式约束
当前样式约束包括：

- 弹窗居中：`.chat-input-area.has-agent-panel` 使用 `display:flex` + `align-items:center` + `justify-content:center`
- 无遮罩：`background: transparent`，且 `::before` 被禁用
- 选项支持辅助文案：`.agent-option-desc`
- 自定义输入框在选项内部：`.agent-inline-textarea`

对应样式：
- [index.html:653-679](index.html#L653-L679)

## 推荐验收方式

优先使用真实浏览器连接现有 Chrome，直接在本地 Hermes 页面里执行。

如果能自然触发真实 `ask_user` / `AskUserQuestion` 最好；如果当前模型或后端不稳定产出该结构，可退而求其次，在页面上下文里直接调用 `askUser(...)` 或 `AgentAsk.ask(...)` 做前端级复验。

## 推荐测试数据

建议使用下面这组两题数据，能一次覆盖多选、description、Other、自定义输入、tab 切换：

```json
{
  "questions": [
    {
      "header": "Hermes Verification",
      "question": "Pick deployment targets",
      "multiSelect": true,
      "options": [
        { "label": "Local Docker", "description": "Run locally in Docker." },
        { "label": "Cloud Run", "description": "Deploy serverlessly." },
        { "label": "Self-hosted VM", "description": "Use your own VM." }
      ]
    },
    {
      "header": "Strategy",
      "question": "Choose rollout strategy",
      "multiSelect": false,
      "options": [
        { "label": "Rolling", "description": "Replace instances gradually." },
        { "label": "Blue/Green", "description": "Switch traffic after validation." }
      ]
    }
  ]
}
```

## 验收步骤

### A. 页面基础确认

1. 打开 `http://127.0.0.1:8787/`。
2. 确认页面加载正常，无明显白屏或初始化报错。
3. 确认当前页面是 Hermes 主界面，而不是其它临时页面。

通过标准：
- 主界面可见。
- 聊天区域和输入区域存在。

### B. 触发 AgentAsk

任选一种方式：

#### 方式 1：真实链路
让 Hermes 返回一个工具调用或消息内容，最终能走到：
- `onTool(... ask_user / AskUserQuestion ...)`
- 或 `onDone()` 中的 `<ask_user>...</ask_user>` / JSON fallback

#### 方式 2：页面注入
在页面上下文直接调用：

```js
askUser(payload.questions)
```

或：

```js
AgentAsk.ask(payload.questions, { title: 'Hermes Verification' })
```

通过标准：
- 弹窗成功出现。
- 弹窗位于页面中央附近。
- 背景页面可见，且没有黑色/半透明遮罩挡住主界面。

### C. 检查第一题：多选 + description + Other

在第一题中执行：

1. 点击 `Local Docker`。
2. 点击 `Cloud Run`。
3. 点击“其他 / 自行输入”。
4. 确认该选项内部出现 textarea。
5. 输入一段较长文本，例如：

```text
Edge cluster in staging with a longer custom explanation for validation.
```

检查项：
- 多个选项可以同时处于选中态。
- 每个选项下的 description 可见。
- textarea 在“其他”选项卡片内部。
- 点击选项后弹窗不应整体跳动或明显位移。
- 输入长文本后，输入框仍正常显示。

通过标准：
- 第一题多选可用。
- description 显示正确。
- Other 内嵌输入框正常出现并可编辑。
- 输入过程中无异常重绘或面板闪跳。

### D. 检查第二题：tab 切换与状态保持

1. 切到第二题 tab。
2. 选择 `Blue/Green`。
3. 再切回第一题。
4. 确认之前勾选的多选项仍在。
5. 确认自定义输入文本仍在。

通过标准：
- tab 可以切换。
- 第二题选项可正常单选。
- 返回第一题后状态保持，没有丢失。

### E. 提交状态检查

1. 在所有题目都完成后，检查提交按钮是否可用。
2. 观察底部进度文案，例如 `2/2 已回答`。
3. 点击提交。

通过标准：
- 未答完时提交按钮不可用。
- 答完后提交按钮可用。
- 提交后弹窗关闭。

### F. 前后链路写回检查

如果本次走的是 `askUser(...)` 的真实上层链路，则继续确认：

1. 提交后答案被格式化写回 `#chatInput`。
2. 写回内容包含每一题的最终答案。
3. `sendMessage()` 被触发。

期望格式示例：

```text
[Pick deployment targets] 用户的选择是: Local Docker, Cloud Run - Edge cluster in staging with a longer custom explanation for validation.
[Choose rollout strategy] 用户的选择是: Blue/Green
```

通过标准：
- 聊天输入框中出现格式化答案。
- 发送逻辑被调用。

## 建议记录的验收结果

建议其他 AI 输出如下结构，便于横向对比：

```md
## AgentAsk 验收结果

### 通过项
- 多选正常
- description 正常
- Other 内嵌输入框正常
- tab 切换后输入保留
- 弹窗居中且无遮罩

### 未通过项
- 真实 ask_user 写回链路未验证 / 或具体验证失败点

### 复现步骤
1. ...
2. ...

### 代码落点
- app-new.js:xxxx
- index.html:xxxx
```

## 已确认的代码落点

### 解析与回填
- [app-new.js:1059-1125](app-new.js#L1059-L1125)
- [app-new.js:1178-1228](app-new.js#L1178-L1228)

### 样式与布局
- [index.html:653-680](index.html#L653-L680)

### 本地服务
- [backend/server.js:21-68](backend/server.js#L21-L68)

## 当前已知结论

基于之前的真实浏览器组件级验收，下面这些点已经被验证通过：

- 弹窗能打开并居中显示。
- description 能显示。
- 多选逻辑可用。
- “其他 / 自行输入”会在选项内部出现 textarea。
- 自定义文本在切换题目后仍能保留。
- 第二题切换和单选正常。
- 全部答完后提交按钮可用，提交后弹窗关闭。

尚未最终闭环的唯一重点是：

- 需要继续确认完整自然链路下，`ask_user` / `AskUserQuestion` 提交后是否一定会写回 `#chatInput` 并触发 `sendMessage()`。

如果其他 AI 只能做一件事，优先补这一条真实链路验收。
