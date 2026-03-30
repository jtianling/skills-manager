# CLI Interaction

skillsmgr 的命令行交互体验: 命令结构, 交互式提示, 视觉反馈, 错误处理.

## 命令结构

程序名: `skillsmgr`
框架: Commander.js
版本: package.json 中定义 (当前 0.8.0), `index.ts` 中同步设置

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| setup | - | - | - | 初始化 ~/.skills-manager/ |
| install | i | \<source\> (必填) | --all, --custom, -f/--force, -g/--group, -s/--skill, -a/--agent | Install skills from a repository |
| custom-install | ci | \<name\> (必填) | -f, --force | Install a local skill to custom directory |
| update | - | [source] (可选) | - | Update installed skills to latest version |
| list | - | - | --deployed | List available or deployed skills |
| init | - | - | --copy | Deploy skills to current project |
| add | - | [arg] (可选) | --copy, -a/--agent, --same-agents, -s/--skill, -g/--group | Add a skill to the project |
| remove | - | [name] (可选) | -s/--skill, -a/--agent | Remove a skill from the project |
| uninstall | - | [identifier] (可选) | -f, --force, --all, -s/--skill | Remove skills from ~/.skills-manager/ |

#### Scenario: CLI help shows skills-only descriptions
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** 所有命令描述只提及 skills, 不提及 commands

#### Scenario: CLI help shows all commands including custom-install
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** 输出包含 `custom-install` 命令及其别名 `ci`

#### Scenario: CLI help shows install alias
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** `install` 命令显示别名 `i`

### Requirement: Command alias for custom-install
The `custom-install` command SHALL have alias `ci`.

#### Scenario: Alias ci works
- **WHEN** user runs `skillsmgr ci abc`
- **THEN** the system behaves identically to `skillsmgr custom-install abc`

### Requirement: Command alias for install
The `install` command SHALL have alias `i`.

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| install | i | \<source\> (必填) | --all, --custom, -f/--force, -g/--group, -s/--skill, -a/--agent | Install skills from a repository |
| uninstall | - | [identifier] (可选) | -f, --force, --all, -s/--skill | Remove skills from ~/.skills-manager/ |
| add | - | [arg] (可选) | --copy, -a/--agent, --same-agents, -s/--skill, -g/--group | Add a skill to the project |
| remove | - | [name] (可选) | -s/--skill, -a/--agent | Remove a skill from the project |

#### Scenario: Alias i works
- **WHEN** user runs `skillsmgr i anthropic`
- **THEN** the system behaves identically to `skillsmgr install anthropic`

#### Scenario: CLI help shows install options including --skill and --agent
- **WHEN** 用户执行 `skillsmgr install --help`
- **THEN** 输出包含 `-s, --skill <name>` 和 `-a, --agent <name>` 选项

#### Scenario: CLI help shows add options with -s as --skill
- **WHEN** 用户执行 `skillsmgr add --help`
- **THEN** `-s` 对应 `--skill`, 不再对应 `--same-agents`
- **AND** `--same-agents` 无短参数

#### Scenario: CLI help shows remove with optional name
- **WHEN** 用户执行 `skillsmgr remove --help`
- **THEN** name 参数显示为 `[name]` (可选), 而非 `<name>` (必填)
- **AND** 输出包含 `-s, --skill <name>` 和 `-a, --agent <name>` 选项

#### Scenario: CLI help shows uninstall with --skill
- **WHEN** 用户执行 `skillsmgr uninstall --help`
- **THEN** 输出包含 `-s, --skill <name>` 选项
- **AND** 不包含 `-a, --agent` 选项

#### Scenario: uninstall 命令支持 --all 参数
- **WHEN** 用户执行 `skillsmgr uninstall --help`
- **THEN** 输出中包含 `--all` 选项, 描述为跳过交互直接删除所有 skills

#### Scenario: add 命令参数可选
- **WHEN** 用户执行 `skillsmgr add` (无参数)
- **THEN** 命令正常执行, 进入 init 流程

#### Scenario: add 命令接受 --agent 选项
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** `-a` 接受单个 agent 名称 (不再是逗号分隔)

#### Scenario: add 命令接受 --same-agents 选项
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **THEN** 使用项目已配置的 agents

### Requirement: uninstall 命令参数可选

