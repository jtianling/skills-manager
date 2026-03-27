## MODIFIED Requirements

### Requirement: uninstall 命令参数可选

原命令表中 `uninstall` 的 `<identifier>` 参数从必选改为可选.  无参数时进入交互式卸载模式, 有参数时行为不变.

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| uninstall | - | [identifier] (可选) | -f, --force | Remove skills from ~/.skills-manager/ |

#### Scenario: 无参数进入交互模式
- **WHEN** 用户执行 `skillsmgr uninstall`
- **THEN** 进入交互式卸载模式

#### Scenario: 有参数执行直接卸载
- **WHEN** 用户执行 `skillsmgr uninstall anthropic`
- **THEN** 按现有逻辑直接卸载 anthropic provider 下的所有 skill

#### Scenario: --force 仅对有参数模式生效
- **WHEN** 用户执行 `skillsmgr uninstall` (无参数)
- **THEN** `--force` 选项不影响交互流程 (无参数就是要交互)
