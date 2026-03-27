# Tool Integration

skillsmgr 支持 45 种 AI 编程工具, 所有工具统一使用 `.agents/skills/` 目录部署 skills.  非原生工具通过 symlink 桥接访问该目录.

## 支持的工具

常量 `SUPPORTED_TOOLS` 定义了 45 个工具标识符列表.

**交互显示组** (`showInList=true`, 按 displayOrder 固定顺序):

```
claude-code, codex, cursor, openclaw, opencode, gemini-cli,
github-copilot, cline, kilo, roo, kiro-cli, trae, trae-cn,
codebuddy, windsurf, goose
```

**隐藏组** (`showInList=false`, 按 displayName 字母顺序):

```
adal, amp, antigravity, augment, command-code, continue, cortex,
crush, deepagents, droid, firebender, iflow-cli, junie, kimi-cli,
kode, mcpjam, mistral-vibe, mux, neovate, openhands, pi, pochi,
qoder, qwen-code, replit, universal, warp, zencoder
```

此顺序影响 UI 中 agent 选择的显示顺序.

完整 agent 配置表:

| 工具 | 标识符 | Native | 项目级 Skills 目录 | Symlink 源 | 全局 Skills 目录 | showInList |
|------|--------|--------|-------------------|-----------|-----------------|-----------|
| Claude Code | claude-code | No | .agents/skills | .claude/skills | ~/.claude/skills | Yes |
| Codex | codex | Yes | .agents/skills | - | ~/.codex/skills | Yes |
| Cursor | cursor | Yes | .agents/skills | - | ~/.cursor/skills | Yes |
| OpenClaw | openclaw | No | .agents/skills | skills | ~/.openclaw/skills | Yes |
| OpenCode | opencode | Yes | .agents/skills | - | ~/.config/opencode/skills | Yes |
| Gemini CLI | gemini-cli | Yes | .agents/skills | - | ~/.gemini/skills | Yes |
| GitHub Copilot | github-copilot | Yes | .agents/skills | - | ~/.copilot/skills | Yes |
| Cline | cline | Yes | .agents/skills | - | ~/.agents/skills | Yes |
| Kilo Code | kilo | No | .agents/skills | .kilocode/skills | ~/.kilocode/skills | Yes |
| Roo Code | roo | No | .agents/skills | .roo/skills | ~/.roo/skills | Yes |
| Kiro CLI | kiro-cli | No | .agents/skills | .kiro/skills | ~/.kiro/skills | Yes |
| Trae | trae | No | .agents/skills | .trae/skills | ~/.trae/skills | Yes |
| Trae CN | trae-cn | No | .agents/skills | .trae/skills | ~/.trae-cn/skills | Yes |
| CodeBuddy | codebuddy | No | .agents/skills | .codebuddy/skills | ~/.codebuddy/skills | Yes |
| Windsurf | windsurf | No | .agents/skills | .windsurf/skills | ~/.codeium/windsurf/skills | Yes |
| Goose | goose | No | .agents/skills | .goose/skills | ~/.config/goose/skills | Yes |
| Amp | amp | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Antigravity | antigravity | Yes | .agents/skills | - | ~/.gemini/antigravity/skills | No |
| Augment | augment | No | .agents/skills | .augment/skills | ~/.augment/skills | No |
| Warp | warp | Yes | .agents/skills | - | ~/.agents/skills | No |
| Kimi Code CLI | kimi-cli | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Replit | replit | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Universal | universal | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Deep Agents | deepagents | Yes | .agents/skills | - | ~/.deepagents/agent/skills | No |
| Firebender | firebender | Yes | .agents/skills | - | ~/.firebender/skills | No |
| Command Code | command-code | No | .agents/skills | .commandcode/skills | ~/.commandcode/skills | No |
| Continue | continue | No | .agents/skills | .continue/skills | ~/.continue/skills | No |
| Cortex Code | cortex | No | .agents/skills | .cortex/skills | ~/.snowflake/cortex/skills | No |
| Crush | crush | No | .agents/skills | .crush/skills | ~/.config/crush/skills | No |
| Droid | droid | No | .agents/skills | .factory/skills | ~/.factory/skills | No |
| iFlow CLI | iflow-cli | No | .agents/skills | .iflow/skills | ~/.iflow/skills | No |
| Junie | junie | No | .agents/skills | .junie/skills | ~/.junie/skills | No |
| Kode | kode | No | .agents/skills | .kode/skills | ~/.kode/skills | No |
| MCPJam | mcpjam | No | .agents/skills | .mcpjam/skills | ~/.mcpjam/skills | No |
| Mistral Vibe | mistral-vibe | No | .agents/skills | .vibe/skills | ~/.vibe/skills | No |
| Mux | mux | No | .agents/skills | .mux/skills | ~/.mux/skills | No |
| OpenHands | openhands | No | .agents/skills | .openhands/skills | ~/.openhands/skills | No |
| Pi | pi | No | .agents/skills | .pi/skills | ~/.pi/agent/skills | No |
| Qoder | qoder | No | .agents/skills | .qoder/skills | ~/.qoder/skills | No |
| Qwen Code | qwen-code | No | .agents/skills | .qwen/skills | ~/.qwen/skills | No |
| Zencoder | zencoder | No | .agents/skills | .zencoder/skills | ~/.zencoder/skills | No |
| Neovate | neovate | No | .agents/skills | .neovate/skills | ~/.neovate/skills | No |
| Pochi | pochi | No | .agents/skills | .pochi/skills | ~/.pochi/skills | No |
| AdaL | adal | No | .agents/skills | .adal/skills | ~/.adal/skills | No |

