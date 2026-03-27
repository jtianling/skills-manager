## ADDED Requirements

### Requirement: 从原始路径更新 local-copy skill
update 命令 SHALL 支持更新 installMethod 为 `'local-copy'` 的 source.  系统从 sources.json 中记录的 `url` (原始绝对路径) 读取最新内容, 对比已安装目录中的 SKILL.md, 有变化则重新拷贝.

#### Scenario: 原始路径有更新
- **WHEN** local-copy source 的原始路径中 SKILL.md 内容与已安装版本不同
- **THEN** 系统删除已安装目录并从原始路径重新拷贝
- **THEN** 输出 "↑ {skillName}: updated"

#### Scenario: 原始路径无变化
- **WHEN** local-copy source 的原始路径中 SKILL.md 内容与已安装版本相同
- **THEN** 输出 "✓ {skillName}: up to date"

#### Scenario: 原始路径不存在
- **WHEN** local-copy source 的原始路径已不存在
- **THEN** 输出 "⚠ {skillName}: original path not found: {path}"
- **THEN** 计入 failed 计数

#### Scenario: 原始路径中无 SKILL.md
- **WHEN** local-copy source 的原始路径存在但不含 SKILL.md
- **THEN** 输出 "⚠ {skillName}: SKILL.md not found at original path"
- **THEN** 计入 failed 计数

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`), 按路径匹配已安装的 local-copy source 并更新.

#### Scenario: 路径匹配已安装 source
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统将 `./my-skill` resolve 为绝对路径
- **THEN** 在 sources.json 中查找 `url` 等于该绝对路径的记录
- **THEN** 找到后执行 local-copy 更新流程

#### Scenario: 路径未匹配任何已安装 source
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill`
- **THEN** 系统报错 "No installed skill found from path: {absPath}"
