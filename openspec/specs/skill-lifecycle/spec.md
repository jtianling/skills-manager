# Skill Lifecycle

Skills 是 AI 编程工具理解项目上下文和行为规范的 markdown 文件集合.  每个 skill 是一个包含 `SKILL.md` 的目录.

## 数据模型

### SkillInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | skill 名称, 从 SKILL.md frontmatter 或目录名获取 |
| description | string | 描述, 从 SKILL.md frontmatter 的 description 字段获取 |
| path | string | 本地文件系统中的完整路径 |
| source | string | 来源标识, 如 "official/anthropic", "community/repo", "custom" |

### DeployedSkill

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | skill 名称 |
| source | string | 来源标识 |
| deployMode | "link" \| "copy" | 部署方式 |

### ScannedSkill

继承 DeployedSkill, 额外包含:

| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | 部署位置的完整路径 |
| conflict | boolean? | 多个 source 存在同名 skill 时为 true |

## Skill 存储结构

所有 skill 集中存储在 `~/.skills-manager/`:

```
~/.skills-manager/
├── official/           # 官方 skill (如 anthropic/skills)
│   └── anthropic/
│       ├── code-review/
│       │   └── SKILL.md
│       └── tdd/
│           └── SKILL.md
├── community/          # 社区 skill (任意 GitHub 仓库)
│   └── awesome-skills/
│       └── react-patterns/
│           └── SKILL.md
└── custom/             # 本地自定义 skill
    └── my-skill/
        └── SKILL.md
```

### 目录层级差异

- **custom**: skill 直接位于 `custom/{skill-name}/` 下, 扫描时只有一层
- **official/community**: 有额外的仓库层:
  - 先遍历 `{source}/{repo}/` 目录
  - 如果 `{source}/{repo}/skills/` 目录存在, 则在其下查找 skill
  - 否则在 `{source}/{repo}/` 下直接查找 skill
  - 这意味着如果仓库根目录有 `skills/` 子目录 (如 anthropic/skills 仓库的结构), 会自动深入一层

### 边界情况

- 一个目录如果不包含 `SKILL.md` 文件, 则不被视为 skill, 直接跳过
- 对于 official/community, `getDirectoriesInDir` 返回的结果按名称字母序排列
- `skills/` 子目录检测仅检查第一层, 不递归

## SKILL.md 格式

```markdown
---
name: skill-name
description: What this skill does
---

Skill content here...
```

### Frontmatter 解析规则

- frontmatter 必须以 `---\n` 开头, 以 `\n---` 结尾
- 使用正则 `/^---\n([\s\S]*?)\n---/` 匹配
- `name` 字段: 通过 `/^name:\s*(.+)$/m` 匹配, 提取后 `.trim()`
- `description` 字段: 通过 `/^description:\s*(.+)$/m` 匹配, 提取后 `.trim()`
- 如果没有 frontmatter (不匹配 `---` 格式), name 和 description 都返回空字符串
- name 为空时, fallback 为目录名 (`skillPath.split('/').pop()`)
- description 为空时, 保持空字符串

### 支持的 Skill 目录内容

skill 目录中除了 `SKILL.md` 外, 还可包含任意文件和子目录 (如 resources/, scripts/ 等).  部署时整个目录被链接或复制.

## 生命周期操作

### 1. 发现与加载

`SkillsService` 扫描 `~/.skills-manager/` 下的三个来源目录.

**扫描顺序**: 固定为 `['official', 'community', 'custom']`, 由 `SKILL_SOURCES` 常量定义.

**扫描逻辑**:

对于 custom 来源:
1. 扫描 `~/.skills-manager/custom/` 下的所有子目录
2. 每个子目录如果包含 `SKILL.md`, 视为一个 skill
3. source 字段设为 `"custom"`

对于 official/community 来源:
1. 扫描 `~/.skills-manager/{source}/` 下的所有子目录 (仓库目录)
2. 对每个仓库目录, 检查是否存在 `skills/` 子目录
3. 如果存在, 在 `skills/` 下扫描 skill; 否则直接在仓库目录下扫描
4. source 字段设为 `"{source}/{repo-dir-name}"`

