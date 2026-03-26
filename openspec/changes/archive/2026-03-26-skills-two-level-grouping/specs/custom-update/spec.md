## MODIFIED Requirements

### Requirement: 更新已安装的自定义 skill
系统 SHALL 提供 `custom-update` 命令，接受 skill 名称或路径参数，将对应目录重新复制到 `~/.skills-manager/custom/<skill-name>/` 或 `~/.skills-manager/custom/<group>/<skill-name>/`，覆盖已有内容。skill 名称从路径的 basename 提取。查找目标路径时, 先检查无分组路径 `custom/<name>/`, 再搜索分组路径 `custom/*/<name>/`.

#### Scenario: 使用名称更新（默认当前目录）
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且 `./abc/SKILL.md` 存在，且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统删除 `~/.skills-manager/custom/abc/` 目录并将 `./abc/` 复制到该位置，输出成功消息

#### Scenario: 使用相对路径更新
- **WHEN** 用户运行 `skillsmgr custom-update ./abc`，且 `./abc/SKILL.md` 存在，且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统从路径中提取 skill 名称 `abc`，执行与名称方式相同的更新行为

#### Scenario: 使用绝对路径更新
- **WHEN** 用户运行 `skillsmgr custom-update /home/user/skills/abc`，且该路径下 `SKILL.md` 存在，且 `~/.skills-manager/custom/abc/` 已存在
- **THEN** 系统从路径中提取 skill 名称 `abc`，执行更新

#### Scenario: 目标 skill 尚未安装
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且 `~/.skills-manager/custom/abc/` 不存在, 且 `~/.skills-manager/custom/*/abc/` 也不存在
- **THEN** 系统以退出码 1 退出，并输出错误消息指示用户先运行 `custom-install`

#### Scenario: 更新分组路径下的 skill
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且 `./abc/SKILL.md` 存在，且 `~/.skills-manager/custom/abc/` 不存在, 但 `~/.skills-manager/custom/my-tools/abc/` 存在
- **THEN** 系统在分组路径下找到该 skill, 删除 `~/.skills-manager/custom/my-tools/abc/` 并将 `./abc/` 复制到该位置

#### Scenario: 无分组路径优先
- **WHEN** 用户运行 `skillsmgr custom-update abc`，且 `~/.skills-manager/custom/abc/` 和 `~/.skills-manager/custom/my-tools/abc/` 都存在
- **THEN** 系统更新 `~/.skills-manager/custom/abc/` (无分组路径优先)
