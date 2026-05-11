# AgentAsk 弹窗机制使用教程

本文档面向会生成提问结构的 AI。目标是让你稳定触发 WebUI 的交互式提问弹窗，而不是把问题直接输出成普通文本。

## 1. 什么时候使用

当你需要用户明确选择、补充输入、或在多个方案里做决定时，使用 AgentAsk 弹窗。

适用场景：
- 需要用户二选一 / 多选
- 需要用户从若干预设项中选择
- 需要用户选择后再补充说明
- 一个问题回答完之前，不适合继续执行后续步骤

不适用场景：
- 只是普通闲聊
- 不需要用户决策
- 可以直接继续完成任务

---

## 2. 推荐输出格式

前端支持两类格式，推荐优先使用第一种。

### 格式 A：`<ask_user>` 包裹 JSON

这是最稳定的写法。

```xml
<ask_user>
{
  "title": "需要你确认",
  "questions": [
    {
      "header": "部署方式",
      "question": "这次改动要怎么部署？",
      "multiSelect": false,
      "required": true,
      "options": [
        {
          "label": "直接替换",
          "description": "覆盖当前版本，步骤最少"
        },
        {
          "label": "灰度发布",
          "description": "先小范围验证，再全量切换"
        }
      ],
      "placeholder": "如果以上都不合适，可自行补充",
      "maxLength": 0
    }
  ]
}
</ask_user>
```

### 格式 B：工具调用风格 JSON

如果运行环境会把结构作为 `AskUserQuestion / ask_user / clarify` 工具参数传给前端，也可以使用同样的数据结构。

核心字段仍然是：
- `questions`
- `question` / `header`
- `multiSelect`
- `options`
- `description`
- `placeholder`
- `maxLength`

---

## 3. 字段说明

### 顶层字段

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---:|---|
| `title` | string | 否 | 弹窗顶部标题 |
| `questions` | array | 推荐 | 多题模式，前端会渲染成分题切换 |
| `question` | string | 单题时可用 | 单题写法 |
| `options` | array | 单题时可用 | 单题选项 |
| `multiSelect` | boolean | 单题时可用 | 单题是否多选 |

### `questions[]` 内字段

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---:|---|
| `header` | string | 否 | 题目短标题 |
| `question` | string | 推荐 | 完整题目文案 |
| `multiSelect` | boolean | 推荐 | `true` 为多选，`false` 为单选 |
| `required` | boolean | 否 | 默认必答 |
| `options` | array | 推荐 | 选项列表 |
| `placeholder` | string | 否 | “其他 / 自行输入”时的提示 |
| `maxLength` | number | 否 | 自定义输入最大长度；`0` 或不传表示不限 |

### `options[]` 内字段

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---:|---|
| `label` | string | 是 | 主标题 |
| `description` | string | 强烈推荐 | 辅助说明，小字显示 |
| `value` | string | 否 | 提交值；不写时默认取 `label` |

---

## 4. 单选示例

```xml
<ask_user>
{
  "title": "需要确认",
  "questions": [
    {
      "header": "数据库方案",
      "question": "你想采用哪种数据库迁移方式？",
      "multiSelect": false,
      "options": [
        {
          "label": "一次性迁移",
          "description": "实现快，但回滚空间较小"
        },
        {
          "label": "分阶段迁移",
          "description": "更稳妥，适合线上数据量较大时使用"
        }
      ],
      "placeholder": "也可以直接说明你的偏好",
      "maxLength": 0
    }
  ]
}
</ask_user>
```

---

## 5. 多选示例

```xml
<ask_user>
{
  "title": "需要补充信息",
  "questions": [
    {
      "header": "本次关注点",
      "question": "你希望我这轮优先处理哪些问题？",
      "multiSelect": true,
      "options": [
        {
          "label": "UI 对齐",
          "description": "布局、间距、视觉层级"
        },
        {
          "label": "交互逻辑",
          "description": "点击行为、状态切换、提交流程"
        },
        {
          "label": "性能问题",
          "description": "卡顿、抖动、重绘过多"
        }
      ],
      "placeholder": "还可以补充其他关注点",
      "maxLength": 0
    }
  ]
}
</ask_user>
```

说明：
- `multiSelect: true` 时，用户可以选择多个选项。
- “其他”也可以和已有选项同时存在。

---

## 6. 多题示例

```xml
<ask_user>
{
  "title": "继续执行前需要确认",
  "questions": [
    {
      "header": "问题 1",
      "question": "你希望先改哪一部分？",
      "multiSelect": false,
      "options": [
        { "label": "前端", "description": "先处理界面和交互" },
        { "label": "后端", "description": "先处理接口和数据流" }
      ],
      "maxLength": 0
    },
    {
      "header": "问题 2",
      "question": "你希望我附带做哪些验证？",
      "multiSelect": true,
      "options": [
        { "label": "语法检查", "description": "确保没有明显语法错误" },
        { "label": "手动联调", "description": "验证实际交互是否正常" },
        { "label": "边界测试", "description": "验证异常输入和极端情况" }
      ],
      "placeholder": "如果你有别的验证方式，也可以直接输入",
      "maxLength": 0
    }
  ]
}
</ask_user>
```

说明：
- 多题模式会显示为“问题 1 / 问题 2 / ...”的切换结构。
- 每一题都可以独立设置 `multiSelect`。
- 所以可以出现：第 1 题单选，第 2 题多选。

---

## 7. 最佳实践

### 应该做
- 始终提供清晰的 `question`
- 每个选项尽量附带 `description`
- 多选时显式写 `multiSelect: true`
- 想允许长文本补充时，用 `maxLength: 0` 或直接不传
- 让选项数量控制在 2~6 个，便于用户快速判断

### 不要做
- 不要把提问写成普通段落文本，前端不会弹窗
- 不要漏掉 `options`
- 不要把 `description` 写成很长的段落
- 不要把几十个选项一次性塞进去
- 不要同时输出多个无关的 `<ask_user>` 块

---

## 8. 提交后的返回结果理解

用户提交后，前端会把回答整理成文本再发回对话。

典型形式类似：

```text
[部署方式] 用户的选择是: 灰度发布
[本次关注点] 用户的选择是: UI 对齐, 交互逻辑 - 还要兼顾移动端
```

其中：
- 选中的标准项会被串联起来
- 如果用户填写了“其他”，会附加在后面

---

## 9. 最推荐模板

如果你不知道怎么写，直接套这个：

```xml
<ask_user>
{
  "title": "需要你确认",
  "questions": [
    {
      "header": "问题 1",
      "question": "请做出选择",
      "multiSelect": false,
      "required": true,
      "options": [
        {
          "label": "选项 A",
          "description": "简短说明 A"
        },
        {
          "label": "选项 B",
          "description": "简短说明 B"
        }
      ],
      "placeholder": "如有其他想法可直接输入",
      "maxLength": 0
    }
  ]
}
</ask_user>
```

这个模板兼容性最好，建议优先使用。
