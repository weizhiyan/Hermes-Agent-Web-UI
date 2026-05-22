# Hermes Agent WebUI 安装与更新

这份文档说明如何在本地安装、启动、更新和迁移 Hermes Agent WebUI。当前默认端口统一为 `3381`。

## 1. 环境要求

- Windows 10/11，或支持 Node.js 的 Linux/macOS。
- Node.js 18+。
- 如果需要通过 GitHub 更新，建议安装 Git。
- 如果需要复杂 Agent 执行能力，按你的 Hermes Agent 环境准备 CLI、WSL 或相关运行时。

## 2. 默认访问地址

```text
http://127.0.0.1:3381
```

健康检查地址：

```text
http://127.0.0.1:3381/api/health
```

返回 `ok` 表示后端正常。

## 3. Windows 快速启动

推荐直接双击：

```bat
start.bat
```

或者使用 PowerShell：

```powershell
.\start.ps1
```

首次运行如果缺少依赖，可以手动执行：

```powershell
npm install
npm start
```

## 4. 从 GitHub 安装

```powershell
git clone https://github.com/weizhiyan/Hermes-Agent-Web-UI.git
cd Hermes-Agent-Web-UI
npm install
npm start
```

启动后打开：

```text
http://127.0.0.1:3381
```

## 5. 更新 WebUI

如果你已经从 GitHub 克隆了项目，可以双击：

```bat
update.bat
```

它会执行：

```text
git pull --ff-only
npm install
```

也可以手动更新：

```powershell
git pull --ff-only
npm install
```

更新后重启 WebUI。

## 6. 版本切换

如果 GitHub 上已经发布了版本标签，例如 `v1.2.0`、`v1.3.0`，可以这样切换：

```powershell
git fetch --tags
git checkout v1.2.0
npm install
```

如果想回到最新版主分支：

```powershell
git checkout main
git pull --ff-only
npm install
```

注意：切换版本前，建议先确认本地没有未保存的代码改动。

## 7. 数据目录建议

建议把记忆、图片、历史和输出 Markdown 放到项目外部，例如：

```text
F:\AI\Hermes Agent\记忆
```

推荐结构：

```text
F:\AI\Hermes Agent\记忆\core
F:\AI\Hermes Agent\记忆\skill
F:\AI\Hermes Agent\记忆\images
F:\AI\Hermes Agent\记忆\history-md
F:\AI\Hermes Agent\记忆\output-md
```

这样更新 WebUI 代码、删除旧版本文件或迁移到新电脑时，不会影响长期记忆和输出内容。

## 8. 多电脑迁移

新电脑操作流程：

```powershell
git clone https://github.com/weizhiyan/Hermes-Agent-Web-UI.git
cd Hermes-Agent-Web-UI
npm install
npm start
```

然后把外部记忆目录复制到新电脑，在 WebUI 设置页重新配置：

- 数据根目录
- 记忆目录
- 图片目录
- 历史 Markdown 目录
- 输出 Markdown 目录

只要路径配置正确，WebUI 会自动读取新位置的数据。

## 9. 常见问题

### 端口被占用

检查 `3381`：

```powershell
Get-NetTCPConnection -LocalPort 3381 -State Listen
```

如需结束占用进程，先确认进程来源，再停止对应 PID。

### 普通聊天为什么更快

当前默认是自动路由：普通聊天直连模型 API，复杂文件/命令/代码任务才切换到 Hermes Agent。这样减少了 CLI、WSL 和 Agent 启动开销。

### 什么时候需要 Hermes CLI / WSL

只有需要真实执行能力时才需要，例如运行命令、修改文件、代码维护、项目扫描、批量处理文件等。

### 更新会不会覆盖记忆

不会，只要你把记忆和输出目录放在项目外部，并在设置页配置路径。更新代码只影响 WebUI 程序文件。
