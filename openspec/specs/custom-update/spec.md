# Custom Update

更新已安装的自定义 skill，覆盖 `~/.skills-manager/custom/` 中的已有内容.

## Requirements

### Requirement: 更新已安装的自定义 skill
系统 SHALL 提供 `custom-update` 命令, 接受 skill 名称或路径参数, 将对应目录重新复制到 `~/.skills-manager/custom/<skill-name>/`, 覆盖已有内容.  skill 名称从路径的 basename 提取.  查找目标路径时只检查 `custom/<name>/`, 不再搜索分组路径.

#### Scenario: 使用名称更新 (默认当前目录)
- **WHEN** 用户运行 `skillsmgr custom-update abc`, 且 `./abc/SKILL.md` 存在, 且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统删除 `~/.skills-manager/custom/abc/` 目录并将 `./abc/` 复制到该位置, 输出成功消息

#### Scenario: 使用相对路径更新
- **WHEN** 用户运行 `skillsmgr custom-update ./abc`, 且 `./abc/SKILL.md` 存在, 且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统从路径中提取 skill 名称 `abc`, 执行与名称方式相同的更新行为

#### Scenario: 使用绝对路径更新
- **WHEN** 用户运行 `skillsmgr custom-update /home/user/skills/abc`, 且该路径下 `SKILL.md` 存在, 且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统从路径中提取 skill 名称 `abc`, 执行更新

#### Scenario: 目标 skill 尚未安装
- **WHEN** 用户运行 `skillsmgr custom-update abc`, 且 `~/.skills-manager/custom/abc/` 不存在
- **THEN** 系统以退出码 1 退出, 并输出错误消息指示用户先运行 `install`

### Requirement: 源目录验证
系统 SHALL 验证指定路径下存在 `SKILL.md` 文件。

#### Scenario: 源 skill 目录不存在
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且对应路径下 `SKILL.md` 不存在
- **THEN** 系统以退出码 1 退出，并输出错误消息显示期望的 SKILL.md 完整路径

### Requirement: Setup 前置检查
系统 SHALL 在执行前验证 `~/.skills-manager/` 目录是否存在。

#### Scenario: Skills manager 未初始化
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且 `~/.skills-manager/` 不存在
- **THEN** 系统以退出码 1 退出，并输出 "Run: skillsmgr setup"

### Requirement: 命令别名
系统 SHALL 为 `custom-update` 命令注册别名 `cu`。

#### Scenario: 使用别名执行更新
- **WHEN** 用户运行 `skillsmgr cu abc`
- **THEN** 系统执行与 `skillsmgr custom-update abc` 相同的行为

### Requirement: 无确认提示
系统 SHALL 在更新时不显示任何确认提示，直接执行覆盖操作。

#### Scenario: 直接覆盖无提示
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且所有前置条件满足
- **THEN** 系统不显示任何确认提示，直接完成更新操作
