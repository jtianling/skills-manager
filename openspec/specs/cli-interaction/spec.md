# CLI Interaction

skillsmgr 的命令行交互体验: 命令结构, 交互式提示, 视觉反馈, 错误处理.

## 命令结构

程序名: `skillsmgr`
框架: Commander.js
版本: package.json 中定义 (当前 0.5.0), `index.ts` 中同步设置

| 命令 | 参数 | 选项 | 说明 |
|------|------|------|------|
| setup | - | - | 初始化 ~/.skills-manager/ |
| install | \<source\> (必填) | --all, --custom | 下载 skill 和 command |
| update | [source] (可选) | - | 更新已安装的 skill 和 command |
| list | - | --deployed | 列出可用或已部署的 skill 和 command |
| init | - | --copy | 交互式部署到当前项目 |
| add | \<name\> (必填) | --tool \<tool\>, --copy | 快速添加单个 skill 或 command |
| remove | \<name\> (必填) | --tool \<tool\> | 移除 skill 或 command |
| sync | - | - | 同步验证已部署的 skill 和 command |

## 交互式提示

使用 inquirer.js (标准提示) 和自定义 readline 实现 (高级选择器).

### Ctrl+C 处理

所有 inquirer 提示通过 `handlePromptError()` 统一处理:
- 检查 error.name 是否为 `"ExitPromptError"`
- 是 → 输出 "Cancelled." 并 `process.exit(0)`
- 否 → 原样抛出错误

自定义选择器 (interactiveCheckbox) 直接监听 `key.name === 'c' && key.ctrl`:
- 调用 cleanup (关闭 readline, 恢复 raw mode)
- 输出 "Cancelled." 并 `process.exit(0)`

### 工具选择 (promptTools)

类型: 自定义 interactiveCheckbox (与 skill/command 选择共用同一组件)
触发: `init` 命令

显示:
```
? Select target tools:
❯ ◉ Claude Code [configured]
  ◯ Codex CLI
  ◯ Gemini CLI
  ...
```

行为:
- 使用 `interactiveCheckbox` 替代 inquirer checkbox
- 按 `SUPPORTED_TOOLS` 顺序显示 (claude-code 在前, windsurf 在后)
- 已配置的工具标记 "[configured]" 并默认选中 (`checked: true`)
- 导航不循环: 在第一个选项时按上键不动, 在最后一个选项时按下键不动
- 选中结果: 返回 `string[]` (工具标识符)

### 模式选择 (promptMode)

类型: inquirer list
触发: `init` 命令, 仅对支持 mode 的工具 (Roo Code, Kilo Code)

显示:
```
? Select target mode for Roo Code:
❯ All modes (.roo/skills/)
  Code mode only (.roo/skills-code/)
  Architect mode only (.roo/skills-architect/)
```

行为:
- 第一项固定为 "All modes" (value: "all"), 显示基础 skillsDir 路径
- 后续项为各 mode, 显示名称首字母大写, 路径中 skills 替换为 skills-{mode}
- 路径显示通过字符串替换: `config.skillsDir.replace('skills', 'skills-{mode}')`

### Skill/Command 选择 (interactiveCheckbox)

类型: 自定义 readline 实现
触发: `init` 命令的 skill 和 command 选择, `install` 命令的 skill 选择

**核心参数**:
- `pageSize`: 可视区域大小, 默认 15
- `searchThreshold`: 超过此数量启用搜索, 默认 20

**分组显示**:
- choices 按 `group` 字段分组
- 组标题格式: `── {group} ──` (黄色)
- 组标题只在 group 值变化时插入

**搜索功能**:
- 当 choices 数量 > searchThreshold (20) 时自动启用
- 搜索栏: `🔍 Search: {query}│ ({filtered}/{total} skills)`
- 搜索为实时过滤, 大小写不敏感, 匹配 choice.name
- 可输入字符: `[a-zA-Z0-9\-_.]` (不含空格, 空格用于选择)
- Backspace 删除搜索字符
- 搜索时 Ctrl+A 仅切换已过滤的选项

**键盘操作**:
| 键 | 功能 |
|----|------|
| ↑ / ↓ | 移动光标, 跳过组标题 (separator) |
| Space | 切换当前项的选中状态 |
| Ctrl+A | 全选/全取消 (搜索时仅操作过滤结果) |
| Enter | 确认选择 |
| Ctrl+C | 取消并退出 |
| Backspace | 删除搜索文本最后一个字符 |
| 字母/数字 | 追加到搜索文本 (仅搜索启用时) |

