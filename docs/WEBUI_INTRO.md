# Hermes Agent WebUI 使用说明

这份文档用于说明当前 Hermes Agent WebUI 的定位、运行方式、核心逻辑、记忆机制、Skill 机制、更新方式和常见问题。它面向日常使用者，也方便后续 AI 或开发者接手维护。

## 1. WebUI 是什么

Hermes Agent WebUI 是一个运行在本地的 AI 工作台。它不是单纯的聊天网页，而是把以下能力整合在一起：

- 普通 AI 对话
- Hermes Agent 复杂任务执行
- 模型配置和场景模型管理
- 本地记忆与偏好注入
- Skill 管理和按需注入
- Markdown 输出与预览
- 图片上传、生成和输出管理
- 聊天历史保存
- 执行过程展示
- WebUI 更新和本地数据迁移

当前默认端口是：

```text
3381
```

本地访问地址：

```text
http://127.0.0.1:3381
```

## 2. 当前核心设计

现在 WebUI 使用的是“自动路由”逻辑：

```text
用户输入
  ↓
WebUI 后端读取记忆、历史、设置、相关 Skill
  ↓
判断任务类型
  ↓
普通聊天 → 直连模型 API
复杂任务 → Hermes Agent CLI
  ↓
流式返回到 WebUI
```

这样做的目标是：

- 普通聊天速度接近常见竞品 WebUI。
- 复杂任务仍保留 Hermes Agent 的真实执行能力。
- 记忆、偏好、Skill 不丢失。
- 不把所有 Skill 每次都塞进 Prompt，减少无效上下文。

## 3. 普通聊天为什么现在更快

之前 WebUI 的普通消息大多走这条链路：

```text
浏览器 → WebUI 后端 → Hermes CLI → WSL → Hermes Agent → 模型 API → 返回
```

这个链路能力强，但每条消息都会有额外开销：

- 检测 Hermes 命令
- 启动 CLI 或 WSL
- 同步 provider 配置
- 构造 Agent Prompt
- 等待 Agent 首包

现在普通聊天默认走：

```text
浏览器 → WebUI 后端 → 模型 API → 返回
```

所以短对话、问答、润色、解释、方案讨论会明显更快。

## 4. 什么情况下会走直连模型

以下情况默认走直连模型：

- 普通聊天
- 问答
- 文案润色
- 解释概念
- 简单方案讨论
- 根据记忆继续沟通
- 不需要真实操作文件或命令的任务

直连模型依然会带上：

- 当前会话历史
- 核心记忆
- Agent 规则
- 全局系统提示词
- 当前 Agent Profile
- 当前问题相关的 Skill
- 相关 Markdown 知识片段

所以直连不是“裸模型”，它仍然知道你的上下文和偏好。

## 5. 什么情况下会走 Hermes Agent

以下情况会自动切换到 Hermes Agent：

- 修改代码
- 创建、删除、移动、保存文件
- 运行命令
- 终端任务
- Git / npm / pnpm / docker 等工程任务
- 扫描项目
- 分析代码库
- 批量处理文件
- 需要工具调用的复杂任务
- 用户明确说使用 Agent 模式或 Hermes 模式

这类任务需要真实执行能力，适合走 Hermes Agent。

## 6. 自动路由逻辑

当前路由模式默认是：

```json
"routingMode": "auto"
```

含义：

- `auto`：普通聊天直连，复杂任务 Hermes。
- `direct` / `fast`：尽量强制直连模型。
- `hermes` / `agent`：尽量强制走 Hermes Agent。

自动判断主要看用户输入是否包含文件、命令、代码维护、项目操作等意图。

执行过程面板里会显示类似：

```text
已选择直连模型通道
```

或：

```text
已选择 Hermes Agent 通道
```

这样可以直接知道当前消息走的是哪条链路。

## 7. 记忆是如何工作的

记忆不是放在模型里面，也不是只属于 Hermes CLI。WebUI 后端会在发送请求前读取记忆，再注入到模型上下文。

默认建议记忆目录：

```text
F:\AI\Hermes Agent\记忆
```

常见子目录：

```text
F:\AI\Hermes Agent\记忆\core
F:\AI\Hermes Agent\记忆\skill
F:\AI\Hermes Agent\记忆\output-md
F:\AI\Hermes Agent\记忆\images
F:\AI\Hermes Agent\记忆\history-md
```

设置页可以修改：

- 数据根目录
- 记忆目录
- 图片目录
- 历史 Markdown 目录
- 输出 Markdown 目录

如果你把记忆目录移动到其他盘，只要在设置里重新选择路径，WebUI 后端会按新路径读取。

