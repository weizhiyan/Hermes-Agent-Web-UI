# Hermes Agent 安装指南

## 参考的主流 WebUI 安装模式

热门 WebUI 通常提供以下入口：

- Docker / Docker Compose：适合跨电脑、服务器和团队部署。
- `.env.example`：把端口、环境变量和密钥配置显式列出来。
- 一键启动脚本：适合 Windows 或本地用户快速运行。
- `npm start` / `npm install`：适合开发者手动调试。
- `/api/health`：用于启动脚本、Docker healthcheck 和运维探活。

Hermes Agent 现在也按这个模式提供安装入口。

## Windows 快速安装

1. 安装 Node.js 18+。
2. 解压或克隆项目。
3. 双击 `start.bat`。
4. 打开 `http://127.0.0.1:8787/`。

## PowerShell 安装

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
.\start.ps1
```

## Linux / macOS 安装

```bash
cp .env.example .env
chmod +x start.sh
./start.sh
```

## Docker Compose 安装

```bash
docker compose up --build
```

如果需要修改端口或其他变量，可先复制 `.env.example` 到 `.env`。

后台运行：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

## 环境变量

复制 `.env.example` 到 `.env` 后可修改：

- `PORT`：WebUI 端口，默认 `8787`。
- `NODE_ENV`：运行环境，Docker 默认 `production`。

## 数据迁移

需要迁移到其他电脑时，复制以下内容：

- 项目源码
- `.env`（如果存在）
- `backend/data/`
- `logs/`（可选）

Docker Compose 会把 `backend/data/` 和 `logs/` 映射为本地目录，便于备份。

## 健康检查

启动后访问：

```text
http://127.0.0.1:8787/api/health
```

返回 `code: 0` 表示服务正常。