**选中状态显示**:
- 选中: `◉` (绿色)
- 未选中: `◯`
- 光标所在: `❯` (青色) 前缀, 名称高亮 (青色)
- 后缀: `[deployed]` (黄色, 如果有 suffix)

**描述显示**:
- 仅在光标所在项显示 description
- 自动换行, 宽度为终端宽度 - 6 (fallback 74)
- 描述文字灰色, 缩进 4 空格

**滚动**:
- 可视区域由 pageSize 控制
- 光标超出可视区域时自动滚动
- 上方有更多内容时显示 "↑ more above" (灰色)
- 下方有更多内容时显示 "↓ more below" (灰色)

**确认后输出**:
- 0 个选中: `? {message} None selected` (灰色)
- 1-3 个选中: `? {message} name1, name2, name3` (青色)
- 超过 3 个: `? {message} N skills selected` (青色)
- 确认后清除整个选择 UI

**init 命令中 Skill 选择**:
- 已部署的 skill 默认选中 (`checked: true`) 且标记 `[deployed]`
- 按 source 分组

**init 命令中 Command 选择**:
- 同 skill, 但 name 带 `/` 前缀 (如 `/commit`)
- 仅在有支持 commands 的工具被选中时显示

**install 命令中的选择**:
- 无分组 (没有 group 字段)
- 无 `[deployed]` 标记
- 无默认选中

### 同步操作选择

**源变更时** (promptSyncAction):

类型: inquirer list

```
? code-review: source changed
❯ Overwrite
  Skip
  Show diff
```

返回: `'overwrite' | 'skip' | 'diff'`

注意: command 同步时虽然使用相同的 `promptSyncAction`, 但实际代码中 command 变更时只调用一次, 没有 diff 后的二次提示. skill 同步中选择 diff 后会再次调用 promptSyncAction.

**孤立项时** (promptOrphanAction):

类型: inquirer list

```
? skill-name: source no longer exists
❯ Remove
  Keep
```

返回: `'remove' | 'keep'`

### 冲突选择

`add` 遇到多个同名 skill/command 时:

类型: inquirer list

```
Multiple skills found with name 'code-review':
? Select skill:
❯ 1. official/anthropic/code-review
  2. community/other/code-review
```

- 选项格式: `{index}. {source}/{name}`
- 选中值为 source 字符串, 用于在匹配列表中查找

### 通用确认 (promptConfirm)

类型: inquirer confirm
- 默认值: true
- 当前代码中未被任何命令使用, 但已定义

## 视觉反馈

### 进度条 (ProgressBar)

用于 skill 信息获取 (install 命令):

```
Fetching skill info ████████░░░░░░░░░░░░░░░░░░░░░░ 27% (3/11)
```

**实现细节**:
- 固定宽度 30 字符 (`barWidth = 30`)
- 填充字符: `█` (绿色 ANSI), 空字符: `░`
- 百分比: `Math.min(100, Math.round(current/total * 100))`
- 使用 `\r\x1b[K` 覆写同一行 (回到行首, 清除到行尾)
- `start()` 重置 current 为 0 并渲染
- `tick()` 递增 current 并渲染
- `complete()` 设置 current 为 total, 渲染后输出换行

### Spinner

当前代码中已定义但未被使用.

**实现细节**:
- Braille 动画帧: `['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']`
- 间隔: 80ms (setInterval)
- 字符颜色: 黄色 ANSI
- `start()` 启动 interval
- `stop(message?)` 清除 interval, 可选输出最终消息

### 操作状态符号

| 符号 | 含义 | 使用场景 |
|------|------|---------|
| ✓ | 成功 | 添加, 更新, 链接, 安装成功 |
| ✗ | 移除/失败 | 移除 skill, 更新失败 |
| · | 未变更/跳过 | 保持不变, 已部署, 已存在 |
| ⚠ | 警告 | 冲突, 源变更, 远程不存在 |
| ↑ | 已更新 | update 命令中内容变更 |
| ◉ | 已部署 | list --deployed 中的每一项 |

### 部署输出格式

`init` 命令:
```
Deploying...

Claude Code:
  ✗ old-skill (removed)
  · existing-skill (unchanged)
  ✓ new-skill (linked)
  ✗ /old-command (removed)
  · /existing-command (unchanged)
  ✓ /new-command (linked)

Done! Deployed 3 skills and 2 commands to 2 tools.
```

`add` 命令:
```
Adding skill code-review to configured tools...
  ✓ Claude Code (linked)
  · Cursor (already deployed)
```

`remove` 命令:
```
Removing code-review...
  ✓ Removed skill from Claude Code
  ✓ Removed command from Claude Code
```

### 列表输出格式

