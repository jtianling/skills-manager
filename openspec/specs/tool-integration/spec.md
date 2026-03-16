# Tool Integration

skillsmgr 支持 12 种 AI 编程工具, 每种工具有各自的目录约定和能力差异.

## 支持的工具

常量 `SUPPORTED_TOOLS` 定义了工具标识符列表, 分为两组:

**优先组** (手动排序, 固定顺序):

```
claude-code, codex, gemini-cli, opencode, openclaw, antigravity
```

**其余组** (按 displayName 字母顺序):

```
cline, cursor, kilo-code, roo-code, trae, windsurf
```

此顺序影响 UI 中工具选择的显示顺序和 `scanAllTools()` 的遍历顺序.

| 工具 | 标识符 | Skills 目录 | Commands 目录 | 模式支持 |
|------|--------|------------|--------------|---------|
| Claude Code | claude-code | .claude/skills | .claude/commands | No |
| Codex | codex | .codex/skills | - | No |
| Gemini CLI | gemini-cli | .gemini/skills | .gemini/commands | No |
| OpenCode | opencode | .opencode/skills | .opencode/commands | No |
| OpenClaw | openclaw | .openclaw/skills | - | No |
| Antigravity | antigravity | .agent/skills | .agent/workflows | No |
| Cline | cline | .cline/skills | - | No |
| Cursor | cursor | .cursor/skills | .cursor/commands | No |
| Kilo Code | kilo-code | .kilocode/skills | .kilocode/commands | Yes |
| Roo Code | roo-code | .roo/skills | .roo/commands | Yes |
| Trae | trae | .trae/skills | - | No |
| Windsurf | windsurf | .windsurf/skills | .windsurf/workflows | No |

## 数据模型

### ToolConfig

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | ToolName | - | 工具标识符, 与 SUPPORTED_TOOLS 中的值对应 |
| displayName | string | - | 用户可见的显示名称 (如 "Claude Code", "Roo Code") |
| skillsDir | string | - | skills 部署目录, 相对于项目根目录 |
| commandsDir | string? | undefined | commands 部署目录, 不支持时为 undefined |
| supportsLink | boolean | true | 是否支持 symlink, 当前所有工具均为 true |
| supportsModeSpecific | boolean | false | 是否支持模式特定部署 |
| modePattern | string? | undefined | 模式目录模式, 仅 mode-specific 工具有值 |
| availableModes | string[]? | undefined | 可用模式列表, 仅 mode-specific 工具有值 |

### ToolName

类型别名 `typeof SUPPORTED_TOOLS[number]`, 是 12 个工具标识符的联合类型.

## 能力维度详解

### 1. Skills 目录

所有 12 个工具均支持 skills 部署.  部署时在项目中创建对应的目录结构:

```
project/
├── .agent/skills/          # Antigravity
├── .claude/skills/         # Claude Code
├── .cline/skills/          # Cline
├── .codex/skills/          # Codex CLI
├── .cursor/skills/         # Cursor
├── .gemini/skills/         # Gemini CLI
├── .kilocode/skills/       # Kilo Code
├── .openclaw/skills/       # OpenClaw
├── .opencode/skills/       # OpenCode
├── .roo/skills/            # Roo Code
├── .trae/skills/           # Trae
└── .windsurf/skills/       # Windsurf
```

每个工具的 skills 目录是独立的.  同一个 skill 可以同时部署到多个工具.

### 2. Commands 目录

8 个工具支持 commands (commandsDir 不为 undefined):
- Claude Code: `.claude/commands`
- Cursor: `.cursor/commands`
- Roo Code: `.roo/commands`
- Kilo Code: `.kilocode/commands`
- Gemini CLI: `.gemini/commands`
- OpenCode: `.opencode/commands`
- Antigravity: `.agent/workflows` (目录名为 workflows)
- Windsurf: `.windsurf/workflows` (目录名为 workflows)

不支持 commands 的工具 (commandsDir 为 undefined):
- Cline
- Codex CLI
- Trae
- OpenClaw

**注意**: Antigravity 和 Windsurf 使用 `workflows` 而非 `commands` 作为目录名.  代码层面无差异 — `commandsDir` 只是一个路径字符串, 部署逻辑不关心目录名语义.

### 3. 模式特定部署 (Mode-Specific)

仅 Roo Code 和 Kilo Code 支持.  两者配置完全对称:

```typescript
{
  supportsModeSpecific: true,
  modePattern: 'skills-{mode}',
  availableModes: ['code', 'architect'],
}
```

**可选模式**:
- `all`: 使用基础 skillsDir, 不应用 modePattern
- `code`: 替换为 mode-specific 目录
- `architect`: 替换为 mode-specific 目录