设置页提供“一键备份导出”：会生成一个 JSON 备份文件，包含设置、模型配置、Skill、聊天索引和数据目录清单。API Key、Token、密码等敏感字段会自动脱敏。

## 8. 直连模型如何记住你的偏好

直连模型每次请求仍会收到 WebUI 拼好的上下文：

```text
系统规则
核心记忆
Agent 规则
用户偏好
当前 Agent Profile
最近聊天历史
当前用户问题
```

例如你长期偏好：

- 中文回答
- 直接给结论
- 做设计方案时结构清楚
- 图片输出放到指定目录
- 代码维护时先分析再动手

这些都可以写进核心记忆或 Agent Profile。直连模型会读取这些内容。

## 9. Skill 是如何工作的

Skill 存放在记忆目录下，例如：

```text
F:\AI\Hermes Agent\记忆\skill
```

每个第一层文件夹代表一个 Skill。

例如：

```text
skill
├─ 图像生成
├─ 文件操作
├─ 联网搜索
├─ 代码审查
├─ 长期记忆
└─ WebUI更新
```

WebUI 会扫描这些 Skill，并在聊天时判断是否相关。

当前 Skill 中心重点优化的是已有 Skill 的可控性：

- 触发词：每个 Skill 可以设置触发词，例如“代码、bug、重构”或“设计、UI、弹窗”。
- 优先级：多个 Skill 同时匹配时，优先级高的会排在前面注入。
- 自动建议：详情页可以根据 Skill 名称、分类和描述生成触发词建议。
- 命中可视化：对话执行过程会显示本次命中的 Skill，并标出触发词或命中原因；开启性能调试后，Prompt 调试面板也会显示命中列表。

## 10. 现在 Skill 不再全部注入

之前的问题是：普通聊天也会注入大量 Skill，导致 Prompt 很长，速度变慢。

现在逻辑是：

```text
普通聊天 → 只注入相关 Skill
复杂 Hermes 任务 → 可注入更多 Skill
用户指定 Agent Skill → 按指定 Skill 注入
```

例如：

- “帮我润色这段话” → 注入表达/写作相关 Skill。
- “帮我生成图片” → 注入图像生成相关 Skill。
- “帮我查最新资料” → 注入联网搜索相关 Skill。
- “帮我改代码并运行测试” → 走 Hermes Agent，并加载工程相关 Skill。

这样能兼顾速度和能力。

## 11. 执行过程面板是什么

WebUI 的“执行过程”不是伪造思考，而是展示真实链路事件。

可能出现的事件包括：

- 已发送请求
- 后端建立流式连接
- 已选择直连模型通道
- 已选择 Hermes Agent 通道
- Hermes CLI 开始输出
- 收到首个 token
- 工具调用开始
- 工具调用完成
- 回复完成
- 任务终止
- 错误信息

如果模型真的返回可展示的推理内容，面板会显示“模型推理”。

如果模型没有返回推理内容，面板显示“执行过程”。

## 12. 图片和输出文件放在哪里

图片和 Markdown 输出建议放在外部记忆目录，而不是放在 WebUI 项目代码里。

推荐：

```text
F:\AI\Hermes Agent\记忆\images
F:\AI\Hermes Agent\记忆\output-md
```

好处：

- WebUI 更新时不影响数据。
- 可以移动到其他盘。
- 可以备份整个记忆目录。
- 多台电脑可统一迁移。

## 13. 如何安装

最简单方式：

```bat
start.bat
```

或 PowerShell：

```powershell
.\start.ps1
```

如果依赖缺失，先执行：

```powershell
npm install
```

然后启动：

```powershell
npm start
```

访问：

```text
http://127.0.0.1:3381
```

更多安装说明见：

```text
docs/INSTALLATION.md
```

## 14. 模型测速与自动选择

模型配置页支持对单个模型测速。测速结果会记录首包时间和总耗时。完成多个模型测速后，可以点击“使用最快普通模型”，WebUI 会把普通对话场景切换到测速结果最快的聊天模型。

这个动作只修改普通对话模型，不会修改深度推理模型、图像模型或失败回退模型。

## 15. 如何更新 WebUI

如果这个目录是从 GitHub 克隆的，可以使用：

```bat
update.bat
```

它会执行类似逻辑：

```text
git pull --ff-only
npm install
```

更新前建议：

1. 确认你的记忆、图片、输出目录已经放在外部路径。
2. 不要把重要数据只放在项目内部临时目录。
3. 如果改过代码，先备份或提交，避免 pull 冲突。

WebUI 设置页现在提供「更新中心」状态卡片：

- 刷新状态：只读取本地 Git 分支、提交、标签和本地改动数量。
- 检查远端：执行安全的 `git fetch --tags --prune`，用于判断 GitHub 是否有新提交或新标签。
- 查看方法：展示 `update.bat`、`git pull --ff-only`、`npm install` 的手动更新流程。

