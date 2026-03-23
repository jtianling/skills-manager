## MODIFIED Requirements

### Requirement: Install from Anthropic

`installFromAnthropic()` SHALL 只安装 skills, 不再自动安装 commands.

仓库中没有 skill 时 SHALL 报错退出, 不再 fallback 到 commands-only 安装.

#### Scenario: Install anthropic skills only
- **WHEN** 用户执行 `install anthropic`
- **THEN** 只下载和安装 skill, 不查找或安装 commands

#### Scenario: No skills found in anthropic repo
- **WHEN** anthropic 仓库中没有 skill
- **THEN** 输出 "No skills found in repository" 并 exit(1), 不再尝试安装 commands

### Requirement: Install from GitHub URL

`installFromGitHubUrl()` SHALL 只处理 skill 安装. 移除 `installCommandsFromGitHub()` 调用.

仓库中没有 skill (子目录和根目录都没有) 时 SHALL 返回 false, 不再 fallback 到 commands-only.

#### Scenario: GitHub URL install skills only
- **WHEN** 用户安装 GitHub 仓库
- **THEN** 只搜索, 提示选择, 和下载 skill, 不处理 commands

#### Scenario: Repo with no skills
- **WHEN** 仓库中既无子目录 skill 也无根目录 SKILL.md
- **THEN** 返回 false (回退到 git clone), 不再因存在 commands 而返回 true

### Requirement: Install via git clone

`installViaGitClone()` SHALL 只安装 skills. 移除 `countCommandsInRepo()` 和 command 数量统计.

#### Scenario: Git clone install skills only
- **WHEN** 通过 git clone 安装仓库
- **THEN** 只查找和安装 skill, 不统计或提及 commands

#### Scenario: Git clone repo with no skills
- **WHEN** 克隆的仓库中没有 skill
- **THEN** 输出 "No skills found in repository" 并 exit(1)

### Requirement: Install output format

安装完成时的输出 SHALL 只提及 skills.

#### Scenario: Install success output
- **WHEN** 安装完成
- **THEN** 输出 "Installed N skills to path", 不再有 "and M commands" 部分

### Requirement: Update from remote

`updateSource()` SHALL 只更新 skills, 移除 commands 更新逻辑.

#### Scenario: Update only updates skills
- **WHEN** 执行 `update` 更新某个 source
- **THEN** 只比较和更新 skill, 不处理 `{targetBase}/commands/` 下的文件

#### Scenario: Update output
- **WHEN** 更新完成
- **THEN** 统计只包含 skill 的更新结果, 不计入 command