**路径计算** (`getTargetDir` 函数):

```
条件: supportsModeSpecific === true && mode 存在 && mode !== "all" && modePattern 存在
  → baseDir = skillsDir 去掉最后一段 (用 split('/').slice(0, -1).join('/'))
  → 返回 baseDir + "/" + modePattern.replace('{mode}', mode)
否则:
  → 返回 skillsDir (原样)
```

**具体路径映射**:

| 工具 | mode | 结果 |
|------|------|------|
| Roo Code | all | .roo/skills |
| Roo Code | code | .roo/skills-code |
| Roo Code | architect | .roo/skills-architect |
| Kilo Code | all | .kilocode/skills |
| Kilo Code | code | .kilocode/skills-code |
| Kilo Code | architect | .kilocode/skills-architect |

**注意**: commands 目录不受 mode 影响.  `getCommandsTargetDir()` 直接返回 `toolConfig.commandsDir`, 没有 mode 参数.

### 4. Symlink 支持

当前所有工具的 `supportsLink` 均为 true.  这意味着:
- 默认部署方式为 symlink
- 用户可通过 `--copy` 选项改为复制

虽然代码中保留了 `supportsLink` 字段, 但当前没有任何工具将其设为 false.  如果未来某工具不支持 symlink, 需要在部署逻辑中检查此字段.

## 部署扫描

`DeploymentScanner` 扫描项目目录以检测已部署的 skill 和 command.

### 扫描流程

`scanAllTools()`:
1. 按 `SUPPORTED_TOOLS` 顺序遍历所有 12 个工具
2. 对每个工具调用 `scanToolDeployment()`
3. 过滤掉 skills 和 commands 都为空的工具
4. 返回 `ScannedToolDeployment[]`

`scanToolDeployment(toolName, config)`:
1. 扫描基础 skills 目录 (`config.skillsDir`)
2. 如果工具有 commandsDir, 扫描 commands 目录
3. 如果工具支持 mode-specific, 额外扫描每个 mode 的目录
4. 返回 `ScannedToolDeployment[]` (可能多个, 对应不同 mode)

### Skill 扫描细节

`scanDirectory()`:
1. 检查目录是否存在, 不存在则返回空 deployment
2. 使用 `readdirSync({ withFileTypes: true })` 读取所有条目
3. 对每个条目调用 `scanSkill()`:
   - 检查 `{entry}/SKILL.md` 是否存在, 不存在则返回 null
   - 是 symlink: 读取 symlink target, 从路径中提取 source
   - 非 symlink (copy): 通过 `findSourceByName()` 在 SkillsService 中查找

### Command 扫描细节

`scanCommandsDirectory()`:
1. 检查目录是否存在
2. 只扫描 `.md` 文件 (`entry.isFile() && entry.name.endsWith('.md')`)
3. 文件名去掉 `.md` 作为 command name
4. 是 symlink: 从 target 路径提取 source
5. 非 symlink (copy): 通过 `commandsService.findCommandsByName()` 查找, 唯一匹配则使用其 source, 否则 source 为 "unknown"

### Source 推断逻辑

从 symlink target 路径中提取 source (`extractSourceFromPath()`):

1. 将路径中的反斜杠替换为正斜杠 (跨平台)
2. 查找 `.skills-manager/` 子串
3. 取子串之后的部分, 按 `/` 分割
4. 如果第一段是 `custom` → 返回 `"custom"`
5. 否则取前两段 → 返回 `"{source}/{repo}"` (如 "official/anthropic")
6. 如果路径中不包含 `.skills-manager/` → 返回 null → 最终 source 为 "unknown"

### 已配置工具

`getConfiguredTools()`:
1. 遍历所有 12 个工具
2. 对每个工具调用 `scanToolDeployment()`
3. 如果任一 deployment 中有 skills 或 commands → 视为已配置
4. 返回 `ToolName[]`

**使用场景**:
- `add` 命令不指定 `--tool` 时, 部署到所有已配置工具
- `remove` 命令不指定 `--tool` 时, 从所有已配置工具移除
- `init` 命令在工具选择界面标记 "[configured]" 并默认选中

## 初始化流程 (setup)

`setup` 命令创建 `~/.skills-manager/` 基础结构:

1. 按 `SKILL_SOURCES` 顺序 (`['official', 'community', 'custom']`) 创建子目录
2. 使用 `ensureDir()` (mkdirSync recursive) 创建, 已存在时不报错
3. 复制内置的 `example-skill` 模板到 `custom/example-skill/`:
   - 模板源路径: `{__dirname}/templates/example-skill/` (构建后在 dist/ 目录下)
   - 如果 `custom/example-skill/` 已存在 → 跳过, 输出 "already exists, skipping"
   - 不存在 → `copyDir()` 复制, 输出 "Created custom/example-skill/SKILL.md"
