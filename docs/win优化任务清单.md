# Hermes Agent WebUI — Windows 优化任务清单

> 项目路径: `E:\AI\WEB-UI`
> 原运行环境: WSL（已弃用）| 当前环境: Windows 原生
> 生成时间: 2026-06-09

---

## 🔴 P0 — 必须修复（功能异常）

### T1. settings.json 路径修正

**文件**: `backend/data/settings.json`

**现状**: 6 个路径使用 WSL 格式 `/mnt/e/AI/记忆`，Windows 原生 Node.js 无法正确解析。

**操作**: 将以下路径值从 `/mnt/e/AI/记忆` 改为 `E:/AI/记忆`：

- `dataRootDir`: `/mnt/e/AI/记忆` -> `E:/AI/记忆`
- `memoryDir`: `/mnt/e/AI/记忆/memory` -> `E:/AI/记忆/memory`
- `imageDir`: `/mnt/e/AI/记忆/images` -> `E:/AI/记忆/images`
- `historyDir`: `/mnt/e/AI/记忆/history-md` -> `E:/AI/记忆/history-md`
- `mdLibraryDir`: `/mnt/e/AI/记忆/output-md` -> `E:/AI/记忆/output-md`

> 注意: 如果 `E:/AI/记忆` 不存在，需先创建，或改为项目内路径如 `E:/AI/WEB-UI/backend/data/memory`

### T2. .hermes/config.yaml MCP 路径修正

**文件**: `C:\Users\Administrator\.hermes\config.yaml`

**现状**: `command: /mnt/c/Progra~1/nodejs/node.exe`，WSL 路径 Windows 下不可用。

**操作**: 改为:
```yaml
mcp_servers:
  webui_image:
    command: node
    args:
    - E:\AI\WEB-UI\backend\mcp\webui-image-server.js
    env:
      WEBUI_API: http://127.0.0.1:3381
    enabled: true
```

### T3. images.json WSL 图片路径

**文件**: `backend/data/images.json`（114KB）

**现状**: 图片路径存储为 `/mnt/f/AI/Hermes Agent/WEB-UI/backend/data/images/...`。虽然 images.js 的 normalizeStoredImagePath() 会尝试把 /mnt/f/ 转 F:\，但项目已移至 E 盘，路径不匹配。

**操作（推荐方案）**:
1. 检查 `E:\AI\WEB-UI\backend\data\images\outputs\2026-05\` 和 `inputs\2026-05\` 目录是否有图片
2. 编写脚本将 images.json 中所有 `/mnt/f/AI/Hermes Agent/WEB-UI/backend/data/images/` 前缀去掉，改为相对路径（只保留 `outputs/xxx` 或 `inputs/xxx` 部分）
3. 给每条记录添加 `relativePath` 字段

### T4. webui-image-server.js 移除 Linux 特有代码

**文件**: `backend/mcp/webui-image-server.js`

**现状**: `candidateWebuiApis()` 读取 `/etc/resolv.conf`（Linux 文件），Windows 上不存在。

**操作**: 删除第 15-18 行（try/catch 中读取 /etc/resolv.conf 的部分），只保留环境变量和 localhost 候选。

---

## 🟡 P1 — 重要优化

### T5. supervisor.js Ctrl+C 改为优雅退出

**文件**: `backend/supervisor.js` 第 90-92 行

**现状**:
```js
process.on('SIGINT', () => {
  log('Ctrl+C ignored. Close this terminal window to stop WebUI.');
});
```

**操作**: 改为调用 stop():
```js
process.on('SIGINT', () => {
  log('SIGINT received, stopping...');
  stop();
});
```

### T6. hermes-sessions 目录清理

**目录**: `backend/data/hermes-sessions/`（474 个文件，102.7 MB）

**现状**: 无任何自动清理机制，持续膨胀。

**操作（三选一）**:
1. 立即删除所有 `request_dump_*.json` 和 `session_run_*.json`
2. 或只保留最近 7 天的文件
3. 或在 supervisor 启动时自动归档超过 30 天的文件

### T7. chats.json 体积控制

**文件**: `backend/data/chats.json`（865KB 持续增长）

**操作**: 若不需要保留历史，清空为 `[]`。或在启动逻辑中增加大小警告。

---

## 🟢 P2 — 清理与维护

### T8. 删除冗余启动文件

| 文件 | 操作 |
|------|------|
| `hermes-start.bat` | 删除（和 start.bat 相同） |
| `start.sh` | 删除（Linux 脚本） |
| `start-win.bat` | 删除（硬编码路径，不用 supervisor） |
| `start.bat` | 保留 |
| `launch.bat` | 保留 |
| `start.ps1` | 保留 |

### T9. 清理 .claude/ 配置

删除 `.claude/` 下 12 个 `hermes_config_*.yaml` 文件（WSL 路径残留）。

### T10. 清理迁移备份

确认数据正常后删除 `backend/data/migration-backups/`（983KB）。

### T11. 前端字体优化（可选）

Alibaba PuHuiTi 3 四个 TTF 字体文件，建议转为 woff2 格式以减小体积。

---

## 🔵 P3 — 长期建议

### T12. 日志轮转
logs/ 下 server.log / supervisor.log 等无限追加，建议超过 10MB 自动归档。

### T13. 图片引用统一为相对路径
chats.json 中大量硬编码 `F:\AI\...` 和 `C:\Users\...` 路径，建议改为相对路径存储。

### T14. highlight.js 精简
当前包含 190+ 语言定义，建议只打包实际使用的几种。

---

## 执行顺序

```
第一步: T1 + T2 + T4  -> 修路径，让服务能启动
第二步: T3            -> 修复历史图片索引
第三步: T5 + T6       -> 用户体验 + 磁盘清理
第四步: T8 + T9 + T10 -> 清理冗余文件
```
