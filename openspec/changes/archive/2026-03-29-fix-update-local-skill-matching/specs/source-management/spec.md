## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统 SHALL 从路径中提取 skill name (basename), 在中央仓库 custom 目录中按 name 查找已安装 skill, 找到后对比 SKILL.md 内容, 有变化则重新拷贝.  系统 SHALL NOT 依赖 sources.json 的 url 字段做匹配.

#### Scenario: 路径指向已安装的 skill
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统提取 skillName = "my-skill"
- **THEN** 在 `~/.skills-manager/custom/` 中查找 "my-skill"
- **THEN** 找到后对比 source 路径和已安装路径的 SKILL.md 内容
- **THEN** 内容不同时删除已安装目录并从 source 路径重新拷贝, 输出 "↑ my-skill: updated"

#### Scenario: 路径指向已安装 skill 且无变化
- **WHEN** source 路径和已安装路径的 SKILL.md 内容相同
- **THEN** 输出 "✓ my-skill: up to date"

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill` 且 "unknown-skill" 未在中央仓库中安装
- **THEN** 输出 "No installed skill found: unknown-skill"

#### Scenario: source 路径不存在
- **WHEN** 用户执行 `skillsmgr update ./missing-dir` 且该路径不存在
- **THEN** 输出错误信息并退出

#### Scenario: 从不同目录 update 同一 skill
- **WHEN** skill "jt-release" 从 `/path/a/.claude/skills/jt-release` 安装
- **WHEN** 用户在 `/path/b/` 执行 `skillsmgr update ./skills/jt-release`
- **THEN** 系统按 skill name "jt-release" 查找, 不受 CWD 影响, 成功执行更新

#### Scenario: update 成功后维护 sources.json
- **WHEN** update 成功完成
- **THEN** 系统更新 sources.json 中对应 skill 的 `url` 为当前 source 绝对路径, `updatedAt` 为当前时间
- **THEN** 如果 sources.json 中无记录, 系统补写一条 (type: "custom", installMethod: "local-copy")
