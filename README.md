# Hermes Agent WebUI

Hermes Agent WebUI 是一个 **本地优先、浏览器操作、Node.js 驱动** 的 AI 工作台。它把日常 AI 对话、模型配置、Agent Profile、Skill、记忆、图片工作流、Markdown/Artifact 输出、本地命令审批和 WebUI 设置集中到一个界面里，让用户可以像使用普通聊天工具一样使用 AI，同时保留 Agent 执行复杂任务的能力。


<p align="center">
  <img width="1918" height="924" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/a5dd440e-4eec-497f-a303-8638db7bd47d" />
  <img width="1918" height="921" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/9efa00c4-251b-4bf9-ad24-95a9d0f9835e" />
  <img width="1916" height="917" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/d206fbcc-38c9-4a07-ba57-c2b355e52e7f" />
  <img width="1915" height="910" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/ab5ab8cf-f9da-4e47-b881-60c1a4749581" />
  <img width="1921" height="920" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/e1eb3eb0-cbe2-48b4-ac3e-b8a740c7557f" />
  <img width="1917" height="912" alt="Hermes Agent WebUI screenshot" src="https://github.com/user-attachments/assets/63fd03c9-f71e-4541-aa4b-ac71afeb5faa" />
</p>

## 项目定位

Hermes Agent WebUI 不是单纯的聊天页面，也不是完全替代命令行 Agent 的工具。它的定位是：

- **普通聊天走快速直连**：日常问答、解释、写作、翻译等请求优先直接调用模型接口，减少中间层带来的等待。
- **复杂任务走 Agent 模式**：当用户要求读写文件、执行命令、分析项目、修复代码、批量处理、本地操作时，再进入 Hermes Agent 逻辑。
- **长期使用保留上下文资产**：通过记忆、偏好、Agent Profile 和 Skill，让 WebUI 不只是一次性聊天窗口，而是能逐渐沉淀个人工作方式。
- **本地优先保护数据**：配置、记忆、Skill、图片和输出都优先保存在本地文件系统，用户可以自己决定放在哪个磁盘、如何备份、是否迁移。
- **尽量不改变原有 Hermes 逻辑**：WebUI 主要做界面、配置、路由、记忆注入、Skill 注入、文件管理和安全审批，不强行改变底层 Agent 的执行方式。

## 技术栈

这个项目采用轻量 Web 架构，方便本地运行和二次修改。

| 层级 | 使用技术 | 作用 |
| --- | --- | --- |
| 前端界面 | HTML、CSS、原生 JavaScript | 构建聊天界面、设置页、模型管理、Skill 中心、弹窗交互、图片预览和 Markdown 输出 |
| 后端服务 | Node.js、Express | 提供本地 HTTP 服务、REST API、静态页面托管、模型转发、设置读写和 Agent 调用入口 |
| 数据存储 | 本地 JSON / 文件目录 | 保存设置、模型库、记忆、Skill、聊天索引、图片记录和导出内容 |
| 模型接口 | OpenAI-compatible Chat Completions 风格接口 | 支持常见兼容模型服务，通过 Base URL、API Key 和模型名配置接入 |
| Agent 执行 | Hermes Agent / 本地命令能力 | 处理需要工具调用、文件操作、命令执行、项目分析等复杂任务 |
| 安全控制 | 后端命令审查 + 前端确认弹窗 | 对高风险操作进行拦截、确认和日志记录 |
| 部署方式 | 本地 Node 服务 / Docker 可选 | 默认本机启动，也可以按需容器化运行 |

项目整体偏向 **单机本地应用**：前端不是复杂工程化框架，后端也不是重型微服务，核心目标是安装简单、逻辑透明、方便用户自己改。

## 运行模式

Hermes Agent WebUI 的运行链路可以理解为：

```text
浏览器界面 → 本地 Express 服务 → 路由判断 → 模型直连 / Hermes Agent → 流式返回 → WebUI 展示与归档
```

更具体地说：

