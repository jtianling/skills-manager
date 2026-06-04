## Purpose
TBD - update after review.

## Requirements

### Requirement: setup E2E 测试
setup 命令 SHALL 有 E2E 测试验证真实 CLI 执行.

#### Scenario: 首次 setup 创建目录
- **WHEN** 在空 HOME 下执行 `skillsmgr setup`
- **THEN** 输出包含 "Setup complete"
- **THEN** ~/.skills-manager/official/ 目录存在
- **THEN** ~/.skills-manager/community/ 目录存在
- **THEN** ~/.skills-manager/custom/example-skill/SKILL.md 文件存在

### Requirement: install E2E 测试
install 命令 SHALL 有 E2E 测试验证真实下载和交互选择.

#### Scenario: install --all 非交互下载
- **WHEN** 执行 `skillsmgr install anthropics/skills --all`
- **THEN** 输出包含 "Fetching available skills"
- **THEN** 输出包含 "Installed"
- **THEN** ~/.skills-manager/official/anthropic/ 目录下有 skill 子目录
- **THEN** sources.json 有 anthropic 的记录

#### Scenario: install 交互选择 (interactiveCheckbox)
- **WHEN** 执行 `skillsmgr install anthropics/skills`
- **THEN** 出现 "Select skills to install" 提示
- **WHEN** 按 Space 选择当前 skill, 然后按 Enter 确认
- **THEN** 只下载选中的 skill
- **THEN** 输出包含 "Installed 1 skills"

### Requirement: list E2E 测试
list 命令 SHALL 有 E2E 测试验证输出格式.

#### Scenario: list 显示已安装 skills
- **WHEN** 已安装 skills 后执行 `skillsmgr list`
- **THEN** 输出包含已安装的 skill 名称

#### Scenario: list --deployed 显示部署信息
- **WHEN** 已部署 skills 后执行 `skillsmgr list --deployed`
- **THEN** 输出包含部署模式 (link 或 copy)

### Requirement: add E2E 测试
add 命令 SHALL 有 E2E 测试验证部署流程.

#### Scenario: add 带 -a flag 非交互部署
- **WHEN** 已安装 skill 后, 在 project 目录执行 `skillsmgr add <skill-name> -a claude-code`
- **THEN** .agents/skills/<skill-name> 存在且是 symlink
- **THEN** .claude/skills 是指向 .agents/skills 的 symlink
- **THEN** 输出包含 "linked"

#### Scenario: add --copy 模式
- **WHEN** 执行 `skillsmgr add <skill-name> -a claude-code --copy`
- **THEN** .agents/skills/<skill-name> 存在且是真实目录 (非 symlink)

### Requirement: uninstall E2E 测试
uninstall 命令 SHALL 有 E2E 测试验证卸载流程.

#### Scenario: uninstall -f 非交互卸载
- **WHEN** 已安装 skills 后执行 `skillsmgr uninstall <skill-name> -f`
- **THEN** skill 从 ~/.skills-manager/ 中删除
- **THEN** 输出包含 "Removed" 或 "Uninstalled"

#### Scenario: uninstall 交互确认
- **WHEN** 执行 `skillsmgr uninstall <skill-name>` (无 -f)
- **THEN** 出现确认提示
- **WHEN** 输入 y 并按 Enter
- **THEN** skill 被删除

### Requirement: 完整生命周期 E2E 测试
系统 SHALL 有端到端测试覆盖从安装到卸载的完整流程.

#### Scenario: setup → install → list → add → list --deployed → remove → uninstall
- **WHEN** 依次执行 setup, install --all, list, add -a, list --deployed, remove, uninstall -f
- **THEN** 每步输出正确, 文件系统状态正确
- **THEN** 最终 central repo 中对应 skill 已删除
- **THEN** project 的 .agents/skills/ 中 skill 已移除
