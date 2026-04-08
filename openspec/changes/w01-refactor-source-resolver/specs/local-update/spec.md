# Local Update (delta)

## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`), 委托给 SourceResolver 进行匹配.  对 SKILL.md 存在的单 skill 目录 (kind='source'), 按已有 local-copy 更新流程执行.  对无根 SKILL.md 的 batch 目录 (kind='batch-unsupported'), 系统 SHALL 输出引导消息提示 w03 将支持, 当前可通过指定子 skill 路径更新.

#### Scenario: 单 skill 路径匹配已安装 source
- **WHEN** 用户执行 `skillsmgr update ./my-skill` 且 `my-skill` 根目录含 SKILL.md
- **THEN** 系统将 `./my-skill` resolve 为绝对路径
- **THEN** SourceResolver 返回 `kind: 'source'`
- **THEN** 执行 local-copy 更新流程

#### Scenario: Batch 目录路径
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd` 且 `spec-tdd/` 根无 SKILL.md 但子目录包含 SKILL.md
- **THEN** SourceResolver 返回 `kind: 'batch-unsupported'`
- **THEN** 系统输出引导消息: "Batch directory update not yet supported. Update individual skills: skillsmgr update ./spec-tdd/<skill-name>"
- **THEN** 系统以非零状态码退出

#### Scenario: 路径未匹配任何已安装 source
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill`
- **THEN** SourceResolver 返回 `kind: 'not-found'`
- **THEN** 系统报错 "No installed skill found from path: {absPath}"