原命令表中 `uninstall` 的 `<identifier>` 参数为可选.  无参数时进入交互式卸载模式 (全部 skills), `owner/repo` 参数进入 scoped 交互模式, 裸词参数按 skill name 查找.

#### Scenario: 无参数进入交互模式
- **WHEN** 用户执行 `skillsmgr uninstall`
- **THEN** 进入交互式卸载模式, 展示所有已安装 skills

#### Scenario: owner/repo 参数进入 scoped 交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** 进入 scoped 交互模式, 展示该 source 下的 skills

#### Scenario: 裸词参数按 skill name 查找
- **WHEN** 用户执行 `skillsmgr uninstall commit`
- **THEN** 按 skill name 查找并卸载

#### Scenario: --force 仅对有参数模式生效
- **WHEN** 用户执行 `skillsmgr uninstall` (无参数)
- **THEN** `--force` 选项不影响交互流程 (无参数就是要交互)

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

类型: 自定义 interactiveCheckbox (与 skill 选择共用同一组件)
触发: `init` 命令, `add` 命令

提示消息: "Select target agents:" (使用 "agents" 术语替代 "tools")

显示:
```
? Select target agents:
❯ ◉ Claude Code [configured]
  ◯ Codex CLI
  ◯ Gemini CLI
  ...
```

行为:
- 使用 `interactiveCheckbox` 替代 inquirer checkbox
- 按 `SUPPORTED_TOOLS` 顺序显示 (claude-code 在前, windsurf 在后)
- 已配置的 agent 标记 "[configured]" 并默认选中 (`checked: true`)
- 导航不循环: 在第一个选项时按上键不动, 在最后一个选项时按下键不动
- 选中结果: 返回 `string[]` (工具标识符)

#### Scenario: 提示消息使用 agents 术语
- **WHEN** 用户进入 agent 选择
- **THEN** 提示消息为 "Select target agents:"

### Skill 选择 (interactiveCheckbox)

类型: 自定义 readline 实现
触发: `init` 命令的 skill 选择, `install` 命令的 skill 选择

**install 命令预选**: 当用户再次 install 同一仓库时, 已安装的 skill 在列表中自动 checked 并显示 `(installed)` 后缀.  详见 skill-lifecycle spec "安装时预选已安装 skill" 章节.

**核心参数**:
- `pageSize`: 可视区域大小, 默认 15
- `searchThreshold`: 超过此数量启用搜索, 默认 20

**分组显示**:
- choices 按 `group` 字段分组
- 组标题格式: `── {group} ──` (黄色)
- 组标题只在 group 值变化时插入
- choices 可选携带 `subGroup` 字段, 同一 subGroup 的 choices 在分组标题下额外聚合
- `subGroup` 值变化时插入 group-header 行, 格式: `{subGroup} ({childCount})`
- group-header 可聚焦、可选择, 但不出现在返回值中
- 无 `subGroup` 字段时行为与变更前一致

**搜索功能**:
- 当 choices 数量 > searchThreshold (20) 时, 搜索功能可用
- 搜索栏: `🔍 Search: {query}│ ({filtered}/{total} skills)`
- 搜索为实时过滤, 大小写不敏感, 匹配 choice.name
- 可输入字符: `[a-zA-Z0-9\-_.]` (不含空格, 空格用于选择)
- Backspace 删除搜索字符
- 搜索时 Ctrl+A 仅切换已过滤的选项
- **搜索模式**: 按 "/" 键进入搜索模式, 按 Escape, Enter 或再次按 "/" 退出搜索模式
- **非搜索模式下**: 字母输入不触发搜索, 仅在搜索模式下输入字符才过滤列表
- **搜索模式退出 (Enter)**: Enter 退出搜索模式, 保留搜索文本和过滤结果
- **搜索模式退出 (Esc)**: Escape 退出搜索模式, 保留搜索文本但清除过滤, 恢复完整列表
- **搜索模式退出 (Backspace)**: Backspace 在搜索文本为空时退出搜索模式并清除过滤
- **enableSearch 为 false 时**: "/" 键无效果
- **搜索过滤与 group-header**: 无匹配子项的 group-header 隐藏, 有匹配子项的 group-header 正常显示

**搜索栏视觉状态**:
- 搜索模式激活: 搜索栏正常亮度显示
- 非搜索模式 (有搜索文本): 搜索栏变灰 (dim) 显示
- 无搜索文本且非搜索模式: 搜索栏变灰

