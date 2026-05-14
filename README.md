# Hermes Agent WebUI

Hermes Agent WebUI 是一个本地优先的 AI 工作台，支持对话、文件、记忆、技能和预览。

## 安装方式

### 方式一：Windows 一键启动

双击 `start.bat`。

首次运行会自动安装后端依赖并启动服务。

### 方式二：PowerShell

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
.\start.ps1
```

### 方式三：Linux / macOS

```bash
cp .env.example .env
chmod +x start.sh
./start.sh
```

### 方式四：Docker / Docker Compose

```bash
docker compose up --build
```

如需改端口，先复制 `.env.example` 为 `.env` 后再修改。

## 手动启动

```powershell
cd backend
npm install
npm start
```

打开 `http://127.0.0.1:8787/`。

## 推荐部署方式

- 本机快速体验：`start.bat`
- 跨电脑复制使用：`Docker Compose`
- 服务器部署：`Docker Compose` 或 `npm start` + 进程守护

## 文件结构

- `index.html`：前端壳和样式
- `app-new.js`：前端主逻辑
- `backend/server.js`：后端入口
- `backend/data/`：运行数据
- `frontend/css/hermes-theme-vars.css`：可手改的主题变量
- `.env`：可选运行配置，和启动脚本、Docker Compose 共用

## 说明

- 默认端口：`8787`
- 需要 `Node.js 18+`
- Docker 部署会挂载 `backend/data/` 和 `logs/`，方便迁移与持久化
