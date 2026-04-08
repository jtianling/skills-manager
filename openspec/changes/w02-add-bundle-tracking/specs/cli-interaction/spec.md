# CLI Interaction (delta)

## ADDED Requirements

### Requirement: promptSkillsToInstall 返回 isAll 标志

`promptSkillsToInstall` 交互函数 SHALL 返回 `{ names: string[], isAll: boolean }` 结构 (替换原本的 `string[]` 返回值).  `isAll` 字段 MUST 反映用户是否在交互式选择中选中了所有非 locked 的可选项, 用于 install 命令推断 bundle 的 selectionMode.

#### Scenario: 用户全选所有可选 skill
- **WHEN** 可选 skill 列表有 5 个 (无 locked), 用户全部勾选后回车
- **THEN** 返回 `{ names: [5 个 name], isAll: true }`

#### Scenario: 用户只选部分
- **WHEN** 可选 skill 列表有 5 个, 用户只勾选 2 个
- **THEN** 返回 `{ names: [2 个 name], isAll: false }`

#### Scenario: Locked skill 不计入 isAll 判断
- **WHEN** 列表有 5 个, 其中 2 个 locked (已安装), 用户勾选了剩余 3 个非 locked
- **THEN** 返回 `{ names: [3 个 non-locked name], isAll: true }` (因为所有可选择的都被选了)

#### Scenario: 未选任何 skill
- **WHEN** 用户不勾选任何 skill 直接回车
- **THEN** 返回 `{ names: [], isAll: false }`
