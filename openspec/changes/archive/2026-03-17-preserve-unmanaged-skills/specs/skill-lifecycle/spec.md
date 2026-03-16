## MODIFIED Requirements

### Requirement: 增量部署

将 skill 从 `~/.skills-manager/` 部署到项目的工具目录.

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
6. Commands 也实现了完全相同的增量逻辑, 参见 command-lifecycle spec

#### Scenario: init 遇到未托管 skill 时保留
- **WHEN** 目标目录存在 `source === 'unknown'` 的 skill (用户手动创建, 不在 skills-manager 注册表中)
- **THEN** 该 skill 不被删除, 输出 `~ skill-name (unmanaged)`, 其他 toRemove/toKeep/toAdd 逻辑正常运行

#### Scenario: init 仅移除被管理的取消选中 skill
- **WHEN** 目标目录有 `source !== 'unknown'` 的已部署 skill, 且用户在 init 中未选中它
- **THEN** 该 skill 被移除, 输出 `✗ skill-name (removed)`

#### Scenario: init 混合场景 — 管理和未托管 skill 共存
- **WHEN** 目标目录同时有被管理的 skill (source 为 "official/anthropic") 和未托管的 skill (source 为 "unknown")
- **THEN** 被管理的 skill 按正常 toRemove/toKeep/toAdd 逻辑处理, 未托管的 skill 保持不变并输出 unmanaged 标记

### Requirement: 同步验证

`sync` 命令检查已部署 skill 的状态:

**检查逻辑** (对每个已部署的 skill):

1. **未托管检测**: `skill.source === 'unknown'` 且 `skill.conflict !== true` 时, 输出 `~ name (unmanaged)` 并跳过后续检查
2. **冲突检测**: `skill.conflict === true` 时, 输出 "⚠ name: conflict (skipped)" 并跳过
3. **查找源路径**: 如果 `skill.source !== 'unknown'`, 通过 `skillsService.getSkillByName()` 查找
4. **孤立检测**: 源路径不存在或 `fileExists(sourcePath)` 返回 false:
   - 输出 "✗ name: orphaned (source not found)"
   - 提示用户选择: 移除或保留
5. **Symlink 检测**: `isSymlink(deployedPath)` 返回 true:
   - 输出 "✓ name: up to date (link)"
6. **Copy 内容对比**: 仅对比 `SKILL.md` 文件, 逻辑不变

#### Scenario: sync 遇到未托管 skill
- **WHEN** 已部署 skill 的 source 为 "unknown" 且无冲突
- **THEN** 输出 `~ skill-name (unmanaged)`, 不提示任何操作, 不检查源文件

#### Scenario: sync 区分未托管和孤立
- **WHEN** skill 的 source 不为 "unknown" 但源文件已不存在
- **THEN** 仍然显示 "orphaned" 并提示用户操作 (保持现有行为)