1. 用户在浏览器打开 `http://127.0.0.1:3381/`。
2. 前端把消息、当前 Profile、模型选择、记忆设置、Skill 设置一起提交给后端。
3. 后端判断这次请求更适合直连模型，还是交给 Hermes Agent。
4. 如果是普通聊天，后端直接调用已配置的模型接口，并把流式结果返回给前端。
5. 如果是复杂任务，后端进入 Agent 逻辑，处理工具调用、命令审批、文件上下文和执行过程展示。
6. 前端展示回复、思考/执行过程、Artifact、图片和弹窗确认结果。
7. 设置、记忆、图片、输出文件按照用户配置的路径保存，便于以后继续使用。

这种模式的好处是：普通聊天速度尽量接近直连模型，复杂任务又能保留 Agent 能力，不需要所有请求都走同一条重链路。

## 主要功能

### 1. 流式 AI 对话

- 支持模型流式输出，减少“等完整回答结束才显示”的等待感。
- 支持首包耗时、总耗时等速度感知，方便判断当前模型或网络是否慢。
- 支持普通聊天与 Agent 任务区分，避免简单问题也被复杂执行链路拖慢。
- 支持 Markdown 内容展示，适合方案、教程、代码块、表格和长文本输出。

### 2. 模型管理

- 可维护多个模型 Provider，例如不同的 OpenAI-compatible 服务。
- 可配置 Base URL、API Key、认证方式、模型名称、启用状态和备注。
- 支持按场景选择模型，例如普通聊天模型、Agent 模型、图片相关模型等。
- 支持模型测速，用首包时间和总耗时辅助选择更适合日常聊天的模型。
- 支持失败回退思路：当某个模型不可用时，可以切换到备用模型继续工作。

### 3. 智能路由

WebUI 会根据设置和用户输入判断请求路径：

- **直连模式**：适合普通问答、写文案、总结、翻译、解释概念、轻量代码片段。
- **Agent 模式**：适合读取文件、修改项目、执行命令、安装依赖、分析代码库、修复 Bug、批量处理资料。
- **强制模式**：用户或设置可以指定强制直连或强制走 Hermes Agent。

这样做的目的不是削弱 Agent，而是避免所有消息都进入复杂工具链。很多竞品 WebUI 的速度优势，本质上也是普通聊天尽量直连，只有需要工具时才进入 Agent。

### 4. Agent Profile

Agent Profile 可以理解为不同工作角色的配置模板。例如：

- 日常助手：回答直接、速度优先、少调用工具。
- 代码助手：更关注项目结构、命令执行、补丁修改和测试验证。
- 写作助手：更关注风格、结构、长文输出和多版本润色。
- 图片助手：更关注提示词、画面描述、风格一致性和图片目录。

每个 Profile 可以绑定不同模型、系统提示词、Skill 和执行偏好，让同一个 WebUI 面对不同任务时更稳定。

### 5. Skill 中心

Skill 是一组可复用的能力说明或工作流说明。WebUI 的 Skill 逻辑重点是 **按需注入**：

- 用户问题匹配到某类任务时，再注入相关 Skill。
- 没有命中的 Skill 不强行塞进 Prompt，减少上下文污染。
- Skill 可以来自项目内置目录，也可以来自用户配置的外部目录。
- 适合沉淀固定工作流，例如图片提示词、代码规范、项目发布流程、文档写作规则等。

通俗地说，Skill 不是按钮越多越好，而是让 Agent 在正确场景自动想起正确规则。

### 6. 记忆系统

记忆不是强制绑定在 WebUI 内部目录里，而是支持用户在设置中调整保存路径。推荐把记忆放到项目外部，例如：

```text
D:\HermesData\memory
```

这样做有几个优点：

- 更新 WebUI 代码时不会误删个人记忆。
- 换电脑时只需要迁移数据目录。
- 多个版本 WebUI 可以共用同一套记忆。
- 生成图片、输入图片、输出文件可以统一归档在同一数据目录下。

记忆适合保存：

- 用户长期偏好，例如回答风格、常用语言、格式习惯。
- Agent 使用规则，例如什么时候需要反问、什么时候需要直接执行。
- 项目固定信息，例如常用目录、工作流、命名规范。
- 轻量知识片段，例如常用提示词、说明文本和操作步骤。

### 7. 图片工作流