**方法**:
- `getAllSkills()`: 遍历所有来源, 返回全部 skill 数组. 每次调用都重新扫描文件系统 (无缓存).
- `getSkillsBySource(source)`: 仅扫描指定来源
- `getSkillByName(name)`: 调用 `getAllSkills()` 后 `.find()`, 返回第一个匹配. 如果有多个同名 skill, 按扫描顺序返回第一个 (official 优先于 community 优先于 custom)
- `findSkillsByName(name)`: 调用 `getAllSkills()` 后 `.filter()`, 返回所有同名 skill
- `getSkillsByNames(names)`: 批量 `.find()`, 对每个 name 返回第一个匹配, 过滤掉 undefined

### 2. 部署

将 skill 从 `~/.skills-manager/` 部署到项目的工具目录.

**部署方式**:
- **link** (默认): 对整个 skill 目录创建符号链接 (`symlinkSync(src, dest)`). 如果目标已存在, 先 `unlinkSync` 再创建.
- **copy**: 递归复制整个 skill 目录 (`copyDir`). 逐文件复制, 遇到子目录时递归处理.

**部署流程** (通过 `Deployer.deploySkill()`):
1. 计算目标目录: `{project}/{getTargetDir(toolConfig, mode)}/`
2. 确保目标目录存在 (`ensureDir`, 使用 `mkdirSync({ recursive: true })`)
3. 计算 skill 目标路径: `{目标目录}/{skill.name}/`
4. 根据 deployMode 执行 link 或 copy

**增量部署** (通过 `init` 命令):
1. 扫描所有已选工具的已部署 skill, 将名称收集到 Set 中
2. 用户选择 skill 时, 已部署的默认选中
3. 部署时对每个工具分四类处理:
   - `toRemove`: 之前部署过, 不在新选择中, 且 `source !== 'unknown'` 的 → `deployer.removeSkill()`
   - `toKeep`: 之前部署过且仍在新选择中的 → 不做任何操作
   - `toAdd`: 新选择中新增的 → `deployer.deploySkill()`
   - `unmanaged`: `source === 'unknown'` 的 → 不做任何操作, 输出 `~ name (unmanaged)` 标记
4. 注意: `toKeep` 不会重新部署, 即使 deployMode 从 link 变为 copy 也不会更新
5. 未托管 skill 不参与 toRemove 计算, 始终被保留

#### Scenario: init no longer prompts for commands
- **WHEN** 用户执行 `init` 命令
- **THEN** 只显示工具选择和 skill 选择, 不显示 command 选择提示

#### Scenario: init deploys only skills
- **WHEN** 用户在 init 中选择了 skills 和工具
- **THEN** 只有 skill 被部署到工具目录, 不部署 command

#### Scenario: init 遇到未托管 skill 时保留
- **WHEN** 目标目录存在 `source === 'unknown'` 的 skill (用户手动创建, 不在 skills-manager 注册表中)
- **THEN** 该 skill 不被删除, 输出 `~ skill-name (unmanaged)`, 其他 toRemove/toKeep/toAdd 逻辑正常运行

#### Scenario: init 仅移除被管理的取消选中 skill
- **WHEN** 目标目录有 `source !== 'unknown'` 的已部署 skill, 且用户在 init 中未选中它
- **THEN** 该 skill 被移除, 输出 `✗ skill-name (removed)`

#### Scenario: init 混合场景 — 管理和未托管 skill 共存
- **WHEN** 目标目录同时有被管理的 skill (source 为 "official/anthropic") 和未托管的 skill (source 为 "unknown")
- **THEN** 被管理的 skill 按正常 toRemove/toKeep/toAdd 逻辑处理, 未托管的 skill 保持不变并输出 unmanaged 标记

### 3. 移除

**通过 `remove` 命令**:
1. 确定目标工具: 指定 `--tool` 时仅处理该工具, 否则处理所有已配置工具
2. 对每个目标工具, 扫描其所有部署 (包括基础目录和 mode-specific 目录)
3. 在 skills 中查找同名项, 找到则通过 `deployer.removeSkill()` 删除 (内部使用 `rmSync(path, { recursive: true, force: true })`)
4. 如果任何工具中都没找到, 输出 "'name' not found in any configured tool"