**行号显示**:
- 每个 choice 项前显示行号, 从 1 开始连续编号
- separator 和 group-header 不分配行号, 对应位置空格填充
- 行号右对齐, 宽度 = 总 choice 数的位数
- 搜索过滤后行号重新从 1 编号
- 格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

**键盘操作**:
| 键 | 非搜索模式 | 搜索模式 |
|----|-----------|---------|
| ↑ / ↓ | 移动光标, 跳过 separator (不跳过 group-header) | 移动光标, 跳过 separator (不跳过 group-header) |
| j / k | 向下/向上移动光标 (与 ↓/↑ 行为一致) | 作为搜索字符输入 |
| G (Shift+G) | 跳转到末尾 (无数字缓冲) 或跳转到指定行 (有数字缓冲) | 作为搜索字符输入 |
| gg | 跳转到列表开头 | 作为搜索字符输入 |
| 数字 0-9 | 追加到数字缓冲 (用于数字+G 跳转) | 作为搜索字符输入 |
| q | 退出程序 (与 Ctrl+C 一致) | 作为搜索字符输入 |
| / | 进入搜索模式 (仅 enableSearch 时) | 退出搜索模式 |
| Space | 切换当前项的选中状态; 若光标在 group-header 上, 批量切换所有子项 | 切换当前项的选中状态; 若光标在 group-header 上, 批量切换所有子项 |
| Ctrl+A | 全选/全取消 | 全选/全取消 (仅操作过滤结果) |
| Enter | 确认选择 | 退出搜索模式 (保留过滤) |
| Ctrl+C | 取消并退出 | 取消并退出 |
| Escape | 无效果 | 退出搜索模式 (清除过滤, 保留文本) |
| Backspace | 无效果 | 删除搜索字符; 空时退出并清除过滤 |
| 字母/数字 (其他) | 忽略 (不触发搜索) | 追加到搜索文本 |