WebUI 支持把图片相关内容统一放到用户配置的数据目录，避免散落在项目源码里。

常见用途包括：

- 上传参考图。
- 生成图片。
- 图生图或根据图片继续修改。
- 保存输出图、预览图和历史记录。
- 将图片路径与聊天或任务结果关联，方便后续查找。

建议把图片目录和记忆目录放在同一个外部数据根目录下，例如：

```text
D:\HermesData\images
D:\HermesData\outputs
D:\HermesData\memory
```

### 8. Markdown 与 Artifact 输出

当 AI 回复较长内容时，WebUI 会尽量把内容结构化展示，适合：

- 产品方案。
- 安装教程。
- 项目说明。
- 更新日志。
- 代码解释。
- 长文档草稿。
- 可复制的 Markdown 输出。

这类输出适合进一步保存到文件、放进 README、整理为教程或作为项目交付文档。

### 9. Agent 反问弹窗

WebUI 支持 Agent 在需要用户确认时弹出交互卡片，而不是只在聊天文本里提问。

适合场景：

- 操作有多个分支，需要用户选择。
- 执行命令前需要确认。
- 删除、覆盖、移动文件前需要确认。
- Agent 不确定用户意图，需要补充信息。
- 测试流程中需要用户判断是否继续。

弹窗的目标是接近 Claude Code 这类 Agent 工具的交互体验：AI 不只是输出文本，也可以在关键节点暂停并向用户确认。

### 10. 安全审批

本地 Agent 最大的风险不是聊天，而是文件和命令操作。因此 WebUI 增加了基础安全层：

- 高风险命令需要确认。
- 明显危险命令会被拦截。
- 命令执行会尽量记录日志，方便追踪。
- 前端弹窗用于让用户明确选择继续或取消。
- WebUI 不会把 API Key、个人路径等敏感字段写进公开文档。

这不能替代完整安全沙箱，但可以降低误操作概率。

### 11. 更新中心与备份

WebUI 提供更新相关逻辑，用来辅助用户判断当前版本是否落后。

它的原则是：

- 检查 Git 状态和远端更新。
- 不静默覆盖用户本地改动。
- 更新前建议备份设置和数据目录。
- 代码更新与个人数据分离，减少升级风险。

如果你只是下载 ZIP 使用，也可以手动下载新版覆盖代码，但仍建议把记忆、图片、输出放在项目外部。

## 安装方式

### 环境要求

- Node.js 18 或更高版本。
- npm。
- Windows、Linux、macOS 理论上都可运行；当前脚本对 Windows 更友好。
- 至少一个可用的 OpenAI-compatible 模型服务，或你自己的兼容接口。

### Windows 快速启动

推荐直接双击：

```bat
start.bat
```

或使用 PowerShell：

```powershell
.\start.ps1
```

首次启动如果缺少依赖，可以手动执行：

```powershell
npm install
npm start
```

启动后打开：

```text
http://127.0.0.1:3381/
```

### Linux / macOS

```bash
npm install
npm start
```

如果需要指定端口，可以设置环境变量：

```bash
PORT=3381 npm start
```

### 从 GitHub 克隆

```bash
git clone https://github.com/weizhiyan/Hermes-Agent-Web-UI.git
cd Hermes-Agent-Web-UI
npm install
npm start
```

### 不会 Git 怎么安装

如果不熟悉 Git，也可以在 GitHub 页面点击：

```text
Code → Download ZIP
```

下载后解压，进入目录，运行：

```powershell
npm install
npm start
```

这种方式最简单，但以后更新需要重新下载 ZIP。会使用 Git 的用户更推荐 clone，因为后续更新更方便。

## 如何配置模型

进入 WebUI 后，一般按这个顺序配置：

1. 打开设置或模型管理。
2. 新增模型 Provider。
3. 填写 Base URL，例如你的兼容接口地址。
4. 填写 API Key。
5. 填写模型名称。
6. 保存并测试。
7. 把测试通过的模型设置为普通聊天模型或 Agent 模型。

如果你使用的是兼容 OpenAI Chat Completions 的接口，通常需要的是：

```text
Base URL
API Key
Model Name
```

不要把真实 API Key 提交到 GitHub，也不要写进 README、截图、Issue 或公开文档。

