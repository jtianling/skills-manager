## MODIFIED Requirements

### Requirement: 命令表

| 命令 | 别名 | 参数 | 选项 | 描述 |
|------|------|------|------|------|
| uninstall | - | [identifier] (可选) | -f, --force, --all, -s/--skill | Remove skills from ~/.skills-manager/ |

#### Scenario: uninstall 命令支持 --all 参数
- **WHEN** 用户执行 `skillsmgr uninstall --help`
- **THEN** 输出中包含 `--all` 选项, 描述为跳过交互直接删除所有 skills

### Requirement: uninstall 命令参数可选

原命令表中 `uninstall` 的 `<identifier>` 参数为可选.  无参数时进入交互式卸载模式 (全部 skills), `owner/repo` 参数进入 scoped 交互模式, 裸词参数按 skill name 查找.

#### Scenario: 无参数进入交互模式
- **WHEN** 用户执行 `skillsmgr uninstall`
- **THEN** 进入交互式卸载模式, 展示所有已安装 skills

#### Scenario: owner/repo 参数进入 scoped 交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** 进入 scoped 交互模式, 展示该 source 下的 skills

#### Scenario: 裸词参数按 skill name 查找
- **WHEN** 用户执行 `skillsmgr uninstall commit`
- **THEN** 按 skill name 查找并卸载

#### Scenario: --force 仅对有参数模式生效
- **WHEN** 用户执行 `skillsmgr uninstall` (无参数)
- **THEN** `--force` 选项不影响交互流程 (无参数就是要交互)
