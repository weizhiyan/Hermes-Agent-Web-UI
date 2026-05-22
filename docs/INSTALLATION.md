# Hermes Agent WebUI 安装与更新

## 1. 默认地址

WebUI 默认端口：

```text
3381
```

启动后访问：

```text
http://127.0.0.1:3381
```

## 2. 快速启动

Windows 推荐直接运行：

```bat
start.bat
```

或 PowerShell：

```powershell
.\start.ps1
```

如果第一次运行缺依赖，先执行：

```powershell
npm install
```

然后启动：

```powershell
npm start
```

## 3. 更新 WebUI

如果项目来自 GitHub，可以运行：

```bat
update.bat
```

它会执行：

```text
git pull --ff-only
npm install
```

手动更新：

```powershell
git pull --ff-only
npm install
```

更新后重启 WebUI。

## 4. 数据目录建议

建议把记忆和输出放到项目外部，例如：

```text
F:\AI\Hermes Agent\记忆
```

推荐结构：

```text
F:\AI\Hermes Agent\记忆\core
F:\AI\Hermes Agent\记忆\skill
F:\AI\Hermes Agent\记忆\output-md
F:\AI\Hermes Agent\记忆\images
F:\AI\Hermes Agent\记忆\history-md
```

这样更新代码时不会影响长期数据。

## 5. 多电脑迁移

新电脑上：

```powershell
git clone <仓库地址>
cd WEB-UI
npm install
```

然后复制你的外部记忆目录，并在 WebUI 设置页重新选择路径。

## 6. 常见问题

### 端口被占用

检查 3381：

```powershell
Get-NetTCPConnection -LocalPort 3381 -State Listen
```

### 后端是否启动

访问：

```text
http://127.0.0.1:3381/api/health
```

返回 `ok` 表示后端正常。

### 普通聊天为什么快了

当前默认是自动路由：普通聊天直连模型 API，复杂任务才切 Hermes Agent。

### 什么时候需要 Hermes CLI / WSL

只有需要 Agent 执行能力时才需要，例如运行命令、修改文件、代码维护、项目扫描等。