#### Scenario: remove only checks skills
- **WHEN** 用户执行 `remove <name>`
- **THEN** 只在已部署 skills 中查找匹配项, 不检查 commands 目录

#### Scenario: remove name not found
- **WHEN** name 不匹配任何已部署 skill
- **THEN** 输出 "'name' not found in deployed skills"

### Requirement: remove 命令从必填参数改为可选

remove 命令的 positional arg SHALL 从 `<name>` (必填) 改为 `[name]` (可选). 支持通过 `-s/--skill` 指定多个 skill, 也支持 `-a/--agent` 指定目标 agent.

#### Scenario: remove 使用 positional arg (向后兼容)
- **WHEN** 用户执行 `remove my-skill`
- **THEN** 移除 `my-skill`, 行为不变

#### Scenario: remove 使用 --skill 批量移除
- **WHEN** 用户执行 `remove -s skill1 -s skill2`
- **THEN** 移除 `skill1` 和 `skill2`

#### Scenario: remove 混合使用 positional 和 --skill
- **WHEN** 用户执行 `remove my-skill -s other-skill`
- **THEN** 移除 `my-skill` 和 `other-skill`

#### Scenario: remove 指定 --agent
- **WHEN** 用户执行 `remove my-skill -a claude-code`
- **THEN** 仅从 claude-code 移除 `my-skill`

#### Scenario: remove 无任何参数
- **WHEN** 用户执行 `remove` (无 positional arg, 无 --skill)
- **THEN** 输出错误提示并 exit(1)

#### Scenario: remove name not found
- **WHEN** name 不匹配任何已部署 skill
- **THEN** 输出 "'name' not found in deployed skills"

### Requirement: remove 支持 owner/repo 格式批量移除

`remove` 命令 SHALL 支持 `owner/repo` 格式参数, 检测到该格式时通过中央仓库查找该 source 下的所有 skills, 过滤出已部署到当前项目的, 批量移除.

格式检测规则: 参数含 `/` 且不含 `://` 时视为 `owner/repo` 格式.

匹配逻辑:
1. 通过 `findRepoInCentralRepository(ownerRepo)` 在中央仓库查找匹配的 skills
2. 获取当前项目已部署的 skills
3. 交叉匹配: 只移除既在中央仓库该 source 下、又在项目已部署中的 skills
4. 逐个移除并输出 `✓ Removed <name>`

#### Scenario: owner/repo 格式移除已部署的 skills
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills`
- **AND** 中央仓库 `community/mattpocock/skills` 下有 skill-a, skill-b, skill-c
- **AND** 项目中已部署 skill-a 和 skill-b
- **THEN** 移除 skill-a 和 skill-b 的部署
- **AND** 输出 `✓ Removed skill-a` 和 `✓ Removed skill-b`
- **AND** skill-c 不受影响 (未部署)

#### Scenario: owner/repo 格式匹配 official provider
- **WHEN** 用户执行 `skillsmgr remove anthropics/skills`
- **AND** 中央仓库 `official/anthropic/skills` 下有 commit, code-review
- **AND** 项目中已部署 commit
- **THEN** 移除 commit 的部署

#### Scenario: owner/repo 无已部署 skill
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills`
- **AND** 中央仓库存在该 source 但项目中没有部署任何对应 skill
- **THEN** 输出 "No deployed skills found from 'mattpocock/skills'"
- **AND** 以退出码 1 退出

#### Scenario: owner/repo 在中央仓库中不存在
- **WHEN** 用户执行 `skillsmgr remove unknown/repo`
- **AND** 中央仓库中不存在匹配的 source
- **THEN** 输出 "'unknown/repo' not found in central repository"
- **AND** 以退出码 1 退出