**底部指引文本**:
- enableSearch 且非搜索模式: `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`
- enableSearch 且搜索模式: `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`
- 非 enableSearch: `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

**选中状态显示**:
- 选中: `◉` (绿色)
- 未选中: `◯`
- 部分选中 (仅 group-header): `◐` (黄色)
- 光标所在: `❯` (青色) 前缀, 名称高亮 (青色)
- 后缀: `[deployed]` (黄色, 如果有 suffix)

**描述显示**:
- 仅在光标所在项显示 description (group-header 无 description)
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
- 按 source 分组, 并按 subGroup 显示 group-header

**install 命令中的选择**:
- 无分组 (没有 group 字段)
- 无 `[deployed]` 标记
- 无默认选中

#### Scenario: group-header 在 separator 下显示
- **WHEN** choices 包含 subGroup 字段, 且同一 group 下有多个不同 subGroup
- **THEN** 每个 subGroup 的第一个 choice 前插入 group-header 行, group-header 显示在 separator 之后

#### Scenario: Space 键在 group-header 上批量切换
- **WHEN** 光标在 group-header 上, 用户按 Space
- **THEN** 该 group-header 下所有子项的选中状态批量切换 (partial/none → all, all → none)

#### Scenario: 光标可停在 group-header 上
- **WHEN** 用户按 ↑ 或 ↓ 键, 且下一项为 group-header
- **THEN** 光标停在 group-header 上 (不跳过)

#### Scenario: 无 subGroup 时无 group-header
- **WHEN** 所有 choices 均无 subGroup 字段
- **THEN** 不显示任何 group-header, 行为与变更前一致

#### Scenario: j 键向下移动光标
- **WHEN** 用户在非搜索模式下按 j 键
- **THEN** 光标向下移动到下一个 choice (跳过 separator), 与按 ↓ 键行为一致

#### Scenario: k 键向上移动光标
- **WHEN** 用户在非搜索模式下按 k 键
- **THEN** 光标向上移动到上一个 choice (跳过 separator), 与按 ↑ 键行为一致

#### Scenario: j 键在底部不动
- **WHEN** 光标在最后一个 choice 时按 j 键
- **THEN** 光标不移动

#### Scenario: k 键在顶部不动
- **WHEN** 光标在第一个 choice 时按 k 键
- **THEN** 光标不移动

#### Scenario: "/" 键进入搜索模式
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按 "/" 键
- **THEN** 进入搜索模式, 搜索栏变为正常亮度, 后续字母输入追加到搜索文本

#### Scenario: "/" 键在搜索不启用时无效果
- **WHEN** enableSearch 为 false 且用户按 "/" 键
- **THEN** 无任何效果

#### Scenario: Escape 退出搜索模式并清除过滤
- **WHEN** 用户在搜索模式下按 Escape 键
- **THEN** 退出搜索模式, 搜索文本保留 (再次按 "/" 可见), 但过滤清除, 恢复显示完整列表, 搜索栏变灰

#### Scenario: Enter 退出搜索模式并保留过滤
- **WHEN** 用户在搜索模式下按 Enter 键
- **THEN** 退出搜索模式, 搜索文本和过滤结果均保留, 用户继续在过滤后的列表中选择

#### Scenario: "/" 退出搜索模式
- **WHEN** 用户在搜索模式下按 "/" 键
- **THEN** 退出搜索模式, 搜索文本和过滤结果保留

#### Scenario: 搜索模式下 j/k 作为搜索字符
- **WHEN** 用户在搜索模式下按 j 或 k 键
- **THEN** 字符追加到搜索文本, 不触发导航

#### Scenario: 搜索模式下方向键仍可导航
- **WHEN** 用户在搜索模式下按 ↑ 或 ↓ 键
- **THEN** 光标正常移动, 与非搜索模式下方向键行为一致

#### Scenario: 非搜索模式下字母键不触发搜索
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按未识别的字母键
- **THEN** 无任何效果, 不进入搜索模式也不追加到搜索文本

#### Scenario: Backspace 空搜索文本退出搜索模式
- **WHEN** 用户在搜索模式下且搜索文本为空时按 Backspace
- **THEN** 退出搜索模式, 清除过滤, 恢复完整列表

#### Scenario: Esc 退出后再次进入搜索保留文本
- **WHEN** 用户在搜索模式下按 Esc 退出, 然后再按 "/" 进入搜索模式
- **THEN** 搜索栏显示之前的搜索文本, 用户可在此基础上修改

#### Scenario: Enter 退出后非搜索模式下 Enter 确认选择
- **WHEN** 用户在搜索模式下按 Enter 退出搜索, 然后在非搜索模式下再按 Enter
- **THEN** 确认当前选择并退出选择器, 返回选中项

#### Scenario: 底部指引显示正确按键 (非搜索模式, enableSearch)
- **WHEN** enableSearch 为 true 且非搜索模式
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 搜索模式底部指引
- **WHEN** 用户处于搜索模式
- **THEN** 底部显示 `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, 非 enableSearch)
- **WHEN** enableSearch 为 false
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: G 跳到末尾
- **WHEN** 用户在非搜索模式下按 G (Shift+G), 且之前未输入数字
- **THEN** 光标跳转到最后一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 搜索模式下 G 作为搜索字符
- **WHEN** 用户在搜索模式下按 G
- **THEN** 字符 "G" 追加到搜索文本, 不触发跳转

#### Scenario: gg 跳到开头
- **WHEN** 用户在非搜索模式下连续按两次 g
- **THEN** 光标跳转到第一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 单次 g 无效果
- **WHEN** 用户在非搜索模式下按一次 g, 然后按其他非 g 键
- **THEN** 无跳转效果, g 的等待状态被重置

#### Scenario: 搜索模式下 g 作为搜索字符
- **WHEN** 用户在搜索模式下按 g
- **THEN** 字符 "g" 追加到搜索文本, 不触发 gg 逻辑

#### Scenario: 数字+G 跳到指定行
- **WHEN** 用户在非搜索模式下依次按 5 和 G
- **THEN** 光标跳转到行号为 5 的 choice 项, 视口自动滚动以显示该项

#### Scenario: 多位数字+G 跳转
- **WHEN** 用户在非搜索模式下依次按 1, 2 和 G
- **THEN** 光标跳转到行号为 12 的 choice 项

#### Scenario: 数字超出范围时跳到末尾
- **WHEN** 用户输入的数字大于总 choice 数 (如列表有 10 项, 输入 99G)
- **THEN** 光标跳转到最后一个 choice 项

#### Scenario: 数字 0 跳到开头
- **WHEN** 用户输入 0G
- **THEN** 光标跳转到第一个 choice 项

