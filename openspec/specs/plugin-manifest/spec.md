# plugin-manifest Specification

## Purpose
TBD - created by archiving change add-plugin-manifest-support. Update Purpose after archive.
## Requirements
### Requirement: 解析 marketplace.json 多 plugin 目录

系统 SHALL 读取仓库根目录下 `.claude-plugin/marketplace.json` 文件, 解析其中的 `metadata.pluginRoot` 和 `plugins` 数组, 为每个 plugin 构造 skill 搜索路径.

搜索路径构造规则:
- 基础路径通过 `resolvePluginBase(basePath, pluginRoot, source)` 计算:
  - 若 `source` 未定义: `basePath + pluginRoot`
  - 若 `pluginRoot` 未定义: `basePath + source`
  - 若 `source` (去除 `./` 前缀后) 以 `pluginRoot` (去除 `./` 前缀后) 开头: `basePath + source` (source 已包含 pluginRoot, 避免路径重复)
  - 否则: `basePath + pluginRoot + source` (source 相对于 pluginRoot)
- 每个 plugin 的 skills 目录 = 基础路径 + `plugin.skills`(若为字符串)
- 若 plugin 未声明 `skills` 字段, 使用基础路径 + `skills/` 作为约定目录

#### Scenario: marketplace.json 存在且包含多个 plugin (pluginRoot 相对 source)

- **WHEN** 仓库根目录存在 `.claude-plugin/marketplace.json`, 内容包含 `pluginRoot: "./.github/plugins"` 和 3 个 plugin 声明, source 为 pluginRoot 相对路径 (如 `"./azure-sdk-python"`)
- **THEN** 系统 SHALL 返回 3 个 skill 搜索路径, 每个对应一个 plugin 的 skills 目录

#### Scenario: marketplace.json source 为仓库根相对路径 (与 pluginRoot 重叠)

- **WHEN** 仓库根目录存在 `.claude-plugin/marketplace.json`, `pluginRoot: "./.github/plugins"`, plugin source 为 `"./.github/plugins/azure-sdk-python"` (已包含 pluginRoot 前缀)
- **THEN** 系统 SHALL 检测到 source 包含 pluginRoot 前缀, 使用 `basePath + source` 构造路径 (而非 `basePath + pluginRoot + source`), 正确返回 skill 搜索路径

#### Scenario: marketplace.json 不存在

- **WHEN** 仓库根目录不存在 `.claude-plugin/marketplace.json`
- **THEN** 系统 SHALL 返回空数组, 不抛出错误

#### Scenario: marketplace.json 格式错误

- **WHEN** `.claude-plugin/marketplace.json` 存在但 JSON 格式无效
- **THEN** 系统 SHALL 返回空数组, 不抛出错误

### Requirement: 解析 plugin.json 单 plugin 目录

系统 SHALL 读取仓库根目录下 `.claude-plugin/plugin.json` 文件.  当 JSON 包含 `plugins` 数组字段时, SHALL 按 marketplace 格式解析 (与 `marketplace.json` 相同规则); 否则 SHALL 按简单格式解析顶层 `skills` 字段.  两种格式的结果 SHALL 合并去重.

#### Scenario: plugin.json 为 marketplace 格式

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容包含 `metadata.pluginRoot: "./.github/plugins"` 和 `plugins` 数组 (3 个 plugin, 每个 plugin 下有 `skills` 子目录)
- **THEN** 系统 SHALL 返回 3 个 skill 搜索路径, 每个对应一个 plugin 的 skills 目录, 加上各 plugin 目录下的 conventional `skills/` 路径 (去重后)

#### Scenario: plugin.json 为简单格式

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容包含 `skills: "./skills/"`, 不包含 `plugins` 字段
- **THEN** 系统 SHALL 返回包含 `basePath/skills/` 的搜索路径数组 (行为不变)

#### Scenario: plugin.json 同时有 plugins 数组和顶层 skills

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容同时包含顶层 `skills: "./skills/"` 和 `plugins` 数组
- **THEN** 系统 SHALL 返回两种格式解析结果的合并去重集合

#### Scenario: plugin.json 不存在

- **WHEN** 仓库根目录不存在 `.claude-plugin/plugin.json`
- **THEN** 系统 SHALL 返回空数组, 不抛出错误

### Requirement: 路径安全校验

系统 SHALL 校验 manifest 中声明的所有路径, 拒绝可能导致路径穿越的值.

校验规则:
- `pluginRoot`, `plugin.source`, `plugin.skills` 中的相对路径 MUST 以 `./` 开头
- 路径 MUST NOT 包含 `..` 片段
- 解析后的绝对路径 MUST 位于 `basePath` 目录内

#### Scenario: 路径包含 .. 片段

- **WHEN** manifest 中 plugin.source 值为 `"../../etc"`
- **THEN** 系统 SHALL 跳过该 plugin, 不将其路径加入搜索列表

#### Scenario: 路径不以 ./ 开头

- **WHEN** manifest 中 plugin.source 值为 `"/absolute/path"`
- **THEN** 系统 SHALL 跳过该 plugin

### Requirement: 集成到 Git clone 安装流程

系统 SHALL 在 Git clone 安装流程的 skill 发现阶段, 扫描以下标准目录 (除了 plugin manifest 发现和根目录 SKILL.md 检查):

- `skills/`
- `skills/.curated/`
- `skills/.experimental/`
- `skills/.system/`
- `.agents/skills/`
- `.claude/skills/`

所有来源的结果 SHALL 按 name 合并去重.

#### Scenario: 仓库有 .agents/skills 目录

- **WHEN** 仓库包含 `.agents/skills/my-skill/SKILL.md`
- **THEN** 系统 SHALL 发现并返回 `my-skill`

#### Scenario: 仓库同时有 manifest 和多个标准目录

- **WHEN** 仓库包含 `.claude-plugin/plugin.json` 声明了 plugin skills, 同时 `.agents/skills/` 和 `skills/` 下也有独立 skills
- **THEN** 系统 SHALL 返回所有来源的 skills, 按 name 去重

#### Scenario: 仓库无 manifest 且标准目录为空

- **WHEN** 仓库不包含任何 plugin manifest 文件, 标准目录均不存在或为空
- **THEN** 系统 SHALL 检查根目录 SKILL.md 作为最终 fallback

### Requirement: 跳过远程 source 声明

系统 SHALL 跳过 manifest 中 `source` 为对象类型(包含 `repo` 字段的远程引用)的 plugin 条目, 仅处理字符串类型的本地相对路径.

#### Scenario: plugin source 为远程对象

- **WHEN** marketplace.json 中某 plugin 的 source 为 `{"source": "some-repo", "repo": "https://github.com/..."}`
- **THEN** 系统 SHALL 跳过该 plugin, 不尝试解析其 skills 路径

### Requirement: 标准���录列表

安��时, 系统 SHALL 在以下标准目录中扫描 skill: `skills/`, `skills/.curated/`, `skills/.experimental/`, `skills/.system/`, `.agents/skills/`, `.claude/skills/`. 这些路径由 `STANDARD_SKILL_PATHS` 常量定义.

#### Scenario: 发现 .claude/skills 下的 skill

- **WHEN** 安装仓库, 仓库的 `.claude/skills/` 目录下有 skill 子目录
- **THEN** 系统 SHALL 发现并列出这些 skills