所有工具的 `skillsDir` SHALL 为 `.agents/skills`.

#### Scenario: All tools have skillsDir as .agents/skills

- **WHEN** 遍历 TOOL_CONFIGS 中所有 45 个工具
- **THEN** 每个工具的 skillsDir 均为 `.agents/skills`

#### Scenario: Native tools have native=true

- **WHEN** 查询 codex, cursor, opencode, gemini-cli, github-copilot, cline, amp, antigravity, warp, kimi-cli, replit, universal, deepagents, firebender 的 ToolConfig
- **THEN** native 为 true 且 symlinkDir 为 undefined

#### Scenario: Non-native tools have native=false with symlinkDir

- **WHEN** 查询 claude-code, openclaw, kilo, roo, kiro-cli, trae, trae-cn, codebuddy, windsurf, goose, augment, command-code, continue, cortex, crush, droid, iflow-cli, junie, kode, mcpjam, mistral-vibe, mux, openhands, pi, qoder, qwen-code, zencoder, neovate, pochi, adal 的 ToolConfig
- **THEN** native 为 false 且 symlinkDir 为对应的工具 skills 路径

#### Scenario: All tools have globalSkillsDir

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** globalSkillsDir 为对应的全局路径字符串

#### Scenario: No mode-specific fields exist

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 不存在 supportsModeSpecific, modePattern, availableModes 属性

## 数据模型

### ToolConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| name | ToolName | 工具标识符 |
| displayName | string | 显示名称 |
| skillsDir | string | 统一为 `.agents/skills` |
| globalSkillsDir | string | 全局 skills 目录路径 |
| supportsLink | boolean | 是否支持 symlink 部署 skill |
| native | boolean | 是否原生支持 `.agents/skills` |
| symlinkDir | string? | 非原生工具的 symlink 源路径 |
| showInList | boolean | 交互选择是否显示 |

所有工具的 `skillsDir` SHALL 为 `.agents/skills`.

Native 工具 (codex, cursor, opencode, gemini-cli, github-copilot, cline, amp, antigravity, warp, kimi-cli, replit, universal, deepagents, firebender) 的 `native` SHALL 为 true, `symlinkDir` SHALL 为 undefined.

Non-native 工具 (claude-code, openclaw, kilo, roo, kiro-cli, trae, trae-cn, codebuddy, windsurf, goose, augment, command-code, continue, cortex, crush, droid, iflow-cli, junie, kode, mcpjam, mistral-vibe, mux, openhands, pi, qoder, qwen-code, zencoder, neovate, pochi, adal) 的 `native` SHALL 为 false, `symlinkDir` SHALL 为对应的工具目录路径.

#### Scenario: ToolConfig has globalSkillsDir field

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 存在 `globalSkillsDir` 属性且为非空字符串

#### Scenario: ToolConfig has showInList field

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 存在 `showInList` 属性且为布尔值