#### Scenario: owner/repo 不影响其他 source 的同名 skill
- **WHEN** 项目中部署了来自 `community/mattpocock/skills` 的 skill-a 和来自 `official/anthropic/skills` 的 skill-a (同名)
- **AND** 用户执行 `skillsmgr remove mattpocock/skills`
- **THEN** 只移除来自 `community/mattpocock/skills` 的 skill-a
- **AND** 来自 `official/anthropic/skills` 的 skill-a 保持不变

#### Scenario: owner/repo 与 --global 模式组合
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills -g`
- **THEN** 在全局 agent 目录中查找并移除该 source 下的 skills

#### Scenario: 纯 skill name 行为不变
- **WHEN** 用户执行 `skillsmgr remove commit`
- **THEN** 行为与现有逻辑完全一致, 按名称精确匹配已部署 skill

**通过 `init` 命令的增量逻辑**:
- 取消选择的 skill 会被移除, 使用 `deployer.removeSkill()` 处理

### 4. 更新

`update` 命令从远程拉取最新版本 (详细流程参见 source-management spec):
- 仅更新本地已安装的 skill, 不安装新 skill
- 跳过名为 `commands` 的目录 (避免将残留 commands 子目录误识别为 skill)
- 比较本地和远程的 SKILL.md 内容 (全文对比, 不截断)
- 内容不同时, 先 `removeDir()` 删除整个本地 skill 目录, 再重新下载

#### Scenario: update only updates skills
- **WHEN** 用户执行 `update` 命令
- **THEN** 只比较和更新本地已安装的 skill, 不处理 commands

#### Scenario: update skips residual commands directory
- **WHEN** `~/.skills-manager/official/anthropic/` 下存在残留的 `commands/` 目录
- **THEN** 该目录被跳过, 不报错

### 5. 安装时预选已安装 skill

`install` 命令进入交互式选择时, 系统 SHALL 检测目标安装目录中已存在的 skill, 在 checkbox 列表中将其预选 (`checked: true`) 并显示 `(installed)` 后缀.

**检测逻辑**:
1. 在显示选择列表前, 计算目标安装路径 (`computeRepoTargetBase`)
2. 扫描目标路径下的子目录, 过滤出包含 `SKILL.md` 的目录
3. 将目录名收集为 `installedNames` Set
4. 传递给 `promptSkillsToInstall(skills, installedNames)`

**UI 表现**:
- 已安装 skill: 显示为 `◉ skill-name (installed)` (预选中, 黄色 suffix)
- 未安装 skill: 显示为 `◯ skill-name` (未选中)

**不影响的场景**:
- `--all` 选项: 不触发交互式选择, 不涉及预选
- `--skill` 选项: 直接过滤, 不触发交互式选择
- `uninstall` 命令: 默认全部不勾选, 不使用预选

#### Scenario: 全部 skill 已安装时跳过交互式选择

- **WHEN** 用户执行 `install owner/repo` (无 `--all`), 仓库中所有 skill 均已安装
- **THEN** 系统 SHALL 输出 "All N skills already installed.", 不显示交互式选择列表, 直接返回

#### Scenario: 部分 skill 已安装时的交互式选择

- **WHEN** 用户执行 `install owner/repo` (无 `--all`), 仓库有 skill-a, skill-b, skill-c, 其中 skill-a 已安装
- **THEN** 选择列表中 skill-a 显示为 `◉ skill-a (installed)`, skill-b 和 skill-c 显示为 `◯`

#### Scenario: 首次安装时无预选

- **WHEN** 用户首次执行 `install owner/repo` (无 `--all`), 目标目录不存在
- **THEN** 所有 skill 显示为 `◯`, 无预选

## 冲突处理

当多个 source 包含同名 skill 时:

**检测时机**:
- `DeploymentScanner.scanCopiedSkill()`: 调用 `findSourceByName()`, 如果 `findSkillsByName()` 返回多于 1 个结果, 设置 `conflict: true`, `source: null`
- 注意: link 模式不会触发冲突, 因为 symlink target 路径可以精确定位 source

**影响**:
- `add` 命令: 遇到多个匹配时, 提示用户通过编号选择具体的 source
- `list --deployed`: 显示 "⚠ name (copy) ← conflict"
- `init` 命令: 不受影响, 因为 skill 选择是基于 name 而非 source

### Requirement: Root-level SKILL.md recognition

当仓库根目录存在 SKILL.md 且仓库内不存在子目录形式的 skill 时, 系统 SHALL 将整个仓库视为单个 skill.  安装后的存储结构 SHALL 为 `~/.skills-manager/{source}/{repo}/{skill-name}/SKILL.md`, 其中 `skill-name` 优先取 SKILL.md frontmatter 中的 `name` 字段, 无 name 时 fallback 为仓库名.

#### Scenario: Root SKILL.md repo installed via git clone
- **WHEN** 用户执行 `install https://github.com/owner/repo` 且仓库内无子目录 skill, 但根目录存在 SKILL.md (frontmatter name 为 "deep-research")
- **THEN** 克隆完成后, 系统将仓库视为单 skill, 安装到 `~/.skills-manager/community/owner/repo/deep-research/`