#### Scenario: 按数字后按非 G 键清空缓冲
- **WHEN** 用户按数字 5 后按 j 键
- **THEN** 数字缓冲被清空, j 键正常执行向下移动

#### Scenario: 搜索模式下数字作为搜索字符
- **WHEN** 用户在搜索模式下按数字键
- **THEN** 数字追加到搜索文本, 不进入数字缓冲

#### Scenario: q 键退出
- **WHEN** 用户在非搜索模式下按 q 键
- **THEN** 执行 cleanup, 输出 "Cancelled.", 以退出码 0 退出程序

#### Scenario: 搜索模式下 q 作为搜索字符
- **WHEN** 用户在搜索模式下按 q 键
- **THEN** 字符 "q" 追加到搜索文本, 不退出程序

#### Scenario: 未识别按键无效果
- **WHEN** 用户在非搜索模式下按未识别的键 (如 x, z, 等)
- **THEN** 无任何效果, 列表状态不变, 不触发渲染

### Requirement: 搜索过滤状态解耦
searchQuery 文本与过滤激活状态 SHALL 解耦为独立状态.  `isFiltered` 控制是否对列表应用过滤, `searchQuery` 仅存储文本.

#### Scenario: 输入搜索字符自动激活过滤
- **WHEN** 用户在搜索模式下输入字符
- **THEN** isFiltered 设为 true, 列表按 searchQuery 过滤

#### Scenario: Esc 退出搜索清除过滤但保留文本
- **WHEN** 用户在搜索模式下按 Esc
- **THEN** isFiltered 设为 false, 列表恢复完整显示, searchQuery 文本不变

#### Scenario: Enter 退出搜索保留过滤
- **WHEN** 用户在搜索模式下按 Enter
- **THEN** isFiltered 保持 true, 列表仍按 searchQuery 过滤

### Requirement: 搜索模式按键表
interactiveCheckbox 组件的按键行为 SHALL 遵循以下映射:

| 键 | 非搜索模式 | 搜索模式 |
|------|------------|----------|
| j / k | 向下/向上移动光标 | 作为搜索字符输入 |
| G (Shift+G) | 跳转到末尾或指定行 | 作为搜索字符输入 |
| gg | 跳转到列表开头 | 作为搜索字符输入 |
| 数字 0-9 | 追加到数字缓冲 | 作为搜索字符输入 |
| q | 退出程序 | 作为搜索字符输入 |
| / | 进入搜索模式 | 退出搜索模式 (保留过滤) |
| Space | 切换选中状态 | 切换选中状态 |
| Ctrl+A | 全选/全取消 | 全选/全取消 (仅操作过滤结果) |
| Enter | 确认选择 | 退出搜索模式 (保留过滤) |
| Ctrl+C | 取消并退出 | 取消并退出 |
| Escape | 无效果 | 退出搜索模式 (清除过滤, 保留文本) |
| Backspace | 无效果 | 删除搜索字符; 空时退出并清除过滤 |

#### Scenario: 搜索模式下 Enter 不直接确认选择
- **WHEN** 用户在搜索模式下按 Enter
- **THEN** 退出搜索模式, 不触发选择确认, 过滤结果保留

#### Scenario: 非搜索模式下 Enter 确认选择
- **WHEN** 用户在非搜索模式下按 Enter
- **THEN** 确认选择并退出选择器

### Requirement: 底部指引文本
底部指引 SHALL 根据当前模式和搜索状态显示对应的按键提示.

- enableSearch 且非搜索模式: `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`
- enableSearch 且搜索模式: `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`
- 非 enableSearch: `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, enableSearch)
- **WHEN** enableSearch 为 true 且非搜索模式
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 搜索模式底部指引
- **WHEN** 用户处于搜索模式
- **THEN** 底部显示 `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, 非 enableSearch)
- **WHEN** enableSearch 为 false
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

### Requirement: 列表行号显示
interactiveCheckbox 组件 SHALL 在每个 choice 项前显示行号.  行号从 1 开始, 基于当前可见的 choice 列表顺序编号.  separator (组标题) 和 group-header 不分配行号, 对应位置显示空格填充.  行号右对齐, 宽度等于总 choice 数的位数.

显示格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

