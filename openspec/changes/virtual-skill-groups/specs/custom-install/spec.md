## REMOVED Requirements

### Requirement: Install local skill to custom directory
**Reason**: `custom-install` (`ci`) 子命令整体移除, 本地安装统一通过 `install` 命令 (已支持本地路径 `./path`).
**Migration**: 使用 `skillsmgr install ./my-skill` 替代 `skillsmgr ci my-skill`.

### Requirement: Overwrite confirmation for existing skill
**Reason**: 随 `custom-install` 命令一起移除. `install` 命令已有自己的覆盖确认逻辑.
**Migration**: `install` 命令自身处理覆盖确认.

### Requirement: Force flag skips confirmation
**Reason**: 随 `custom-install` 命令一起移除.
**Migration**: `install -f` 已支持.

### Requirement: Setup prerequisite check
**Reason**: 随 `custom-install` 命令一起移除.
**Migration**: `install` 命令自身检查.

## MODIFIED Requirements

### Requirement: install --group 自动入组
`install` 命令 SHALL 接受 `--group <name>` 选项.  安装完成后, 系统 SHALL 自动将已安装 skill 的 source key 添加到指定虚拟 group 中.  group 不存在时自动创建.  安装目标路径不受 `--group` 影响 (始终按来源类型决定路径).

#### Scenario: install 本地 skill 并入组
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** skill 安装到 `custom/my-linter/` (不受 group 影响)
- **AND** `custom/my-linter` 被添加到 groups.json 的 python group

#### Scenario: install 远程 skill 并入组
- **WHEN** 用户执行 `skillsmgr install anthropic --group python`
- **THEN** skill 安装到 `official/anthropic/skills/` 下
- **AND** 每个安装的 skill key 被添加到 python group

#### Scenario: --group 指定的 group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group new-group`, 且 new-group 不存在
- **THEN** 安装 skill, 自动创建 new-group, 并添加 skill 到该 group