**可用列表** (`list`):
```
Available in ~/.skills-manager/:

── official/anthropic (5 skills) ──
  code-review
  tdd

── official/anthropic (2 commands) ──
  /commit
  /review-pr
```

- skills 和 commands 分开显示
- 按 source 分组, 组标题显示数量, 复数形式 (1 skill / 2 skills)
- 无 skill 和 command 时: "No skills or commands found in ~/.skills-manager/"

**已部署列表** (`list --deployed`):
```
Deployed in current project:

Claude Code skills (.claude/skills/):
  ◉ code-review      (link) ← official/anthropic
  ⚠ my-skill         (copy) ← conflict

Claude Code commands (.claude/commands/):
  ◉ /commit          (link) ← official/anthropic
```

- skill 名称 padEnd(16) 对齐
- command 名称 padEnd(15) 对齐 (带 / 前缀)
- mode-specific 部署显示 `[mode]` 后缀
- conflict 状态用 ⚠ 前缀, source 显示 "conflict"

### Sync 输出格式

```
Checking deployed skills and commands...

Claude Code (.claude/skills/):
  ⚠ conflicted-skill: conflict (skipped)
  ✗ removed-skill: orphaned (source not found)
  ✓ linked-skill: up to date (link)
  ⚠ changed-skill: source changed (copy)
  ✓ unchanged-skill: up to date (copy)
  ✓ /linked-cmd: up to date (link)

Sync complete: 1 updated, 1 removed
```

### Update 输出格式

```
Updating official/anthropic...

  ✓ code-review: up to date
  ↑ tdd: updated
  ⚠ old-skill: not found in remote
  ✗ broken-skill: failed to update
  ✓ /commit: up to date
  ↑ /review-pr: updated

Done! 2 updated, 2 up to date, 1 failed
```

### Install 输出格式

```
Fetching available skills from anthropic/skills...
Fetching skill info ██████████████████████████████ 100% (5/5)
Found 5 skills.

Downloading 3 skills...
  code-review... ✓
  tdd... ✓
  testing... ✓

Found 2 commands, installing...
  commit.md... ✓
  review-pr.md... ✓

✓ Installed 3 skills and 2 commands to /path/to/target
```

## 错误处理

### 前置条件检查

各命令的前置条件及处理:

| 命令 | 条件 | 不满足时的行为 |
|------|------|---------------|
| install | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| update | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| update | 有已安装的 source | 输出 "No installed sources found." + 提示, 正常返回 |
| list | `~/.skills-manager/` 存在 (仅 available 模式) | process.exit(1), 提示 "Run: skillsmgr setup" |
| list | 有可用 skill/command (仅 available 模式) | 输出提示信息, 正常返回 |
| list --deployed | 有部署 | 输出 "No skills or commands deployed in current project.", 正常返回 |
| init | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| init | 有可用 skill/command | process.exit(1), 提示 "Run: skillsmgr install anthropic" |
| add | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| add | name 匹配到 skill 或 command | process.exit(1), 提示 "'name' not found as a skill or command" |
| add (无 --tool) | 有已配置工具 | process.exit(1), 提示 "Run: skillsmgr init" |
| add (有 --tool) | tool 名称有效 | process.exit(1), 提示 "Unknown tool: name" |
| remove (有 --tool) | tool 名称有效 | process.exit(1), 提示 "Unknown tool: name" |
| remove | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| remove | 有已配置工具 | process.exit(1), 提示 "No skills or commands deployed in current project." |
| sync | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| sync | 有部署 | process.exit(1), 提示 "No skills or commands deployed in current project." |

### 退出码

- `process.exit(1)`: 前置条件不满足, 安装失败, 致命错误
- `process.exit(0)`: 用户按 Ctrl+C 取消
- 正常退出 (隐式 0): 操作成功完成, 用户取消选择 (非 Ctrl+C 方式)

### 错误边界

- `install` 命令: 最外层有 try-catch, 捕获 Error 输出 message 并 exit(1)
- `update` 命令: 每个 skill/command 的更新有独立 try-catch, 失败不影响其他项
- `sync` 命令: 无顶层 try-catch, 依赖各服务层的错误处理
- 文件系统操作 (fs.ts): 大部分不捕获异常, 直接传播给调用者

## 测试用例

### 命令注册

- test_program_hasAllCommands: 注册了全部 8 个命令 (setup, install, update, list, init, add, remove, sync)
- test_program_name_isSkillsmgr: 程序名为 "skillsmgr"

### interactiveCheckbox

#### 基础功能