#### Scenario: 基本行号显示
- **WHEN** interactiveCheckbox 显示 5 个 choice 项 (无 separator)
- **THEN** 每行前显示行号 1 到 5, 右对齐, 宽度 1 位

#### Scenario: 两位数行号右对齐
- **WHEN** interactiveCheckbox 显示 12 个 choice 项
- **THEN** 行号 1-9 前补空格, 显示为 ` 1` 到 ` 9`, 行号 10-12 显示为 `10` 到 `12`

#### Scenario: separator 不分配行号
- **WHEN** 列表包含 separator (组标题) 和 choice 项
- **THEN** separator 行的行号位置显示空格填充, choice 项行号连续不跳号

#### Scenario: 搜索过滤后行号重编
- **WHEN** 用户搜索过滤后显示 3 个结果
- **THEN** 行号重新从 1 到 3 编号, 不保留原始行号

### Requirement: G 键跳转到列表末尾
非搜索模式下, 按 G (Shift+G) 且无数字缓冲时, 光标 SHALL 跳转到列表最后一个 choice 项.

#### Scenario: G 跳到末尾
- **WHEN** 用户在非搜索模式下按 G (Shift+G), 且之前未输入数字
- **THEN** 光标跳转到最后一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 搜索模式下 G 作为搜索字符
- **WHEN** 用户在搜索模式下按 G
- **THEN** 字符 "G" 追加到搜索文本, 不触发跳转

### Requirement: gg 跳转到列表开头
非搜索模式下, 连续按两次 g (小写) SHALL 使光标跳转到列表第一个 choice 项.

#### Scenario: gg 跳到开头
- **WHEN** 用户在非搜索模式下连续按两次 g
- **THEN** 光标跳转到第一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 单次 g 无效果
- **WHEN** 用户在非搜索模式下按一次 g, 然后按其他非 g 键
- **THEN** 无跳转效果, g 的等待状态被重置

#### Scenario: 搜索模式下 g 作为搜索字符
- **WHEN** 用户在搜索模式下按 g
- **THEN** 字符 "g" 追加到搜索文本, 不触发 gg 逻辑

### Requirement: 数字+G 跳转到指定行
非搜索模式下, 用户输入数字后按 G (Shift+G) SHALL 使光标跳转到对应行号的 choice 项.

#### Scenario: 数字+G 跳到指定行
- **WHEN** 用户在非搜索模式下依次按 5 和 G
- **THEN** 光标跳转到行号为 5 的 choice 项, 视口自动滚动以显示该项

#### Scenario: 多位数字+G 跳转
- **WHEN** 用户在非搜索模式下依次按 1, 2 和 G
- **THEN** 光标跳转到行号为 12 的 choice 项

#### Scenario: 数字超出范围时跳到末尾
- **WHEN** 用户输入的数字大于总 choice 数 (如列表有 10 项, 输入 99G)
- **THEN** 光标跳转到最后一个 choice 项

#### Scenario: 数字 0 跳到开头
- **WHEN** 用户输入 0G
- **THEN** 光标跳转到第一个 choice 项

#### Scenario: 按数字后按非 G 键清空缓冲
- **WHEN** 用户按数字 5 后按 j 键
- **THEN** 数字缓冲被清空, j 键正常执行向下移动

#### Scenario: 搜索模式下数字作为搜索字符
- **WHEN** 用户在搜索模式下按数字键
- **THEN** 数字追加到搜索文本, 不进入数字缓冲

### Requirement: q 键退出程序
非搜索模式下, 按 q 键 SHALL 退出程序, 行为与 Ctrl+C 一致.

#### Scenario: q 键退出
- **WHEN** 用户在非搜索模式下按 q 键
- **THEN** 执行 cleanup, 输出 "Cancelled.", 以退出码 0 退出程序

#### Scenario: 搜索模式下 q 作为搜索字符
- **WHEN** 用户在搜索模式下按 q 键
- **THEN** 字符 "q" 追加到搜索文本, 不退出程序

### Requirement: 未识别按键忽略
非搜索模式下, 未被 interactiveCheckbox 识别的按键 SHALL 被静默忽略, 不产生任何效果或副作用.  readline interface SHALL NOT 将任何字符回显到终端输出.

#### Scenario: 未识别按键无效果
- **WHEN** 用户在非搜索模式下按未识别的键 (如 x, z, 等)
- **THEN** 无任何效果, 列表状态不变, 不触发渲染, 终端无字符输出

