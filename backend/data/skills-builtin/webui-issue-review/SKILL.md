---
name: WebUI 问题复盘
category: WebUI 质量
source: builtin
---
# WebUI 问题复盘 Skill

用于整理 Hermes WebUI 自动采集和用户手动记录的问题，生成可修复的问题清单。

## 数据来源

- WebUI 问题接口：`GET /api/issues?limit=200`
- Markdown 报告：`GET /api/issues/report/markdown?status=open`
- 系统日志：`GET /api/system/logs?limit=200`
- 对话执行过程：消息中的 `processEvents`、`toolCalls`、`imageGeneration`、`promptDebug`

## 整理格式

每个问题按以下结构整理：

1. 问题是什么
2. 用户如何触发
3. 实际表现
4. 预期表现
5. 可能原因
6. 影响范围
7. 优先级
8. 建议修复方案
9. 验收标准

## 判断规则

- 自动采集的问题不一定是真 bug，需要结合用户描述和上下文判断。
- 用户手动记录的问题优先级高于纯自动错误。
- 没有报错但用户认为体验不对，也要记录为体验问题。
- 对图片加载失败、SSE 中断、工具失败、Hermes 退出，要优先追踪最近一次请求和工具事件。
- 不要把“已记录问题”当成“已修复问题”。

## 输出要求

- 用 Markdown 输出。
- 按优先级从高到低排序。
- 每个问题给出可执行修复建议和可验证验收标准。
- 不要编造不存在的日志；缺少证据时标记为“需要复现”。