4. 输出 "Next steps" 提示信息

**幂等性**: setup 可以多次运行, 不会覆盖已有内容. 已存在的目录和文件会被跳过.

**example-skill 模板内容**: 包含一个标准的 SKILL.md, 说明如何创建自定义 skill, 包括 frontmatter 格式, 目录结构建议, 和使用步骤.

## 测试用例

### ToolConfig 结构

- test_toolConfigs_allToolsHaveConfig: SUPPORTED_TOOLS 中的每个工具都有对应的 ToolConfig
- test_toolConfigs_allSupportsLink_true: 当前所有工具的 supportsLink 为 true
- test_toolConfigs_onlyRooAndKilo_supportModeSpecific: 仅 roo-code 和 kilo-code 的 supportsModeSpecific 为 true
- test_toolConfigs_modeSpecificTools_haveModePattern: 支持 mode 的工具都有 modePattern "skills-{mode}"
- test_toolConfigs_modeSpecificTools_haveAvailableModes: 支持 mode 的工具都有 availableModes ["code", "architect"]
- test_toolConfigs_commandsDir_correctTools: 正好 8 个工具有 commandsDir, 4 个没有 (cline, codex, trae, openclaw)
- test_toolConfigs_workflowsDirTools: antigravity 和 windsurf 的 commandsDir 使用 "workflows" 而非 "commands"

### getTargetDir

- test_getTargetDir_noMode_returnsSkillsDir: 不传 mode 参数时返回原始 skillsDir
- test_getTargetDir_modeAll_returnsSkillsDir: mode="all" 时返回原始 skillsDir
- test_getTargetDir_modeCode_rooCode_returnsCorrectPath: roo-code, mode="code" → ".roo/skills-code"
- test_getTargetDir_modeArchitect_kiloCode_returnsCorrectPath: kilo-code, mode="architect" → ".kilocode/skills-architect"
- test_getTargetDir_modeOnNonModeSpecificTool_returnsSkillsDir: 对不支持 mode 的工具传入 mode 参数时, 仍返回 skillsDir
- test_getTargetDir_modeUndefined_returnsSkillsDir: mode 为 undefined 时返回 skillsDir

### getCommandsTargetDir

- test_getCommandsTargetDir_hasCommandsDir_returnsIt: 有 commandsDir 的工具返回正确路径
- test_getCommandsTargetDir_noCommandsDir_returnsUndefined: 没有 commandsDir 的工具返回 undefined

### getToolConfig

- test_getToolConfig_validName_returnsConfig: 有效工具名返回对应 ToolConfig
- test_getToolConfig_invalidName_returnsUndefined: 无效名称返回 undefined

### 部署扫描

- test_scanAllTools_emptyProject_returnsEmpty: 新项目没有任何工具目录时返回空数组
- test_scanAllTools_oneToolWithSkills_returnsThatTool: 只有 .claude/skills/ 有内容时, 只返回 claude-code
- test_scanAllTools_multipleTools_returnsAll: 多个工具有部署时全部返回
- test_scanToolDeployment_baseAndMode_returnsMultiple: Roo Code 的 skills/ 和 skills-code/ 都有内容时, 返回两个 deployment
- test_scanToolDeployment_modeDir_hasCorrectMode: mode-specific 目录的 deployment 的 mode 字段正确设置
- test_getConfiguredTools_noDeployments_returnsEmpty: 无部署时返回空数组
- test_getConfiguredTools_withDeployments_returnsToolNames: 有部署时返回工具名列表

### Source 推断

- test_extractSource_officialPath_returnsOfficialRepo: `.../.skills-manager/official/anthropic/skill-name` → "official/anthropic"
- test_extractSource_communityPath_returnsCommunityRepo: `.../.skills-manager/community/repo/skill-name` → "community/repo"
- test_extractSource_customPath_returnsCustom: `.../.skills-manager/custom/skill-name` → "custom"
- test_extractSource_noSkillsManager_returnsNull: 路径不含 .skills-manager/ → null
- test_extractSource_windowsBackslash_normalized: Windows 反斜杠路径正确处理

### Setup

- test_setup_freshInstall_createsDirectories: 首次运行创建 official/, community/, custom/ 目录
- test_setup_freshInstall_copiesExampleSkill: 首次运行复制 example-skill 模板
- test_setup_alreadyExists_skipsExampleSkill: 再次运行时跳过已存在的 example-skill
- test_setup_idempotent_noErrors: 多次运行不报错
- test_setup_exampleSkill_hasValidFrontmatter: example-skill 的 SKILL.md 有有效的 name 和 description frontmatter
