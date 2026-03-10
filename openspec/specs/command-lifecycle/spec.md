# Command Lifecycle

Commands (slash commands) 是独立的 markdown 文件, 部署后可在 AI 编程工具中通过 `/command-name` 调用.  与 skill (目录) 不同, command 是单个 `.md` 文件.

## 数据模型

### CommandInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | command 名称, 不含 .md 后缀 |
| description | string | 描述, 从 frontmatter 获取 |
| path | string | .md 文件的完整路径 |
| source | string | 来源标识 |

### ScannedCommand

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | command 名称 |
| source | string | 来源标识 |
| deployMode | "link" \| "copy" | 部署方式 |
| path | string | 部署位置的完整路径 |

注意: ScannedCommand 没有 `conflict` 字段, 与 ScannedSkill 不同.  Command 不做冲突检测.

## 与 Skill 的关键差异

| 维度 | Skill | Command |
|------|-------|---------|
| 物理形式 | 目录 (含 SKILL.md) | 单个 .md 文件 |
| 存储位置 | `{source}/{repo}/{name}/` | `{source}/{repo}/commands/{name}.md` |
| 识别依据 | 目录中有 SKILL.md | .md 文件扩展名 |
| 工具支持 | 所有 11 个工具 | 8 个工具 (Cline, Codex CLI, Trae 不支持) |
| 部署目标 | `toolConfig.skillsDir` | `toolConfig.commandsDir` |
| CLI 显示 | `skill-name` | `/command-name` (带斜杠前缀) |
| 安装方式 | 用户选择安装 | 自动安装, 无需用户选择 |
| 冲突检测 | 有 (conflict 字段) | 无 |
| Sync diff | 支持 Show diff 选项 | 不支持 Show diff, 仅 Overwrite/Skip |
| 部署操作 | linkDir / copyDir | linkFile / copyFile |

## Command 存储结构

```
~/.skills-manager/
├── official/
│   └── anthropic/
│       ├── code-review/        # ← skill (目录)
│       └── commands/           # ← commands 目录
│           ├── commit.md
│           └── review-pr.md
├── community/
│   └── some-repo/
│       └── commands/
│           └── deploy.md
└── custom/
    └── commands/               # custom 的 commands 直接在 custom/commands/ 下
        └── my-command.md
```

### 目录层级

- **custom**: 直接在 `custom/commands/` 下查找 .md 文件. 注意不是在每个 skill 的子目录中, 而是 custom 根目录下的 commands/ 目录
- **official/community**: 在每个 `{source}/{repo}/commands/` 下查找 .md 文件

### 边界情况

- commands 目录不存在时返回空数组, 不报错
- 只读取 `.md` 扩展名的文件, 其他文件被忽略
- 文件名去掉 `.md` 后缀作为 command name
- `getFilesInDir()` 返回结果按文件名字母序排列

## Command .md 格式

```markdown
---
name: command-name
description: What this command does
---

Command prompt content here...
```

### Frontmatter 解析规则

与 SKILL.md 的解析逻辑完全一致:
- 使用相同的正则表达式 `/^---\n([\s\S]*?)\n---/`
- 提取 name 和 description 字段
- `name` 字段可选, 缺失时使用文件名去掉 `.md` 后缀作为 name
- `description` 字段可选, 缺失时为空字符串

## 生命周期操作

### 1. 发现与加载

`CommandsService` 扫描方式:

**扫描逻辑**:

对于 custom 来源:
1. 检查 `~/.skills-manager/custom/commands/` 目录是否存在
2. 如果存在, 读取其中所有 `.md` 文件
3. source 字段设为 `"custom"`

对于 official/community 来源:
1. 遍历 `~/.skills-manager/{source}/` 下的仓库目录
2. 对每个仓库, 检查 `{repo}/commands/` 目录
3. 读取其中所有 `.md` 文件
4. source 字段设为 `"{source}/{repo-dir-name}"`

**与 SkillsService 的差异**:
- CommandsService 不检查 `skills/` 子目录, 只查找 `commands/` 子目录
- CommandsService 扫描文件 (`.md`), 不扫描子目录
- Custom commands 在 `custom/commands/` 而非各个 custom skill 目录下

**方法**:
- `getAllCommands()`: 遍历所有来源, 返回全部 command. 每次调用重新扫描.
- `getCommandByName(name)`: `.find()` 返回第一个匹配
- `findCommandsByName(name)`: `.filter()` 返回所有同名 command
- `getCommandsByNames(names)`: 批量查找, 过滤 undefined

### 2. 安装

