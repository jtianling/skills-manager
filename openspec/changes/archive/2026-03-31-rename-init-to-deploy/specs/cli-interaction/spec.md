## MODIFIED Requirements

### Requirement: 命令结构
程序名: `skillsmgr`
框架: Commander.js
版本: package.json 中定义, `index.ts` 中同步设置

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| install | i | \<source\> (必填) | --all, --custom, -f/--force, -g/--group, -s/--skill, -a/--agent | Install skills from a repository |
| custom-install | ci | \<name\> (必填) | -f, --force | Install a local skill to custom directory |
| update | - | [source] (可选) | - | Update installed skills to latest version |
| list | - | - | --deployed | List available or deployed skills |
| deploy | - | - | --copy, -g/--global | Deploy skills to current project (or globally with -g) |
| add | - | [arg] (可选) | --copy, -a/--agent, --same-agents, -s/--skill, -g/--group | Add a skill to the project |
| remove | - | [name] (可选) | -s/--skill, -a/--agent | Remove a skill from the project |
| uninstall | - | [identifier] (可选) | -f, --force, --all, -s/--skill | Remove skills from ~/.skills-manager/ |

#### Scenario: CLI help shows deploy instead of init
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** 命令列表中显示 `deploy` 而非 `init`, 且不显示 `setup`

#### Scenario: init 命令不存在
- **WHEN** 用户执行 `skillsmgr init`
- **THEN** Commander.js 报 unknown command 错误

#### Scenario: setup 命令不存在
- **WHEN** 用户执行 `skillsmgr setup`
- **THEN** Commander.js 报 unknown command 错误

## REMOVED Requirements

### Requirement: setup 命令
**Reason**: setup 功能通过 auto-setup 守卫自动触发, 显式命令不再需要
**Migration**: 无需手动操作, 首次使用任何命令时自动初始化

### Requirement: init 命令
**Reason**: 重命名为 `deploy`, 消除 "init" 语义暗示一次性使用的错位
**Migration**: 使用 `skillsmgr deploy` 替代 `skillsmgr init`, 功能完全一致

## RENAMED Requirements

- FROM: `init` → TO: `deploy` (命令名及相关函数/文件)
