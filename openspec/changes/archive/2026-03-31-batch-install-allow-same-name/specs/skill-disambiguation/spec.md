## ADDED Requirements

### Requirement: bare name 消歧义
当用户使用 bare name 引用 skill 且存在多个同名 skill 时, 系统 SHALL 列出所有匹配的完整 source key, 让用户交互选择.

#### Scenario: bare name 唯一匹配
- **WHEN** 用户执行包含 skill 引用的命令, 传入 bare name `jt-release`
- **AND** 只有一个已安装 skill 名为 `jt-release`
- **THEN** 系统 SHALL 直接使用该 skill, 不弹出选择

#### Scenario: bare name 匹配多个
- **WHEN** 用户执行包含 skill 引用的命令, 传入 bare name `jt-codex`
- **AND** 存在 `custom/jt-codex` 和 `custom/develop/jt-codex` 两个同名 skill
- **THEN** 系统 SHALL 列出完整 key 让用户选择:
  ```
  Multiple skills found for 'jt-codex':
    1. custom/jt-codex
    2. custom/develop/jt-codex
  Which one?
  ```

#### Scenario: bare name 无匹配
- **WHEN** 用户传入 bare name `unknown-skill`
- **AND** 无任何已安装 skill 名为 `unknown-skill`
- **THEN** 系统 SHALL 报错, 行为与当前一致

### Requirement: 完整 key 精确匹配
当用户传入完整 source key 时, 系统 SHALL 精确匹配, 跳过消歧义.

#### Scenario: 完整 key 直接使用
- **WHEN** 用户传入 `custom/develop/jt-codex` 作为 skill 引用
- **THEN** 系统 SHALL 精确匹配该 key 对应的 skill, 不弹出选择

#### Scenario: 完整 key 不存在
- **WHEN** 用户传入 `custom/nonexistent/jt-codex` 作为 skill 引用
- **AND** 该 key 不对应任何已安装 skill
- **THEN** 系统 SHALL 报错 skill not found

### Requirement: 消歧义工具函数
系统 SHALL 提供 `resolveSkillByName(name, allSkills)` 工具函数, 封装消歧义逻辑, 供 uninstall, add 等命令统一调用.

#### Scenario: 各命令复用消歧义
- **WHEN** `uninstall`, `add`, `group add`, `group remove` 等命令接收 skill name 参数
- **THEN** 各命令 SHALL 通过 `resolveSkillByName` 解析 skill 引用, 不各自实现查找逻辑
