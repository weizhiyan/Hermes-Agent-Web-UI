# 安装说明

## 最简单的方式

1. 安装 `Node.js 18+`。
2. 把项目解压到一个普通文件夹。
3. Windows 用户双击 `start.bat`。
4. 等待窗口自动完成安装。
5. 打开 `http://127.0.0.1:8787/`。

## 其他系统

### PowerShell

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
.\start.ps1
```

### Linux / macOS

```bash
cp .env.example .env
chmod +x start.sh
./start.sh
```

### Docker

```bash
docker compose up --build
```

## 迁移到其他电脑

复制这几个东西就行：

- 项目文件夹
- `.env`（如果你改过配置）
- `backend/data/`
- `logs/`（可选）

## 端口

- 默认端口：`8787`
- 如果打不开，先检查这个端口有没有被别的程序占用

## 服务检查

打开：

```text
http://127.0.0.1:8787/api/health
```

返回正常就说明服务启动好了。