- test_checkbox_noChoices_returnsEmpty: 无选项时返回空数组
- test_checkbox_preChecked_defaultSelected: 有 checked: true 的选项默认选中
- test_checkbox_spaceKey_togglesSelection: 空格键切换选中状态
- test_checkbox_enterKey_confirmsSelection: Enter 键返回当前选中项
- test_checkbox_ctrlC_exitsProcess: Ctrl+C 调用 process.exit(0)

#### 导航

- test_checkbox_arrowUp_movesCursor: 上箭头移动光标到上一个 choice (跳过 separator)
- test_checkbox_arrowDown_movesCursor: 下箭头移动光标到下一个 choice
- test_checkbox_arrowUp_atTop_staysAtTop: 已在第一个 choice 时按上不动
- test_checkbox_arrowDown_atBottom_staysAtBottom: 已在最后一个 choice 时按下不动
- test_checkbox_skipsSeparators: 光标移动跳过 group separator

#### 搜索

- test_checkbox_search_enabledWhenExceedThreshold: 选项数 > 20 时启用搜索
- test_checkbox_search_disabledWhenBelowThreshold: 选项数 <= 20 时不启用搜索
- test_checkbox_search_filtersChoicesCaseInsensitive: 搜索大小写不敏感
- test_checkbox_search_resetsCursorToFirst: 搜索后光标重置到第一个匹配项
- test_checkbox_search_backspaceDeletesChar: Backspace 删除搜索文本最后一个字符
- test_checkbox_search_noResults_showsEmptyMessage: 无匹配时显示 "No matching skills found"
- test_checkbox_search_spaceIsNotSearchChar: 空格用于选择, 不追加到搜索文本
- test_checkbox_search_onlyAlphanumericAndSpecial: 只接受 [a-zA-Z0-9\-_.] 作为搜索字符

#### Ctrl+A

- test_checkbox_ctrlA_selectsAll: Ctrl+A 全选
- test_checkbox_ctrlA_deselectsAllWhenAllSelected: 全部选中时 Ctrl+A 全部取消
- test_checkbox_ctrlA_withSearch_togglesFilteredOnly: 有搜索过滤时, 只切换过滤后的选项

#### 分组

- test_checkbox_groups_showSeparators: 不同 group 之间显示分隔符
- test_checkbox_groups_sameGroupNoExtraSeparator: 同 group 的连续项不重复显示分隔符

#### 描述

- test_checkbox_description_shownOnlyForCursor: 只显示光标所在项的 description
- test_checkbox_description_wrapsAtTerminalWidth: 长描述自动换行

#### 确认输出

- test_checkbox_confirm_zeroSelected_showsNone: 0 个选中显示 "None selected"
- test_checkbox_confirm_threeOrLess_showsNames: 1-3 个选中显示逗号分隔的名称
- test_checkbox_confirm_moreThanThree_showsCount: 超过 3 个显示 "N skills selected"

### ProgressBar

- test_progressBar_start_rendersAtZero: start() 渲染 0% 进度
- test_progressBar_tick_incrementsByOne: tick() 递增 1
- test_progressBar_complete_showsHundredPercent: complete() 显示 100%
- test_progressBar_complete_appendsNewline: complete() 后输出换行
- test_progressBar_percentCapped_atHundred: current 超过 total 时百分比不超过 100

### Spinner

- test_spinner_start_setsInterval: start() 创建 interval
- test_spinner_stop_clearsInterval: stop() 清除 interval
- test_spinner_stop_withMessage_outputsMessage: stop(msg) 输出最终消息
- test_spinner_stop_noMessage_clearsLine: stop() 无参数时清除当前行

### promptTools

- test_promptTools_configuredToolsChecked: 已配置工具默认选中
- test_promptTools_configuredToolsLabeled: 已配置工具显示 "[configured]" 标记
- test_promptTools_orderMatchesSupportedTools: 工具显示顺序与 SUPPORTED_TOOLS 一致
- test_promptTools_emptySelection_showsValidationError: 不选择任何工具时显示验证错误

### promptMode

- test_promptMode_showsAllAsFirstOption: "All modes" 作为第一个选项
- test_promptMode_showsModesWithUppercase: mode 名称首字母大写
- test_promptMode_showsCorrectPaths: 每个选项显示对应的目录路径

### 前置条件

- test_precondition_noSkillsManagerDir_exits: ~/.skills-manager/ 不存在时 exit(1)
- test_precondition_noAvailableSkills_exits: 无可用 skill 和 command 时 exit(1) (init 命令)
- test_precondition_noConfiguredTools_exits: 无已配置工具时 exit(1) (add 命令)
- test_precondition_unknownTool_exits: --tool 指定不存在的工具时 exit(1)
- test_precondition_skillNotFound_exits: add 命令找不到 skill/command 时 exit(1)