#### Scenario: Root SKILL.md without name in frontmatter
- **WHEN** 根目录 SKILL.md 的 frontmatter 中没有 name 字段
- **THEN** skill name 使用仓库名作为 fallback

#### Scenario: Root SKILL.md with --custom option
- **WHEN** 用户使用 `--custom` 选项安装根目录 skill 仓库
- **THEN** 系统将 skill 存储到 `~/.skills-manager/custom/repo/{skill-name}/`

#### Scenario: Repo has both subdirectory skills and root SKILL.md
- **WHEN** 仓库同时包含子目录形式的 skill (如 `skills/code-review/SKILL.md`) 和根目录 SKILL.md
- **THEN** 系统 SHALL 优先识别子目录 skill, 忽略根目录 SKILL.md (现有行为不变)

### Requirement: Single-skill repo skips selection prompt

根目录 skill 仓库只有一个 skill, 系统 SHALL 直接安装, 不提示用户选择.

#### Scenario: Root skill repo does not prompt selection
- **WHEN** 用户安装根目录 skill 仓库且未使用 `--all` 选项
- **THEN** 系统直接安装该 skill, 不显示选择提示 (因为只有一个 skill)

## 操作精确性

所有生命周期操作 SHALL 精确作用于目标 skill, 不得对非目标 skill 产生副作用.

### Requirement: install 仅安装指定 skill

使用 `--skill` 过滤时, 仅目标 skill 被安装到中央仓库, 其他 skill 不受影响.

#### Scenario: install -s 不安装其他 skill
- **WHEN** 仓库包含 skill-a, skill-b, skill-c
- **AND** 用户执行 `skillsmgr install owner/repo -s skill-a`
- **THEN** 仅 skill-a 被安装到中央仓库
- **AND** skill-b, skill-c 不存在于中央仓库

### Requirement: add 仅部署指定 skill

`add` 操作仅在目标位置创建指定 skill 的部署, 不额外部署其他 skill.

#### Scenario: add -s 不部署其他 skill
- **WHEN** 中央仓库包含 skill-a, skill-b, skill-c
- **AND** 用户执行 `skillsmgr add owner/repo -s skill-a -a claude-code`
- **THEN** 仅 skill-a 被部署到项目
- **AND** 项目中不存在 skill-b, skill-c 的部署

### Requirement: remove 仅移除指定 skill

`remove` 操作仅删除指定 skill 的部署, 其他已部署 skill 不受影响.

#### Scenario: remove 不影响其他已部署 skill
- **WHEN** 项目中已部署 skill-a 和 skill-b
- **AND** 用户执行 `skillsmgr remove skill-a`
- **THEN** skill-a 的部署被移除
- **AND** skill-b 的部署保持不变

### Requirement: uninstall 仅卸载指定 skill

`uninstall` 操作仅删除指定 skill, 同仓库的其他 skill 不受影响.

#### Scenario: uninstall 不影响同仓库其他 skill
- **WHEN** 中央仓库中 official/openai/skills/ 下有 skill-a 和 skill-b
- **AND** 用户执行 `skillsmgr uninstall skill-a -f`
- **THEN** skill-a 被从中央仓库删除
- **AND** skill-b 保持不变