#### Scenario: ToolConfig no longer has commandsDir

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 不存在 `commandsDir` 属性

### ToolName

类型别名 `typeof SUPPORTED_TOOLS[number]`, 是 45 个工具标识符的联合类型.

#### Scenario: ToolName includes 45 identifiers

- **WHEN** 检查 SUPPORTED_TOOLS 长度
- **THEN** 长度为 45

## 能力维度详解

### 1. Skills 部署统一目录

All skills SHALL be deployed to `.agents/skills/` regardless of which tools are selected.  The deployer SHALL NOT deploy skills to individual tool directories.

```
project/
├── .agents/skills/        # 所有 skills 统一部署目录
├── .claude/skills → .agents/skills   # symlink bridge (non-native)
├── .kilocode/skills → .agents/skills # symlink bridge (kilo, non-native)
├── .roo/skills → .agents/skills      # symlink bridge (roo, non-native)
├── .trae/skills → .agents/skills     # symlink bridge (non-native)
├── .windsurf/skills → .agents/skills # symlink bridge (non-native)
└── ...                               # 其他 non-native 工具类似
```

Native 工具直接读取 `.agents/skills/`, non-native 工具通过 symlink 桥接访问.

#### Scenario: Deploy skill writes to .agents/skills only

- **WHEN** user deploys skill "code-review" for claude-code and cursor
- **THEN** skill is deployed to `.agents/skills/code-review/` only (not to `.claude/skills/` or `.cursor/skills/`)

#### Scenario: Remove skill from .agents/skills

- **WHEN** user removes skill "code-review"
- **THEN** `.agents/skills/code-review/` is removed
- **AND** symlink bridges remain unaffected

### 2. Tool selection UI grouping

工具选择 UI SHALL 根据部署模式 (项目级/全局) 使用不同显示逻辑:

**项目级** (无 `-g`):
1. "Agents Skills Standard" — 聚合显示所有 native 且 `showInList=true` 的工具名称, 选中时表示部署 `.agents/skills/`
2. 每个 non-native 且 `showInList=true` 的工具单独显示, 标注 symlink 关系

**全局级** (`-g`):
1. 每个 `showInList=true` 的工具独立显示 (无聚合选项)
2. 显示全局路径作为说明

"Agents Skills Standard" 是一个虚拟选项, 不对应 SUPPORTED_TOOLS 中的单个工具.  选中时不创建 symlink, 仅确保 `.agents/skills/` 目录存在.

提示消息从 "Select target tools:" 改为 "Select target agents:".

#### Scenario: 项目级 UI displays grouped agents

- **WHEN** 用户进入 agent 选择 (`add` 命令, 无 `-g`)
- **THEN** 工具选择列表显示 "Agents Skills Standard" 选项, 后跟 native 工具名称列表
- **AND** 每个 non-native 且 showInList=true 的工具单独显示

#### Scenario: 全局级 UI displays individual agents

- **WHEN** 用户进入 agent 选择 (`add -g` 命令)
- **THEN** 每个 showInList=true 的工具独立显示, 附带全局路径
- **AND** 无 "Agents Skills Standard" 聚合选项

#### Scenario: Selecting Agents Skills Standard only

- **WHEN** 用户仅选择 "Agents Skills Standard"
- **THEN** skills 部署到 `.agents/skills/`, 不创建任何 symlink

#### Scenario: Selecting non-native agent implies agents skills

- **WHEN** 用户选择 Claude Code (non-native tool)
- **THEN** skills 部署到 `.agents/skills/` 且 `.claude/skills -> .agents/skills` symlink 被创建

### Requirement: list --deployed 输出中的术语

`list --deployed` 输出中的 "Configured tools:" SHALL 改为 "Configured agents:".

#### Scenario: list deployed 使用 agents 术语
- **WHEN** 执行 `list --deployed`
- **THEN** 输出中显示 "Configured agents:" 而非 "Configured tools:"

### 3. Symlink 支持

当前所有工具的 `supportsLink` 均为 true.  这意味着:
- 默认部署方式为 symlink
- 用户可通过 `--copy` 选项改为复制

虽然代码中保留了 `supportsLink` 字段, 但当前没有任何工具将其设为 false.  如果未来某工具不支持 symlink, 需要在部署逻辑中检查此字段.

