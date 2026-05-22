# Hermes Agent WebUI 安装与更新

这份文档说明如何安装、启动、更新、切换版本和迁移 Hermes Agent WebUI。当前默认端口为 `3381`。

## 1. 环境要求

- Node.js 18 或更高版本。
- Windows 10/11、Linux 或 macOS。
- 如果需要通过 GitHub 更新，建议安装 Git。
- 如果需要复杂 Agent 执行能力，请准备 Hermes Agent CLI、WSL 或对应运行环境。

## 2. 默认访问地址

```text
http://127.0.0.1:3381
```

健康检查：

```text
http://127.0.0.1:3381/api/health
```

返回正常响应表示后端已启动。

## 3. Windows 快速启动

推荐双击：

```bat
start.bat
```

也可以使用 PowerShell：

```powershell
.\start.ps1
```

如果依赖缺失，先执行：

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

启动后访问：

```text
http://127.0.0.1:3381
```

如果不熟悉 Git，也可以在 GitHub 页面点击 `Code → Download ZIP` 下载当前最新版。

## 5. 更新 WebUI

如果你是从 GitHub 克隆的项目，可以双击：

```bat
update.bat
```

它会执行类似逻辑：

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

WebUI 设置页提供“更新中心”：

- 刷新状态：读取本地分支、提交、标签和本地改动数量。
- 检查远端：执行安全的 `git fetch --tags --prune`，判断 GitHub 是否有新版本。
- 查看方法：显示手动更新流程。

更新中心不会自动执行 `git pull`，也不会自动覆盖本地文件。

## 6. 下载历史版本

GitHub 仓库主页默认是最新版。如果要下载历史版本，请打开 `Tags` 或 `Releases`，选择对应版本标签。

Git 切换旧版本：

```powershell
git fetch --tags
git checkout v1.2.0
npm install
```

回到最新版：

```powershell
git checkout main
git pull --ff-only
npm install
```

注意：切换版本前，建议确认本地没有未保存的代码改动。

## 7. 数据目录建议

建议把长期数据放在项目目录外部，例如：

```text
D:\HermesData
```

推荐结构：

```text
D:\HermesData\memory
D:\HermesData\skill
D:\HermesData\images
D:\HermesData\history-md
D:\HermesData\output-md
D:\HermesData\backups
```

这样更新代码、删除旧版本或迁移到新电脑时，不会影响长期记忆、图片和输出内容。

## 8. 迁移到新电脑

推荐流程：

1. 在旧电脑设置页执行“一键备份导出”。
2. 复制外部数据目录到新电脑。
3. 在新电脑安装 WebUI。
4. 在设置页重新配置数据根目录、记忆目录、图片目录和输出目录。
5. 重启 WebUI。

## 9. 备份导出

设置页提供“一键备份导出”。备份文件会保存到数据目录的 `backups` 子目录。

备份包含：

- 设置
- 模型配置
- Skill 配置
- 聊天索引
- 网关配置
- 数据目录文件清单

备份会自动脱敏 API Key、Token、密码等字段。

## 10. 常见问题

### 更新会不会覆盖记忆？

不会，只要你把记忆和输出目录放在项目外部，并在设置页配置路径。更新代码只影响 WebUI 程序文件。

### 直接下载 ZIP 是最新版吗？

是。GitHub 仓库页面 `Code → Download ZIP` 下载的是当前 `main` 分支最新版。

### 怎么下载旧版本？

进入 GitHub 的 `Tags` 或 `Releases`，选择 `v1.0.0`、`v1.1.0`、`v1.2.0`、`v1.3.0` 等标签下载源码包。

### 可以把个人路径写进文档吗？

不建议。公开文档应只使用通用示例路径，例如 `D:\HermesData`，不要暴露真实用户名、磁盘结构、密钥或私有目录。