#### Scenario: readline 不回显字符
- **WHEN** interactiveCheckbox 创建 readline interface
- **THEN** readline 的 output SHALL 为一个不产生任何输出的 stream, 而非 process.stdout

### 冲突选择

`add` 遇到多个同名 skill 时:

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

Skills (.agents/skills/):
  ✗ old-skill (removed)
  · existing-skill (unchanged)
  ✓ new-skill (linked)
  ~ unmanaged-skill (unmanaged)

Claude Code: symlink .claude/skills → .agents/skills

Done! Deployed 3 skills.
```

#### Scenario: init completion message
- **WHEN** init 部署完成
- **THEN** 输出 "Done! Deployed N skills."

`add` 命令:
```
  ✓ code-review (linked)
```
或已部署时:
```
  · code-review (already deployed)
```

`remove` 命令:
```
  ✓ Removed code-review
```

### 列表输出格式

**可用列表** (`list`):
```
Available in ~/.skills-manager/:

── official/anthropic (5 skills) ──
  code-review
  tdd
```

- 按 source 分组, 组标题显示数量, 复数形式 (1 skill / 2 skills)
- 无 skill 时: "No skills found in ~/.skills-manager/"

#### Scenario: list available shows only skills
- **WHEN** 执行 `list`
- **THEN** 只显示 skill 分组, 不显示 command 分组

#### Scenario: list empty state
- **WHEN** 没有可用 skill
- **THEN** 输出 "No skills found in ~/.skills-manager/"

**已部署列表** (`list --deployed`):
```
Deployed in current project (.agents/skills/):

  ◉ code-review      (link) ← official/anthropic
  ⚠ my-skill         (copy) ← conflict

Configured agents:
  Agents Skills Standard → Codex, Gemini CLI, OpenCode
  Claude Code (symlink: .claude/skills → .agents/skills)
```

- skill 名称 padEnd(16) 对齐
- conflict 状态用 ⚠ 前缀, source 显示 "conflict"
- Configured agents 分两组: native 工具聚合显示, non-native 工具单独显示 symlink 信息

#### Scenario: list deployed shows skills and configured agents
- **WHEN** 执行 `list --deployed`
- **THEN** 先显示 `.agents/skills/` 中的 skill 列表, 再显示 configured agents 信息

#### Scenario: list deployed empty state
- **WHEN** 没有已部署 skill
- **THEN** 输出 "No skills deployed in current project."

### Update 输出格式

```
Updating official/anthropic...

  ✓ code-review: up to date
  ↑ tdd: updated
  ⚠ old-skill: not found in remote
  ✗ broken-skill: failed to update

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

✓ Installed 3 skills to /path/to/target
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
| list | 有可用 skill (仅 available 模式) | 输出提示信息, 正常返回 |
| list --deployed | 有部署 | 输出 "No skills deployed in current project.", 正常返回 |
| init | `~/.skills-manager/` 存在 | 自动执行 `executeSetup()`, 然后继续 init 流程 |
| init | 有可用 skill | process.exit(1), 提示 "No skills found. Run: skillsmgr install anthropic" |
| add | `~/.skills-manager/` 存在 | 自动执行 `executeSetup()`, 然后继续 add 流程 |
| add (无参数) | 同 init 的前置条件 | 同 init |
| add (skill name) | name 未找到 | exit(1), 提示 "Skill 'xxx' not found in central repository.\nUse 'skillsmgr add owner/repo' or a full URL to install from remote." |
| add (-a 指定无效 agent) | agent 名称不合法 | exit(1), 提示 "Unknown agent: 'xxx'. Available agents: ..." |
| add (--same-agents 无已配置 agent) | 无已配置 agent | exit(1), 提示 "No agents configured. Run 'skillsmgr init' or omit --same-agents flag." |
| add (-a 和 --same-agents 同时使用) | 互斥 | exit(1), 提示 "Cannot use --agent and --same-agents together." |
| remove | `~/.skills-manager/` 存在 | process.exit(1), 提示 "Run: skillsmgr setup" |
| remove | 有已配置工具 | process.exit(1), 提示 "No skills deployed in current project." |

#### Scenario: no content found error
- **WHEN** 安装的仓库中没有 skill
- **THEN** 错误消息为 "No skills found in repository", 不提及 commands