### Requirement: uninstall -y 作为 --all --force 的快捷方式

`uninstall` 命令 SHALL 支持 `-y` flag, 语义等同于 `--all --force`.  传入 `-y` 时跳过选择提示和确认提示, 直接卸载所有匹配 skills.

#### Scenario: uninstall owner/repo -y 卸载所有关联 skills
- **WHEN** 中央仓库中 official/anthropic/skills/ 下有 skill-a, skill-b, skill-c
- **AND** 用户执行 `skillsmgr uninstall anthropics/skills -y`
- **THEN** skill-a, skill-b, skill-c 全部被删除
- **AND** 输出包含 "Uninstalled 3 skills from anthropics/skills"
- **AND** 不出现任何交互式提示

#### Scenario: uninstall owner/repo -y 不影响其他来源的 skills
- **WHEN** 中央仓库中有 official/anthropic/skills/ 下的 skills 和 custom/my-skill
- **AND** 用户执行 `skillsmgr uninstall anthropics/skills -y`
- **THEN** official/anthropic/skills/ 下的 skills 全部被删除
- **AND** custom/my-skill 保持不变

#### Scenario: uninstall skill-name -y 跳过确认
- **WHEN** 中央仓库中有名为 "pdf" 的 skill
- **AND** 用户执行 `skillsmgr uninstall pdf -y`
- **THEN** pdf skill 被删除
- **AND** 不出现确认提示