commands 在 `install` 时**自动**随 skill 一起安装, 不需要用户选择:

**GitHub API 方式**:
1. 在仓库中依次尝试 `commands/` 和 `src/commands/` 路径
2. 调用 `githubService.listCommands()` 获取 .md 文件列表
3. 如果找到, 在 `{targetBase}/commands/` 下逐个下载
4. 仓库只有 command 没有 skill 时, 仅安装 command 也算成功

**Git clone 方式**:
1. clone 整个仓库后, commands 已经在仓库目录中
2. 通过 `countCommandsInRepo()` 统计 commands 数量 (用于输出信息)
3. 检查 `commands/` 和 `src/commands/` 两个路径
4. 不需要单独下载

**输出**: 安装完成时输出 "Installed X skills and Y commands to path"

### 3. 部署

通过 `init` 或 `add` 命令部署到项目:

**部署逻辑** (`Deployer.deployCommand()`):
1. 检查 `toolConfig.commandsDir` 是否存在, 不存在则直接 return (不报错)
2. 目标路径: `{project}/{toolConfig.commandsDir}/{command.name}.md`
3. link 模式: `linkFile()` 对单个 .md 文件创建 symlink, 已存在时先 unlink
4. copy 模式: `copyFile()` 复制单个 .md 文件

**init 命令中的部署流程**:
1. 筛选出支持 commands 的工具 (`toolConfig.commandsDir` 不为 undefined)
2. 只有存在可用 command **且** 有支持 commands 的工具被选中时, 才显示 command 选择提示
3. 增量逻辑与 skill 相同: toRemove/toKeep/toAdd 三分类处理

**add 命令中的部署流程**:
1. 如果 name 同时匹配 skill 和 command, 优先作为 skill 部署
2. 只有在 skill 匹配为空时才尝试作为 command 部署
3. 对不支持 commands 的工具输出 "· DisplayName (commands not supported)"
4. 已部署的 command 输出 "· DisplayName (already deployed)"

### 4. 移除

**通过 `remove` 命令**:
1. 对每个目标工具, 先检查 skills, 再检查 commands
2. command 移除: `deployer.removeCommand()` → `removeFile()` (unlinkSync)
3. 如果 `toolConfig.commandsDir` 为 undefined, 跳过该工具的 command 检查

**通过 `init` 命令**:
- 取消选择的 command 被移除

### 5. 同步验证

与 skill 同步逻辑类似, 但有差异:

**检查逻辑**:

1. **查找源**: 调用 `commandsService.getCommandByName()`
2. **孤立检测**: 源不存在时提示移除或保留
3. **Symlink 检测**: symlink 有效时显示 "up to date (link)"
4. **Copy 内容对比**: 直接对比 .md 文件全文内容 (不像 skill 只对比 SKILL.md)

**与 skill sync 的差异**:
- 无冲突检测, 不跳过任何 command
- Copy 变更时只有 "Overwrite" 和 "Skip" 两个选项, 没有 "Show diff" (通过 `promptSyncAction(name, false)` 调用, 第二个参数禁用 diff 选项)
- 对比的是 command 文件本身的全部内容, 不是子文件

### 6. 更新

与 skill 更新逻辑一致:
- 比较远程和本地 .md 文件内容 (全文)
- 内容不同时: `removeFile()` 删除本地, 然后 `downloadCommandFile()` 重新下载
- 更新只针对本地已存在的 command, 不安装新 command

## 工具支持矩阵

支持 commands 的工具 (有 `commandsDir` 配置):

| 工具 | commandsDir | 备注 |
|------|-------------|------|
| Claude Code | .claude/commands | |
| Cursor | .cursor/commands | |
| Roo Code | .roo/commands | |
| Kilo Code | .kilocode/commands | |
| Gemini CLI | .gemini/commands | |
| OpenCode | .opencode/commands | |
| Antigravity | .agent/workflows | 使用 workflows 目录名 |
| Windsurf | .windsurf/workflows | 使用 workflows 目录名 |

不支持的工具 (commandsDir 为 undefined): Cline, Codex CLI, Trae.

**注意**: 部分工具使用 `workflows` 而非 `commands` 作为目录名, 但代码层面没有区别 — 都是部署 .md 文件到指定目录.

## 测试用例

### CommandsService

#### 发现与加载