## 部署扫描

扫描 SHALL 只扫描 `.agents/skills/` 目录获取已部署的 skills.  `getConfiguredTools()` SHALL 通过检查 symlink 存在性判断非原生工具是否已配置.

### 扫描流程

`scanAllTools()`:
1. 扫描 `.agents/skills/` 目录获取已部署的 skills
2. 返回 `ScannedToolDeployment[]`

#### Scenario: Scan finds skills in .agents/skills

- **WHEN** `.agents/skills/` 下有 skill "code-review"
- **THEN** 扫描返回该 skill

#### Scenario: Native tool configured when skills exist

- **WHEN** `.agents/skills/` 下有已部署的 skills
- **THEN** 所有 native 工具均报告为已配置

#### Scenario: Non-native tool configured when symlink exists

- **WHEN** `.claude/skills` 是指向 `.agents/skills` 的 symlink
- **THEN** claude-code 报告为已配置

#### Scenario: Non-native tool not configured without symlink

- **WHEN** `.claude/skills` symlink 不存在
- **THEN** claude-code 不报告为已配置 (即使 `.agents/skills/` 有内容)

### Skill 扫描细节

`scanDirectory()`:
1. 检查目录是否存在, 不存在则返回空 deployment
2. 使用 `readdirSync({ withFileTypes: true })` 读取所有条目
3. 对每个条目调用 `scanSkill()`:
   - 检查 `{entry}/SKILL.md` 是否存在, 不存在则返回 null
   - 是 symlink: 读取 symlink target, 从路径中提取 source
   - 非 symlink (copy): 通过 `findSourceByName()` 在 SkillsService 中查找

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
1. 检查 `.agents/skills/` 是否有已部署的 skills
2. 如果有 → 所有 native 工具视为已配置
3. 对每个 non-native 工具, 检查对应 symlink 是否存在且指向 `.agents/skills`
4. 返回 `ToolName[]`

**使用场景**:
- `add` 命令不指定 `--tool` 时, 部署到所有已配置工具
- `remove` 命令不指定 `--tool` 时, 从所有已配置工具移除
- `init` 命令在工具选择界面标记 "[configured]" 并默认选中

### getTargetDir 简化

`getTargetDir` SHALL 不再接受 mode 参数, 直接返回 `.agents/skills`.

#### Scenario: getTargetDir returns .agents/skills

- **WHEN** 调用 getTargetDir()
- **THEN** 返回 `.agents/skills`

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
- test_toolConfigs_allSkillsDir_agentsSkills: 所有工具的 skillsDir 均为 `.agents/skills`
- test_toolConfigs_nativeTools_haveNativeTrue: native 工具的 native 为 true 且 symlinkDir 为 undefined
- test_toolConfigs_nonNativeTools_haveNativeFalse: non-native 工具的 native 为 false 且 symlinkDir 有值
- test_toolConfigs_allToolsHaveGlobalSkillsDir: 所有工具都有 globalSkillsDir 字段
- test_toolConfigs_allToolsHaveShowInList: 所有工具都有 showInList 布尔字段
- test_toolConfigs_noModeSpecificFields: 不存在 supportsModeSpecific, modePattern, availableModes 属性

### getTargetDir

- test_getTargetDir_returnsAgentsSkills: 调用 getTargetDir() 返回 `.agents/skills`

### getToolConfig

- test_getToolConfig_validName_returnsConfig: 有效工具名返回对应 ToolConfig
- test_getToolConfig_invalidName_returnsUndefined: 无效名称返回 undefined

### 部署扫描

- test_scanAllTools_emptyProject_returnsEmpty: `.agents/skills/` 不存在时返回空数组
- test_scanAllTools_withSkills_returnsDeployments: `.agents/skills/` 有内容时返回 deployment
- test_getConfiguredTools_noDeployments_returnsEmpty: 无部署时返回空数组
- test_getConfiguredTools_withSkills_nativeToolsConfigured: `.agents/skills/` 有内容时所有 native 工具已配置
- test_getConfiguredTools_symlinkExists_nonNativeToolConfigured: symlink 存在时对应 non-native 工具已配置
- test_getConfiguredTools_noSymlink_nonNativeToolNotConfigured: symlink 不存在时 non-native 工具未配置

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