## 如何配置记忆和图片目录

推荐准备一个项目外部的数据目录，例如：

```text
D:\HermesData
```

再按用途分成：

```text
D:\HermesData\memory
D:\HermesData\images
D:\HermesData\outputs
D:\HermesData\skills
D:\HermesData\backups
```

然后在 WebUI 设置里把记忆路径、图片路径、输出路径改到这些目录。这样即使你删除或更新 WebUI 源码，个人数据仍然保留。

如果你把数据目录移动到其他磁盘，只要在设置里重新选择新路径，WebUI 后续就会按新路径读取和写入。

## 如何更新到最新版

### 使用 Git 更新

如果你是通过 `git clone` 安装的，进入项目目录后执行：

```powershell
git pull
npm install
npm start
```

如果你本地改过代码，`git pull` 可能提示冲突。建议更新前先备份自己的改动，或使用 Git 分支管理。

### 使用 ZIP 更新

如果你是下载 ZIP 使用的：

1. 到 GitHub 页面重新下载最新版 ZIP。
2. 解压到一个新目录。
3. 不要直接覆盖你的记忆、图片、输出目录。
4. 把旧版的外部数据目录路径重新配置到新版 WebUI。
5. 运行 `npm install` 和 `npm start`。

### 更新前建议备份

建议备份这些内容：

- WebUI 设置。
- 模型配置。
- Agent Profile。
- Skill 文件。
- 记忆目录。
- 图片目录。
- 输出目录。

如果你的数据本来就在 `D:\HermesData` 这类外部目录里，更新 WebUI 会安全很多。

## 版本与历史版本

- 仓库主页默认显示当前默认分支，一般就是最新版代码。
- `Code → Download ZIP` 下载的是当前分支的最新版源码。
- 如果想下载旧版本，请进入 GitHub 的 `Tags` 或 `Releases`，选择对应标签，例如 `v1.1.0`、`v1.2.0`、`v1.3.0`。

使用 Git 切换历史版本：

```powershell
git fetch --tags
git checkout v1.2.0
npm install
```

回到最新版：

```powershell
git checkout main
git pull
npm install
```

如果 GitHub 页面显示的 README 不是你预期的最新版，请检查页面左上角分支选择器，确认当前查看的是默认分支或 `main` 分支。

## 目录结构

```text
Hermes-Agent-Web-UI/
├─ backend/                 # Node.js / Express 后端 API
│  ├─ routes/               # chat、agent、models、settings、skills、memory 等接口
│  ├─ services/             # 模型调用、记忆、路径、安全、Skill 发现等服务
│  └─ server.js             # 后端入口
├─ frontend/                # 前端静态资源
│  ├─ css/                  # 主题变量与样式
│  └─ js/                   # Artifact、图标等前端模块
├─ docs/                    # 项目说明、安装说明、优化记录
├─ scripts/                 # 辅助脚本
├─ index.html               # WebUI 主界面
├─ app-new.js               # WebUI 前端主逻辑
├─ package.json             # 根启动脚本
├─ start.bat                # Windows 启动脚本
├─ start.ps1                # PowerShell 启动脚本
├─ update.bat               # 更新辅助脚本
└─ README.md                # 项目介绍
```

## API 与模块逻辑

后端 API 大致分为：

- `chat`：处理聊天请求、流式返回和直连模型逻辑。
- `agent`：处理 Hermes Agent 相关任务。
- `models`：管理模型库、测速、启用状态和模型选择。
- `settings`：管理 WebUI 设置、路径和运行偏好。
- `skills`：发现、读取、匹配和管理 Skill。
- `memory`：处理记忆文件、偏好和知识片段。
- `images`：处理图片上传、生成结果和图片目录。
- `modal`：处理 Agent 反问弹窗和用户选择。
- `system`：检查运行环境、Git 状态和系统信息。
- `usage`：记录或统计模型使用情况。

这些模块让 WebUI 的界面逻辑、模型逻辑、Agent 逻辑和本地文件逻辑相对分离，后续维护时更容易定位问题。

## 与常见 Agent WebUI 的差异

相比一些通用 WebUI，本项目更强调：

