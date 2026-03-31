## ADDED Requirements

### Requirement: 来源 suffix 标注
虚拟 group 中的非 custom skill SHALL 在 suffix 中显示来源信息, 格式为 `(owner/repo)`.

#### Scenario: official skill 显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `official/anthropic/skills/commit`
- **THEN** 该 skill 的 suffix 包含 `(anthropic/skills)`

#### Scenario: community skill 显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `community/bob/cool-tools/linter`
- **THEN** 该 skill 的 suffix 包含 `(bob/cool-tools)`

#### Scenario: custom skill 不显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `custom/my-linter`
- **THEN** 该 skill 不附加来源 suffix

#### Scenario: 来源 suffix 与功能 suffix 共存
- **WHEN** 虚拟 group 中的 official skill `commit` 同时通过 `getSuffix` 返回 `[deployed]`
- **THEN** 该 skill 的 suffix 为 `(anthropic/skills) [deployed]` (来源在前, 功能在后)

### Requirement: buildSourceGroupedChoices 虚拟 group 跨 source 支持
`buildSourceGroupedChoices` SHALL 将属于虚拟 group 的非 custom skill 从其 source 分类移入 custom 分类的虚拟 group 下显示, 带来源 suffix.

#### Scenario: official skill 移入虚拟 group
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`, 同时 `official/anthropic/skills/review` 不属于任何 group
- **THEN** `commit` 出现在 custom 分类的 `my-tools` 虚拟 group 下, 带 suffix `(anthropic/skills)`.  `review` 仍在 official 分类的 `anthropic/skills` sub-group 下

#### Scenario: 非 custom skill 不在 source 分类重复出现
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`
- **THEN** `commit` 不出现在 official 分类的 `anthropic/skills` sub-group 下

#### Scenario: source 分类下 sub-group 清空时隐藏
- **WHEN** `anthropic/skills` 下所有 skill 都属于虚拟 group
- **THEN** official 分类下不再显示 `anthropic/skills` sub-group

#### Scenario: 无虚拟 group 时行为不变
- **WHEN** `groupsData` 为空
- **THEN** 所有 skill 按 source 分类显示, 行为与当前一致

### Requirement: group list 来源显示
`group list <name>` SHALL 以友好格式显示 skill 列表, 非 custom skill 标注来源.

#### Scenario: 混合来源的 group 列表
- **WHEN** group `my-tools` 包含 `official/anthropic/skills/commit`, `custom/my-linter`, `community/bob/tools/debugger`
- **THEN** 输出:
  ```
  my-tools:
    commit        (anthropic/skills)
    my-linter
    debugger      (bob/tools)
  ```

#### Scenario: 纯 custom skill 的 group 列表
- **WHEN** group `local` 只包含 `custom/tool-a`, `custom/tool-b`
- **THEN** 输出无来源标注:
  ```
  local:
    tool-a
    tool-b
  ```