更新中心不会自动执行 `git pull`，也不会自动覆盖本地文件。它只负责告诉你当前版本是否落后远端、是否有本地改动，以及是否适合手动更新。

手动更新方式：

```powershell
git pull --ff-only
npm install
```

然后重启 WebUI。

## 15. 多电脑如何迁移

推荐迁移两部分：

### 代码

在新电脑克隆或更新 WebUI 项目：

```powershell
git clone <你的仓库地址>
cd WEB-UI
npm install
```

### 数据

复制或同步记忆目录：

```text
F:\AI\Hermes Agent\记忆
```

然后在设置页把记忆路径、图片路径、输出路径改到新电脑对应位置。

## 16. 模型配置

模型配置在设置页中维护。

普通聊天需要 OpenAI 兼容格式，例如：

```text
Base URL: https://api.deepseek.com
API Key: sk-xxxx
Model: deepseek-v4-flash
API Format: openai-chat
```

场景模型建议：

- 普通对话：速度快、价格低、响应稳定的模型。
- 深度推理：能力更强的模型。
- 图像生成：图片模型或中转站图片模型。

## 17. 为什么有时还是慢

如果消息被路由到 Hermes Agent，就会比直连慢。

常见原因：

- 需要启动 Hermes CLI。
- 需要经过 WSL。
- 需要执行工具或命令。
- Prompt 更长。
- 模型本身首包慢。
- 网络或中转站延迟高。

执行过程会告诉你当前走的是 direct 还是 hermes。

## 18. 常见问题

### 发消息没有回复

先检查：

```text
http://127.0.0.1:3381/api/health
```

如果没有返回 `ok`，说明后端没启动。

### 页面打开了但很慢

看执行过程：

- 如果是 direct 慢，多半是模型 API 或网络慢。
- 如果是 hermes 慢，多半是 CLI / WSL / Agent 启动慢。

### 为什么没有显示思考

不是所有模型都会返回可展示推理。没有真实推理时，WebUI 显示执行过程，不再伪造思考。

### 为什么普通聊天没有加载所有 Skill

这是故意优化。普通聊天只加载相关 Skill，避免 Prompt 过长。

### 我想强制使用 Hermes Agent

可以在设置中把路由模式改成 Hermes，或在输入里明确说明使用 Agent / Hermes 模式。

## 19. 当前 docs 目录说明

当前保留的文档：

```text
docs/WEBUI_INTRO.md          # 主说明文档，也就是本文
docs/INSTALLATION.md         # 安装说明
docs/OPTIMIZATION_NOTES.md   # 优化记录和后续方向
docs/技能中心逻辑说明.md      # Skill 中心产品逻辑
```

已经删除旧的乱码、重复、过期、归档类文档，避免后续维护混乱。

## 20. 推荐使用方式

日常聊天：

```text
直接问，默认走直连模型，速度快。
```

复杂任务：

```text
明确说要改文件、运行命令、检查项目，WebUI 会自动切 Hermes Agent。
```

长期记忆：

```text
把偏好和长期信息放到记忆目录，WebUI 会自动读取。
```

输出文件：

```text
Markdown、图片、历史记录建议统一放到外部记忆目录。
```

更新 WebUI：

```text
用 update.bat 或 git pull --ff-only，再重启。
```
## 21. 任务日志与路由设置

设置页现在可以选择路由模式：自动、始终直连、始终 Hermes Agent。日志页会记录每次聊天任务的路由、原因、耗时、输出长度和错误信息，方便判断慢在哪里。Hermes API Server 地址和 API Key 已预留，后续可接官方 Hermes API Server。



## 24. Agent 如何调用反问弹窗

WebUI 已提供类似 Claude Code 的 Agent 反问用户能力。Agent 在信息不足、存在多个方案、需要确认路径/范围/风险，或准备执行高风险操作时，可以调用：

```text
POST http://127.0.0.1:3381/api/sse/ask?wait=1
```

请求体示例：

```json
{
  "title": "Agent 需要确认",
  "message": "我需要你确认下一步操作，然后继续执行。",
  "questions": [
    {
      "id": "action",
      "label": "下一步怎么做？",
      "type": "single",
      "options": [
        { "label": "继续执行", "description": "按当前方案继续" },
        { "label": "先暂停", "description": "停止当前任务，等待进一步说明" }
      ],
      "placeholder": "也可以补充其他要求"
    }
  ],
  "timeoutMs": 600000
}
```

用户提交后，接口会返回 `answers`。Agent 应根据用户选择继续任务。如果没有 WebUI 客户端连接、接口超时或调用失败，Agent 应回到聊天里直接提问，不能一直等待。