- **本地优先**：默认在本机运行，不要求把个人记忆和图片上传到云端。
- **速度分层**：普通聊天尽量直连，复杂任务再走 Agent。
- **可迁移记忆**：记忆、图片、输出可以放在外部目录，方便换盘和换电脑。
- **Skill 按需注入**：减少无关 Skill 对模型回复的干扰。
- **Windows 友好**：提供 `.bat` 和 `.ps1` 启动方式，适合不熟悉命令行的用户。
- **公开文档脱敏**：README 使用通用路径和示例，不暴露作者本机目录。
- **Agent 弹窗交互**：在关键步骤让 Agent 通过 UI 反问用户，而不是只靠聊天文本。

## 常见问题

### `127.0.0.1:3381` 会暴露我的电脑吗？

不会。`127.0.0.1` 是本机地址，只能当前电脑访问。别人即使看到这个地址，也访问的是他们自己的电脑，不是你的电脑。

只有在你主动配置公网访问时才需要额外注意，例如：

- 路由器端口映射。
- 公网服务器反向代理。
- 内网穿透工具。
- 把服务监听到 `0.0.0.0` 并开放防火墙。

如果只是默认本地运行，风险很低。

### README 里为什么不写真实路径？

公开仓库不应该暴露个人电脑路径、用户名、邮箱、密钥、私有目录结构等信息。文档里的 `D:\HermesData` 只是示例路径，你可以在自己电脑上换成任何位置。

### 为什么要把记忆放在项目外？

因为项目目录经常会被更新、覆盖、删除或重新 clone。把记忆、图片、输出放在外部目录，可以避免升级时误删个人数据。

### 为什么有时回复慢？

常见原因包括：

- 当前模型本身首包慢。
- 网络或代理慢。
- 请求进入了 Agent 模式，需要分析上下文或等待工具执行。
- 注入的记忆、Skill 或历史上下文过多。
- 图片、文件、长文档任务本身耗时更高。

优化方向通常是：普通聊天走直连、控制上下文长度、只注入必要 Skill、选择首包更快的模型。

### 需要数据库吗？

当前设计主要使用本地文件和 JSON 存储，不依赖外部数据库。这样更容易安装和迁移，也更符合本地优先定位。

### 可以部署到服务器吗？

技术上可以，但默认设计更偏本地使用。如果要部署到服务器，请务必增加访问控制、HTTPS、反向代理安全规则和密钥保护，不建议把未加保护的 WebUI 暴露到公网。

## 隐私与安全建议

- 不要提交真实 API Key。
- 不要把个人记忆目录上传到公开仓库。
- 不要把私人图片、聊天记录、输出文件提交到公开仓库。
- 不要在截图中暴露密钥、邮箱、真实路径或私人项目名。
- 不熟悉安全配置时，不要把 WebUI 暴露到公网。
- 更新前先备份外部数据目录。

## 开发说明

常用命令：

```powershell
npm install
npm start
npm run health
```

开发时可以关注：

- `backend/server.js`：后端服务入口。
- `backend/routes/`：API 路由。
- `backend/services/`：核心服务逻辑。
- `index.html`：主界面结构。
- `app-new.js`：前端交互主逻辑。
- `frontend/css/hermes-theme-vars.css`：主题变量。

如果修改了前端样式或交互，建议启动后访问：

```text
http://127.0.0.1:3381/
```

并检查聊天、设置、Skill、弹窗和图片相关功能是否正常。

## 适合谁使用

这个 WebUI 更适合：

- 想在本地管理多个 AI 模型的用户。
- 想使用 Hermes Agent，但希望有更直观界面的用户。
- 想把记忆、Skill、图片和输出沉淀到本地目录的用户。
- 想要普通聊天快、复杂任务又能调用 Agent 的用户。
- 希望自己能看懂目录结构并继续二次开发的用户。

如果你只需要一个极简在线聊天页面，这个项目可能偏重；如果你希望把 AI 逐渐变成自己的本地工作台，它会更合适。

## License

请根据你的实际发布计划补充许可证说明。如果仓库暂未选择开源许可证，其他人默认没有获得复制、修改和分发代码的明确授权。
