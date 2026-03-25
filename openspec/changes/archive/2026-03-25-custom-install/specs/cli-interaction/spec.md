## ADDED Requirements

### Requirement: Command alias for custom-install
The `custom-install` command SHALL have alias `ci`.

#### Scenario: Alias ci works
- **WHEN** user runs `skillsmgr ci abc`
- **THEN** the system behaves identically to `skillsmgr custom-install abc`

### Requirement: Command alias for install
The `install` command SHALL have alias `i`.

#### Scenario: Alias i works
- **WHEN** user runs `skillsmgr i anthropic`
- **THEN** the system behaves identically to `skillsmgr install anthropic`

## MODIFIED Requirements

### Requirement: 命令结构
程序名: `skillsmgr`
框架: Commander.js
版本: package.json 中定义 (当前 0.7.0), `index.ts` 中同步设置

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| setup | - | - | - | 初始化 ~/.skills-manager/ |
| install | i | \<source\> (必填) | --all, --custom | Download skills from a repository |
| custom-install | ci | \<name\> (必填) | -f, --force | Install a local skill to custom directory |
| update | - | [source] (可选) | - | Update installed skills to latest version |
| list | - | - | --deployed | List available or deployed skills |
| init | - | - | --copy | Deploy skills to current project |
| add | - | \<name\> (必填) | --tool \<tool\>, --copy | Add a skill to the project |
| remove | - | \<name\> (必填) | --tool \<tool\> | Remove a skill from the project |
| sync | - | - | Sync and verify deployed skills |

#### Scenario: CLI help shows all commands including custom-install
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** 输出包含 `custom-install` 命令及其别名 `ci`

#### Scenario: CLI help shows install alias
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** `install` 命令显示别名 `i`