- test_getAllCommands_emptyDir_returnsEmpty: 无 commands 目录时返回空数组
- test_getAllCommands_officialCommands_loadsCorrectly: `official/anthropic/commands/commit.md` 存在时, 返回 CommandInfo 且 name="commit", source="official/anthropic"
- test_getAllCommands_customCommands_loadsFromCustomCommandsDir: custom 来源从 `custom/commands/` 加载, 不是从 custom skill 目录
- test_getAllCommands_nonMdFiles_ignored: commands 目录下的非 .md 文件被忽略
- test_getAllCommands_noCommandsSubdir_returnsEmpty: 仓库目录下没有 commands/ 子目录时返回空
- test_getAllCommands_sortedByName: 返回结果按文件名字母序

#### Frontmatter 解析

- test_parseCommandMd_validFrontmatter_parsesNameAndDesc: 标准 frontmatter 正确解析
- test_parseCommandMd_noFrontmatter_usesFilename: 无 frontmatter 时 name 使用文件名 (去掉 .md)
- test_parseCommandMd_nameInFrontmatter_overridesFilename: frontmatter 中的 name 优先于文件名

#### 查找

- test_getCommandByName_exists_returnsFirst: 存在时返回第一个匹配
- test_getCommandByName_notExists_returnsUndefined: 不存在时返回 undefined
- test_findCommandsByName_multipleMatches_returnsAll: 多个 source 有同名 command 时全部返回

### 安装

- test_install_githubRepo_commandsAutoInstalled: 安装 skill 仓库时, commands/ 下的 .md 文件自动安装
- test_install_commandsOnlyRepo_succeeds: 仓库只有 commands 没有 skills 时也能成功安装
- test_install_noCommandsDir_skipsCommands: 仓库没有 commands/ 目录时正常跳过, 不报错
- test_install_commandsInSrcDir_found: commands 在 `src/commands/` 路径时也能被发现
- test_install_commandsCount_correctOutput: 安装输出中 command 数量正确

### 部署

- test_deployCommand_linkMode_createsFileSymlink: link 模式创建文件级 symlink
- test_deployCommand_copyMode_copiesFile: copy 模式复制 .md 文件
- test_deployCommand_noCommandsDir_silentlySkips: 工具不支持 commands 时不报错
- test_deployCommand_existingLink_replacesLink: 目标已存在 symlink 时替换

### init 中的 Command 处理

- test_init_noCommandSupportTools_skipCommandPrompt: 所有选中工具都不支持 commands 时, 不显示 command 选择提示
- test_init_someCommandSupportTools_showsPrompt: 至少一个选中工具支持 commands 时, 显示提示
- test_init_commandDeployToUnsupportedTool_skips: command 不会被部署到不支持的工具

### add 命令

- test_add_nameMatchesBothSkillAndCommand_deploysAsSkill: 同名存在 skill 和 command 时, 优先部署为 skill
- test_add_commandOnly_deploysCommand: 只匹配 command 时部署 command
- test_add_commandToUnsupportedTool_showsNotSupported: 目标工具不支持 commands 时显示提示
- test_add_commandAlreadyDeployed_showsAlreadyDeployed: 已部署时显示 "already deployed"

### 移除

- test_removeCommand_exists_deletesFile: 已部署 command 被删除
- test_removeCommand_notExists_noError: 不存在时不报错
- test_removeCommand_skillAndCommandSameName_removesBoth: remove 同时检查 skill 和 command 命名空间

### 同步

- test_syncCommand_linked_showsUpToDate: symlink 有效时显示 "up to date (link)"
- test_syncCommand_orphaned_promptsAction: 源不存在时提示操作
- test_syncCommand_copiedUnchanged_showsUpToDate: copy 模式内容一致时显示 "up to date (copy)"
- test_syncCommand_copiedChanged_promptsOverwriteOrSkip: copy 模式内容变更时只有 Overwrite 和 Skip 选项
- test_syncCommand_copiedChanged_noShowDiffOption: 确认不提供 Show diff 选项

### DeploymentScanner Command 扫描

- test_scanCommands_emptyDir_returnsEmpty: commands 目录为空时返回空数组
- test_scanCommands_mdFilesOnly_scanned: 只扫描 .md 文件
- test_scanCommands_linkedCommand_detectsSource: symlink 的 command 正确检测 source
- test_scanCommands_copiedCommand_uniqueSource_detected: copy 模式, 唯一匹配时正确检测 source
- test_scanCommands_copiedCommand_multipleMatches_sourceUnknown: copy 模式, 多个匹配时 source 为 "unknown" (注意: 与 skill 不同, command 没有 conflict 字段, 只是 source 变为 unknown)
- test_scanCommands_toolWithoutCommandsDir_skipped: 不支持 commands 的工具不扫描 commands
