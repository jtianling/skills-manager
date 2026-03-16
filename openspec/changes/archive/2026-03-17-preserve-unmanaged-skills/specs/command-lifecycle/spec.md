## MODIFIED Requirements

### Requirement: init 中的 Command 增量部署

通过 `init` 命令部署 command 到项目:

**增量逻辑**:
1. 筛选出支持 commands 的工具 (`toolConfig.commandsDir` 不为 undefined)
2. 只有存在可用 command **且** 有支持 commands 的工具被选中时, 才显示 command 选择提示
3. 增量部署分四类处理:
   - `toRemove`: 之前部署过, 不在新选择中, 且 `source !== 'unknown'` 的 → `deployer.removeCommand()`
   - `toKeep`: 之前部署过且仍在新选择中的 → 不做任何操作
   - `toAdd`: 新选择中新增的 → `deployer.deployCommand()`
   - `unmanaged`: `source === 'unknown'` 的 → 不做任何操作, 输出 `~ /name (unmanaged)` 标记
4. 未托管 command 不参与 toRemove 计算, 始终被保留

#### Scenario: init 遇到未托管 command 时保留
- **WHEN** 目标目录存在 `source === 'unknown'` 的 command (用户手动创建, 不在 skills-manager 注册表中)
- **THEN** 该 command 不被删除, 输出 `~ /command-name (unmanaged)`, 其他增量逻辑正常运行

#### Scenario: init 仅移除被管理的取消选中 command
- **WHEN** 目标目录有 `source !== 'unknown'` 的已部署 command, 且用户在 init 中未选中它
- **THEN** 该 command 被移除, 输出 `✗ /command-name (removed)`

#### Scenario: init 混合场景 — 管理和未托管 command 共存
- **WHEN** 目标目录同时有被管理的 command 和未托管的 command
- **THEN** 被管理的 command 按正常 toRemove/toKeep/toAdd 逻辑处理, 未托管的 command 保持不变并输出 unmanaged 标记

### Requirement: 同步验证

`sync` 命令检查已部署 command 的状态:

**检查逻辑** (对每个已部署的 command):

1. **未托管检测**: `command.source === 'unknown'` 时, 输出 `~ /name (unmanaged)` 并跳过后续检查
2. **查找源**: 调用 `commandsService.getCommandByName()`
3. **孤立检测**: 源不存在时提示移除或保留
4. 后续 symlink/copy 检查逻辑不变

#### Scenario: sync 遇到未托管 command
- **WHEN** 已部署 command 的 source 为 "unknown"
- **THEN** 输出 `~ /command-name (unmanaged)`, 不提示任何操作

#### Scenario: sync 区分未托管和孤立
- **WHEN** command 的 source 不为 "unknown" 但源文件已不存在
- **THEN** 仍然显示 "orphaned" 并提示用户操作 (保持现有行为)
