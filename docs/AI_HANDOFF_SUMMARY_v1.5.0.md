# Hermes Agent WebUI v1.5.0 交接摘要

> 用途：给其他 AI / 开发者快速了解当前 WebUI 状态、已完成优化、核心逻辑和后续注意事项。本文已避免写入个人敏感路径、API Key、Token 等信息。

## 1. 当前版本状态

- 当前发布版本：`v1.5.0`
- GitHub 仓库：`weizhiyan/Hermes-Agent-Web-UI`
- 默认端口：`3381`
- GitHub 默认分支：`master`
- 本地开发分支：`main`
- 最新标签：`v1.5.0`
- 当前版本已推送到 GitHub，并已创建 `v1.5.0` tag。

## 2. 项目定位

Hermes Agent WebUI 是一个本地 Web 管理界面，用来连接和控制 Hermes Agent，同时支持：

- 普通对话
- Hermes Agent 工具调用
- 模型配置
- WebUI 直连模式
- 知识库 / Markdown 文档管理
- 图片生成与图片结果保存
- Skill 管理
- 设置页统一配置
- 本地记忆目录、图片目录、Markdown 输出目录配置

核心原则：

- 不改变 Hermes Agent 原有能力，只在 WebUI 层做体验和路由优化。
- 普通对话可以走 WebUI 直连以提升速度。
- 复杂任务、文件操作、终端操作、工具调用仍应走 Hermes Agent。
- 敏感配置尽量保存在本地，不写入公开文档。

## 3. v1.5.0 主要完成内容

### 3.1 WebUI 本地 Relay

新增本地 OpenAI 兼容中转通道：

- 新增后端路由：`backend/routes/relay.js`
- 后端挂载 `/v1`
- Hermes Agent 可以把 WebUI 当成 OpenAI-compatible endpoint 使用。
- WebUI relay 再转发到用户在模型配置中维护的真实中转模型。

用途：

- 解决 Hermes Agent 直接使用某些中转站模型不稳定、配置不一致的问题。
- 让 Hermes Agent 和 WebUI 共用一套模型配置。

注意：

- Relay 不能剥离 `tools`，否则 Agent 会认为自己没有工具。
- 之前已恢复 tools 透传。
- 如果模型不支持稳定工具调用，仍可能出现工具循环或工具不可用，需要换更稳定的模型。

### 3.2 模型配置与运行模式

当前逻辑：

- 设置页中的“快速模式”决定执行通道：
  - 开启：WebUI 直连模型。
  - 关闭：Hermes Agent 模式。
- 模型配置页只维护模型，不再额外放 WebUI / Hermes Agent 切换入口。
- WebUI 和 Hermes Agent 可以分别保存模型配置，但输入和维护入口尽量保持一致。

已优化内容：

- 移除模型配置页中多余的 WebUI / Hermes Agent 选择提示。
- 模型配置 UI 恢复为新版本布局。
- API Key 增加显示 / 隐藏入口。
- 删除模型库中的测速按钮。
- 优化模型库卡片、下拉框、Provider 分组样式。

### 3.3 知识库 / Markdown 文档编辑

这是 v1.5.0 的重点。

已完成：

- 右侧“文档库”统一改为“知识库”。
- 知识库支持预览模式和代码模式。
- 代码模式支持自动保存。
- 代码模式支持粘贴图片，并插入为 Markdown 图片引用。
- 文档顶部增加返回按钮和当前文档标题。
- 顶部复制入口移动到文档标题栏右侧。
- 下拉菜单中的“下载”改为“打开当前 MD 文档”。
- 删除“保存到本地文档库”这个多余入口。
- 修复刷新后标题错误、内容丢失、预览 / 代码切换后不显示等问题。

### 3.4 局部编辑能力

用户需求：选中知识库文档里的局部内容后，能够让 AI 只修改这一段，而不是每次重写全文。

当前已实现逻辑：

1. 用户在预览或代码模式中选中文本。
2. 页面出现“局部编辑”浮层按钮。
3. 点击后，会把局部编辑任务插入聊天输入框。
4. 同时 WebUI 记录结构化上下文：
   - 当前文档标题
   - 当前文档路径
   - 选区来源：预览 / 代码
   - 选区文本
   - 当前文档快照
5. 发送消息时，WebUI 会把这些上下文作为隐藏任务上下文一并传给 Agent。
6. 助手回复完成后，消息下方会出现“应用到选区”按钮。
7. 点击后，WebUI 会尝试将助手回复内容替换回原文档选区，并保存。

涉及文件：

- `frontend/js/hermes-artifact.js`
- `app-new.js`
- `backend/routes/system.js`
- `index.html`

注意：

- 当前是“选区匹配替换”逻辑。
- 如果原文档选区内容在 AI 回复期间被用户改动，可能无法自动替换，会提示选区已变化。
- 这是一个安全保守方案，避免误替换全文。

### 3.5 知识库文件菜单

历史卡片菜单新增：

- 复制文件
- 移动分类
- 编辑命名
- 删除

新增后端接口：

- `POST /api/system/md-library/copy`
- `POST /api/system/md-library/move`

移动分类当前使用简单输入方式，后续可改为更漂亮的弹窗 / 分类选择器。

### 3.6 UI / 视觉规范调整