#### Scenario: no deployment found error
- **WHEN** 项目中没有已部署 skill
- **THEN** 消息为 "No skills deployed in current project."

#### Scenario: not found error
- **WHEN** add/remove 时找不到 name
- **THEN** 消息为 "'name' not found" 或类似, 不提及 "skill or command"

#### Scenario: no available skills message
- **WHEN** init 时没有可用 skill
- **THEN** 输出 "No skills found. Run: skillsmgr install anthropic"

#### Scenario: skill name 未找到提示改进
- **WHEN** `skillsmgr add xxx` 未找到 skill
- **THEN** 输出 "Skill 'xxx' not found in central repository.\nUse 'skillsmgr add owner/repo' or a full URL to install from remote."

#### Scenario: 无效 agent 名称报错
- **WHEN** `skillsmgr add code-review -a invalid`
- **THEN** 输出 "Unknown agent: 'invalid'. Available agents: claude-code, codex, ..."
- **AND** exit(1)

### 退出码

- `process.exit(1)`: 前置条件不满足, 安装失败, 致命错误
- `process.exit(0)`: 用户按 Ctrl+C 取消
- 正常退出 (隐式 0): 操作成功完成, 用户取消选择 (非 Ctrl+C 方式)

### 错误边界

- `install` 命令: 最外层有 try-catch, 捕获 Error 输出 message 并 exit(1)
- `update` 命令: 每个 skill 的更新有独立 try-catch, 失败不影响其他项
- 文件系统操作 (fs.ts): 大部分不捕获异常, 直接传播给调用者

## 测试用例

### 命令注册

- test_program_hasAllCommands: 注册了全部 7 个命令 (setup, install, update, list, init, add, remove)
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
- test_checkbox_jKey_movesDown: 非搜索模式下 j 键向下移动光标 (与 ↓ 行为一致)
- test_checkbox_kKey_movesUp: 非搜索模式下 k 键向上移动光标 (与 ↑ 行为一致)
- test_checkbox_jKey_atBottom_staysAtBottom: 光标在最后一个 choice 时按 j 不动
- test_checkbox_kKey_atTop_staysAtTop: 光标在第一个 choice 时按 k 不动

#### 搜索模式

- test_checkbox_slash_entersSearchMode: enableSearch 为 true 时 "/" 进入搜索模式
- test_checkbox_slash_noEffectWhenSearchDisabled: enableSearch 为 false 时 "/" 无效果
- test_checkbox_slash_exitsSearchMode: 搜索模式下 "/" 退出搜索模式
- test_checkbox_escape_exitsSearchMode_clearsFilter: 搜索模式下 Escape 退出搜索模式, 保留搜索文本但清除过滤
- test_checkbox_enter_exitsSearchMode_keepsFilter: 搜索模式下 Enter 退出搜索模式, 保留搜索文本和过滤
- test_checkbox_enter_inSearchMode_doesNotConfirm: 搜索模式下 Enter 不触发选择确认
- test_checkbox_enter_afterSearchExit_confirmsSelection: 退出搜索模式后 Enter 确认选择
- test_checkbox_esc_thenSlash_showsPreviousQuery: Esc 退出后再 "/" 进入, 显示之前的搜索文本
- test_checkbox_backspace_emptySearch_clearsFilter: 空搜索文本 Backspace 退出并清除过滤
- test_checkbox_searchInput_activatesFilter: 搜索输入自动激活 isFiltered
- test_checkbox_searchMode_jkAsSearchChars: 搜索模式下 j/k 作为搜索字符输入
- test_checkbox_nonSearchMode_lettersIgnored: 非搜索模式下字母键不触发搜索
- test_checkbox_searchMode_arrowKeysNavigate: 搜索模式下方向键仍可导航

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

### 前置条件

- test_precondition_noSkillsManagerDir_exits: ~/.skills-manager/ 不存在时 exit(1) (install, update, list, remove 命令)
- test_precondition_noSkillsManagerDir_autoSetup: ~/.skills-manager/ 不存在时自动执行 setup 后继续 (init, add 命令)
- test_precondition_noAvailableSkills_exits: 无可用 skill 时 exit(1) (init 命令)
- test_precondition_noConfiguredTools_exits: 无已配置工具时 exit(1) (add 命令)
- test_precondition_skillNotFound_exits: add 命令找不到 skill 时 exit(1)
