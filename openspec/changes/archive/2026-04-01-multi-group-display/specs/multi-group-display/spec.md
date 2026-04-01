# Multi Group Display

交互式 UI 支持 skill 同时出现在多个虚拟 group 和原始 source 分组, 按 skill key 联动 toggle.

## ADDED Requirements

### Requirement: interactiveCheckbox 同 value 联动
`interactiveCheckbox` SHALL 在 toggle 一个 choice 时, 自动同步所有具有相同 `value` 的 choice 的选中状态.

#### Scenario: toggle 一个 skill 联动所有副本
- **WHEN** choices 中有 3 个 choice 的 value 都是 `"openspec-apply-change"`, 用户 toggle 其中一个
- **THEN** 其余 2 个 choice 的选中状态同步变化

#### Scenario: group-header toggle 联动其他 group 中的副本
- **WHEN** group `develop` 的 header 被 toggle, 其中 `openspec-apply-change` 也在 group `openspec` 中
- **THEN** `openspec` group 下的 `openspec-apply-change` 选中状态同步变化

#### Scenario: locked choice 不参与联动
- **WHEN** choice A (value `"commit"`) 在 group `develop` 下是 locked, choice B (同 value) 在 `official` 下不是 locked
- **THEN** toggle choice B 时, choice A 不变 (保持 locked 的原始状态)

#### Scenario: 返回值去重
- **WHEN** 用户选中了 `openspec-apply-change` 的 3 个副本
- **THEN** resolve 的返回数组中 `"openspec-apply-change"` 只出现一次

### Requirement: interactiveCheckbox value 联动基于 value 字段
联动 SHALL 基于 choice 的 `value` 字段匹配, 非 `name` 字段.

#### Scenario: 同名不同 value 不联动
- **WHEN** choice A 的 name 为 `"commit"`, value 为 `"official/anthropic/skills/commit"`, choice B 的 name 为 `"commit"`, value 为 `"community/bob/tools/commit"`
- **THEN** toggle choice A 不影响 choice B

### Requirement: ctrl+a 全选在多副本场景正确去重
`interactiveCheckbox` 的 ctrl+a 全选 SHALL 在多副本场景下正确工作, resolve 时去重.

#### Scenario: ctrl+a 全选后返回值无重复
- **WHEN** choices 中有 5 个唯一 value 和 3 个重复副本 (共 8 个 choice), 用户按 ctrl+a 全选
- **THEN** resolve 的返回数组包含 5 个唯一 value
