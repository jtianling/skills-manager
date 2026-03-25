## MODIFIED Requirements

### Requirement: ToolConfig data model

ToolConfig 数据模型变更:

| 字段 | 类型 | 说明 |
|------|------|------|
| name | ToolName | 工具标识符 |
| displayName | string | 显示名称 |
| skillsDir | string | 统一为 `.agents/skills` |
| supportsLink | boolean | 是否支持 symlink 部署 skill |
| native | boolean | 是否原生支持 `.agents/skills` |
| symlinkDir | string? | 非原生工具的 symlink 源路径, 如 `.claude/skills` |

移除字段: `supportsModeSpecific`, `modePattern`, `availableModes`.

所有工具的 `skillsDir` SHALL 为 `.agents/skills`.

Native 工具 (codex, gemini-cli, opencode, openclaw, antigravity, cline) 的 `native` SHALL 为 true, `symlinkDir` SHALL 为 undefined.

Non-native 工具 (claude-code, cursor, kilo-code, roo-code, trae, windsurf) 的 `native` SHALL 为 false, `symlinkDir` SHALL 为对应的工具目录路径.

#### Scenario: All tools have skillsDir as .agents/skills

- **WHEN** 遍历 TOOL_CONFIGS 中所有工具
- **THEN** 每个工具的 skillsDir 均为 `.agents/skills`

#### Scenario: Native tools have native=true

- **WHEN** 查询 codex, gemini-cli, opencode, openclaw, antigravity, cline 的 ToolConfig
- **THEN** native 为 true 且 symlinkDir 为 undefined

#### Scenario: Non-native tools have native=false with symlinkDir

- **WHEN** 查询 claude-code, cursor, kilo-code, roo-code, trae, windsurf 的 ToolConfig
- **THEN** native 为 false 且 symlinkDir 为对应的工具 skills 路径

#### Scenario: No mode-specific fields exist

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 不存在 supportsModeSpecific, modePattern, availableModes 属性

### Requirement: Skills deployment targets single directory

All skills SHALL be deployed to `.agents/skills/` regardless of which tools are selected.  The deployer SHALL NOT deploy skills to individual tool directories.

#### Scenario: Deploy skill writes to .agents/skills only

- **WHEN** user deploys skill "code-review" for claude-code and cursor
- **THEN** skill is deployed to `.agents/skills/code-review/` only (not to `.claude/skills/` or `.cursor/skills/`)

#### Scenario: Remove skill from .agents/skills

- **WHEN** user removes skill "code-review"
- **THEN** `.agents/skills/code-review/` is removed
- **AND** symlink bridges remain unaffected

### Requirement: Tool selection UI grouping

工具选择 UI SHALL 分组显示:

1. "Agents Skills Standard" — 聚合显示所有 native 工具名称, 选中时表示部署 `.agents/skills/`
2. 每个 non-native 工具单独显示, 标注 symlink 关系

"Agents Skills Standard" 是一个虚拟选项, 不对应 SUPPORTED_TOOLS 中的单个工具.  选中时不创建 symlink, 仅确保 `.agents/skills/` 目录存在.

#### Scenario: UI displays grouped tools

- **WHEN** 用户执行 init 命令
- **THEN** 工具选择列表显示 "Agents Skills Standard" 选项, 后跟 native 工具名称列表
- **AND** 每个 non-native 工具单独显示, 标注 "(symlink: .xxx/skills → .agents/skills)"

#### Scenario: Selecting Agents Skills Standard only

- **WHEN** 用户仅选择 "Agents Skills Standard"
- **THEN** skills 部署到 `.agents/skills/`, 不创建任何 symlink

#### Scenario: Selecting non-native tool implies agents skills

- **WHEN** 用户选择 Claude Code (non-native tool)
- **THEN** skills 部署到 `.agents/skills/` 且 `.claude/skills → .agents/skills` symlink 被创建

### Requirement: Deployment scanning

扫描 SHALL 只扫描 `.agents/skills/` 目录获取已部署的 skills.  `getConfiguredTools()` SHALL 通过检查 symlink 存在性判断非原生工具是否已配置.

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

### Requirement: getTargetDir simplification

`getTargetDir` SHALL 不再接受 mode 参数, 直接返回 `.agents/skills`.

#### Scenario: getTargetDir returns .agents/skills

- **WHEN** 调用 getTargetDir()
- **THEN** 返回 `.agents/skills`

## REMOVED Requirements

### Requirement: Mode-specific deployment
**Reason**: 简化架构, 所有工具统一使用 `.agents/skills` 目录, 不再支持 `skills-code/`, `skills-architect/` 等模式特定目录.
**Migration**: 用户需手动删除旧的 mode-specific 目录 (如 `.roo/skills-code/`), 重新运行 `skillsmgr init`.

### Requirement: Non-universal tools maintain separate directories
**Reason**: 统一为 `.agents/skills` + symlink 桥接架构.
**Migration**: 重新运行 `skillsmgr init`, 旧的独立目录 (如 `.cursor/skills/` 实体目录) 需手动清理.