已完成的主要 UI 优化：

- 统一默认字体为阿里巴巴普惠体 3.0。
- 常规控件字号：约 `14px`。
- 正文阅读字号：约 `16px`。
- 优化知识库按钮圆角。
- 优化聊天输入框高度：最小高度保持当前效果，最大高度约 `320px`。
- 工具栏按钮改为只保留 icon。
- 优化代码块 hover 复制按钮。
- 删除图片提示词标题栏多余复制 icon。
- 修复深色模式下部分 textarea 没有引用变量导致变白的问题。
- 优化设置页、模型配置页、历史记录弹窗、文件树背景变量。
- 优化小尺寸下布局：左侧导航优先保留，右侧历史会收起。
- 优化 artifact tooltip 层级，避免被文档头遮挡。

### 3.7 Skill / 弹窗 / Agent 反问

已完成：

- 增加 Agent 反问弹窗能力。
- 支持类似 Claude Code 的“Agent 暂停并询问用户”流程。
- 弹窗卡片样式已调整：
  - 默认线性风格
  - hover 浅灰背景
  - 选中浅色背景
  - 无位移、无下划线
  - 标题只保留一个
- Skill 页去掉了无用推荐模板，保留当前 Skill 管理逻辑。

## 4. 安装与更新逻辑

### 4.1 安装

通常只需要：

1. 下载 GitHub 仓库。
2. 安装 Node.js。
3. 在项目目录运行安装命令。
4. 启动 WebUI。
5. 浏览器打开 `http://127.0.0.1:3381/`。

注意：

- `127.0.0.1:3381` 是本机地址，外部用户不能通过这个地址访问你的电脑。
- 公开 README 中不应写入个人本地路径。
- 图片资源可以保留 GitHub 上的展示图片，但不要包含本机敏感路径或密钥。

### 4.2 更新

如果另一台电脑已经 clone 过仓库：

```bash
git pull
npm install
npm start
```

如果使用 release 压缩包，则去 GitHub Tags / Releases 下载指定版本。

当前版本标签：

- `v1.5.0`

## 5. 当前需要注意的问题

### 5.1 Git 分支状态

- GitHub 默认分支是 `master`。
- 本地开发分支是 `main`。
- 发布时使用：

```bash
git push origin main:master
git push origin v版本号
```

不要误以为推到本地 `main` 就一定更新了 GitHub 首页。

### 5.2 Hermes Agent 模型工具调用

WebUI relay 可以让 Hermes Agent 连接中转模型，但是否能稳定工具调用取决于模型本身。

建议：

- 普通对话可用速度快的模型。
- 文件、终端、工具任务建议使用工具调用稳定的模型。
- 不要删除 relay 中的 tools 透传逻辑。

### 5.3 敏感信息

不要把以下内容写入 README、docs 或 GitHub：

- API Key
- Bearer Token
- 个人真实本机绝对路径
- 私有中转站密钥
- 账号密码
- 本地配置文件完整内容

## 6. 后续可优化方向

建议后续按优先级处理：

1. 给“移动分类”做成 WebUI 内部弹窗，而不是浏览器原生 prompt。
2. 局部编辑可升级为 diff 预览，再确认应用。
3. 为知识库文档增加版本历史 / 回滚。
4. 为 WebUI relay 增加模型健康检查。
5. 增加“普通对话模型”和“工具任务模型”的自动路由。
6. 优化 GitHub Release 页面说明，不只是 tag。
7. 对 README 做一次版本截图和功能图同步。

## 7. 给接手 AI 的建议

如果继续开发，请优先查看：

- `app-new.js`：主界面、聊天发送、模型配置、设置页等核心前端逻辑。
- `frontend/js/hermes-artifact.js`：右侧知识库 / Artifact / Markdown 编辑核心逻辑。
- `backend/routes/system.js`：文件内容、知识库、打开路径、复制移动等系统接口。
- `backend/routes/relay.js`：WebUI 本地模型 relay。
- `backend/services/hermes.js`：Hermes Agent 启动、模型配置转换、环境变量注入。
- `index.html`：大量全局样式和布局 CSS。
- `frontend/css/hermes-theme-vars.css`：主题变量、字体变量。

开发原则：

- 小步修改。
- 不要重构大文件结构，除非明确要求。
- 不要删除 tools 透传。
- 不要把个人路径和密钥写入公开文件。
- 修改后至少运行：

```bash
node --check app-new.js
node --check frontend/js/hermes-artifact.js
node --check backend/routes/system.js
node --check backend/routes/relay.js
```

## 8. 当前发布记录

- `v1.5.0`：知识库局部编辑、WebUI relay、字体/UI 规范、知识库文件操作、文档编辑体验优化。
- `v1.4.0`：设置页与模型配置页重构、聊天输入框和 UI 细节优化。
- `v1.3.0`：Agent 反问弹窗、工具权限、更新中心、备份导出、Skill 优化。
- `v1.2.0`：Agent 路由策略、任务日志、Hermes API Server 预留。
- `v1.1.0`：端口统一为 `3381`，直连 / Agent 自动路由，记忆与 Skill 注入优化。
- `v1.0.0`：基础 WebUI、Markdown 预览、安装脚本、Docker 支持。