#### Scenario: -y 与 --all 和 -f 可自由组合
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills -y --all -f`
- **THEN** 行为与单独使用 `-y` 完全相同, 不报错

## 前置条件

- 大部分 skill 操作 (除 `setup`, `init`, `add`) 检查 `~/.skills-manager/` 目录是否存在, 不存在时 `process.exit(1)` 并提示 "Run: skillsmgr setup"
- `init` 和 `add` 检查 `~/.skills-manager/` 目录是否存在, 不存在时自动执行 `executeSetup()` 完成初始化, 然后继续原命令流程
- `init` 额外要求至少有一个可用 skill, 否则提示 "No skills found. Run: skillsmgr install anthropic"
- `add` 不指定 `--tool` 时, 要求至少有一个已配置工具, 否则提示 "Run: skillsmgr init"

#### Scenario: init precondition check
- **WHEN** 无可用 skill 时执行 `init`
- **THEN** 输出 "No skills found. Run: skillsmgr install anthropic" 并 exit(1)

#### Scenario: add precondition check
- **WHEN** name 不匹配任何 skill 时执行 `add`
- **THEN** 输出 "'name' not found" 并 exit(1)

### Requirement: Skill addition via add

`add` 命令 SHALL 只查找和部署 skill, 不再 fallback 到 command.

#### Scenario: add only searches skills
- **WHEN** 用户执行 `add <name>`
- **THEN** 只在 SkillsService 中查找匹配, 不查找 CommandsService

#### Scenario: add name not found
- **WHEN** name 不匹配任何可用 skill
- **THEN** 输出 "'name' not found" 并 exit(1)

## 测试用例

### SkillsService

#### 发现与加载

- test_getAllSkills_emptyDir_returnsEmpty: `~/.skills-manager/` 各来源目录为空时, 返回空数组
- test_getAllSkills_customSkill_loadsCorrectly: custom 目录下有 `my-skill/SKILL.md`, 返回 SkillInfo 且 source 为 "custom"
- test_getAllSkills_officialSkill_loadsCorrectly: `official/anthropic/code-review/SKILL.md` 存在时, source 为 "official/anthropic"
- test_getAllSkills_officialWithSkillsSubdir_loadsCorrectly: `official/anthropic/skills/code-review/SKILL.md` 结构时 (仓库有 skills/ 子目录), 仍能正确加载
- test_getAllSkills_noSkillMd_skipsDir: 目录存在但没有 SKILL.md 时, 不返回该目录
- test_getAllSkills_multipleSourcesSameName_returnsAll: official 和 community 都有名为 "code-review" 的 skill 时, `getAllSkills()` 返回两个
- test_getAllSkills_sortedByName: 同一来源下的 skill 按名称字母序排列

#### Frontmatter 解析

- test_parseSkillMd_validFrontmatter_parsesNameAndDesc: 标准 frontmatter 返回正确 name 和 description
- test_parseSkillMd_noFrontmatter_returnsEmpty: 没有 `---` 分隔符时, name 和 description 都为空字符串
- test_parseSkillMd_missingName_usesDirectoryName: frontmatter 中没有 name 字段, 使用目录名作为 name
- test_parseSkillMd_missingDescription_returnsEmptyDesc: frontmatter 中没有 description 字段, description 为空字符串
- test_parseSkillMd_extraWhitespace_trimmed: name 和 description 值前后有空格时被 trim

#### 查找

- test_getSkillByName_exists_returnsFirst: 多个同名 skill 时返回第一个 (official 优先)
- test_getSkillByName_notExists_returnsUndefined: 不存在的 name 返回 undefined
- test_findSkillsByName_multipleMatches_returnsAll: 返回所有同名 skill
- test_getSkillsByNames_partialMatch_filtersUndefined: 部分 name 不存在时, 返回数组不含 undefined

### Deployer

#### 部署

- test_deploySkill_linkMode_createsSymlink: link 模式创建符号链接, 指向源 skill 目录
- test_deploySkill_copyMode_copiesFiles: copy 模式复制所有文件, 与源内容一致
- test_deploySkill_linkMode_existingTarget_replacesLink: 目标已存在 symlink 时, 先删除再创建新 link
- test_deploySkill_targetDirNotExist_createsDir: 目标目录不存在时自动创建 (包括中间目录)
- test_deploySkill_withMode_usesCorrectDir: mode="code" 时部署到 mode-specific 目录

#### 移除

- test_removeSkill_exists_deletesRecursively: 已部署 skill 被递归删除
- test_removeSkill_notExists_noError: 目标不存在时不报错 (rmSync with force: true)

### 增量部署 (init)

- test_init_newSkills_deploysAll: 全新项目, 选择 3 个 skill, 全部被部署
- test_init_existingSkills_keepsUnchanged: 已部署的 skill 被选中时不重新部署
- test_init_deselectSkill_removes: 之前部署的 skill 未被选中时被移除
- test_init_mixedOperations_correctOutput: 同时有 add/keep/remove 时输出正确

### 冲突处理

- test_conflict_copiedSkillMultipleSources_detectedAsConflict: copy 模式, 同名 skill 存在于多个 source, 扫描结果 conflict 为 true
- test_conflict_linkedSkill_noConflict: link 模式, 即使多个 source 有同名 skill, 通过 symlink target 精确定位, 不标记冲突
- test_conflict_addSkill_promptsSelection: `add` 遇到多个匹配时提示选择

### DeploymentScanner

- test_scanner_emptyProject_returnsEmpty: 项目中没有任何工具目录时返回空数组
- test_scanner_linkedSkill_detectsModeAndSource: 检测到 symlink, 正确返回 deployMode="link" 和 source
- test_scanner_copiedSkill_detectsMode: 非 symlink 且有 SKILL.md, 返回 deployMode="copy"
- test_scanner_noSkillMd_ignored: 工具目录下的子目录没有 SKILL.md 时不被视为 skill
- test_scanner_modeSpecificDirs_scannedSeparately: Roo Code 的 .roo/skills/ 和 .roo/skills-code/ 分别扫描
- test_scanner_sourceExtraction_officialPath: symlink 指向 `~/.skills-manager/official/anthropic/skill-name`, source 提取为 "official/anthropic"
- test_scanner_sourceExtraction_customPath: symlink 指向 `~/.skills-manager/custom/skill-name`, source 提取为 "custom"
- test_scanner_sourceExtraction_invalidPath: symlink 指向不包含 `.skills-manager/` 的路径, source 为 "unknown"
- test_scanner_getConfiguredTools_returnsToolsWithDeployments: 只返回有部署的工具列表
