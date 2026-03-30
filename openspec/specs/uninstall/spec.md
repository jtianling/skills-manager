## Requirements

### Requirement: 按 provider 卸载
系统 SHALL 支持通过 provider key 卸载该 provider 下所有已安装的 skills.  命令格式: `skillsmgr uninstall <providerKey>`.  系统 SHALL 同时支持 provider 的别名(如 `vercel` -> `vercel-labs`).

#### Scenario: 卸载整个 official provider
- **WHEN** 用户执行 `skillsmgr uninstall anthropic`
- **THEN** 系统列出 `~/.skills-manager/official/anthropic/` 下所有已安装的 skills
- **THEN** 系统警告 symlink 部署可能失效
- **THEN** 系统请求用户确认
- **THEN** 确认后删除 `~/.skills-manager/official/anthropic/` 目录及其所有内容
- **THEN** 清理 `sources.json` 中对应的 source 记录

#### Scenario: 通过别名卸载 provider
- **WHEN** 用户执行 `skillsmgr uninstall vercel`
- **THEN** 系统将 `vercel` 解析为 `vercel-labs`
- **THEN** 行为与直接使用 `vercel-labs` 一致

#### Scenario: provider 不存在
- **WHEN** 用户执行 `skillsmgr uninstall anthropic` 但 `~/.skills-manager/official/anthropic/` 不存在
- **THEN** 系统输出错误信息并退出

### Requirement: 按 community source 卸载
系统 SHALL 支持通过 `owner/repo` 格式卸载 community source 下所有已安装的 skills.

#### Scenario: 卸载 community source
- **WHEN** 用户执行 `skillsmgr uninstall owner/repo`
- **THEN** 系统列出 `~/.skills-manager/community/owner/repo/` 下所有已安装的 skills
- **THEN** 系统警告 symlink 部署可能失效并请求确认
- **THEN** 确认后删除该目录及其内容
- **THEN** 清理 `sources.json` 中 `community/owner/repo` 的记录
- **THEN** 若 `~/.skills-manager/community/owner/` 为空, 则同时清理该空目录

#### Scenario: community source 不存在
- **WHEN** 用户执行 `skillsmgr uninstall owner/repo` 但该路径不存在
- **THEN** 系统输出错误信息并退出

### Requirement: 按 skill 名称卸载
系统 SHALL 支持通过 skill 名称搜索并卸载单个 skill.  搜索范围覆盖 official, community, custom 三种来源.

#### Scenario: 唯一匹配的 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name`
- **THEN** 系统在所有来源中搜索名为 `skill-name` 的 skill
- **THEN** 找到唯一匹配后, 显示 skill 信息(名称, 来源, 路径)
- **THEN** 警告 symlink 部署可能失效并请求确认
- **THEN** 确认后删除该 skill 目录
- **THEN** 检查该 skill 所属 source 下是否还有其他 skills, 若无则清理 `sources.json` 记录

#### Scenario: 多个同名 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 且多个来源存在同名 skill
- **THEN** 系统列出所有匹配的 skills 及其来源
- **THEN** 提示用户选择要卸载的 skill

#### Scenario: 未找到 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 但无匹配
- **THEN** 系统输出错误信息并退出

### Requirement: custom skill 卸载
系统 SHALL 统一处理 custom skills 的卸载, 包括直接在 `custom/` 下的 skill 和在 group 目录下的 skill.

#### Scenario: 卸载直接 custom skill
- **WHEN** 用户执行 `skillsmgr uninstall my-skill` 且 `~/.skills-manager/custom/my-skill/` 存在
- **THEN** 确认后删除该 skill 目录

#### Scenario: 卸载 group 下的 custom skill
- **WHEN** 用户执行 `skillsmgr uninstall helper-skill` 且 skill 位于 `~/.skills-manager/custom/utils/helper-skill/`
- **THEN** 确认后删除该 skill 目录
- **THEN** 若 `custom/utils/` 为空, 则同时清理该空目录

### Requirement: 交互确认
系统 SHALL 在执行删除前要求用户确认.  `--force` 选项 SHALL 跳过确认.

#### Scenario: 用户确认删除
- **WHEN** 系统显示待删除 skills 列表和警告信息
- **THEN** 系统提示 "Confirm uninstall? (y/N)"
- **THEN** 用户输入 y 后执行删除

#### Scenario: 用户取消删除
- **WHEN** 系统提示确认
- **THEN** 用户输入 N 或直接回车
- **THEN** 系统取消操作, 不删除任何文件

#### Scenario: force 模式跳过确认
- **WHEN** 用户执行 `skillsmgr uninstall anthropic --force`
- **THEN** 系统跳过确认直接执行删除

### Requirement: sources.json 清理
系统 SHALL 在删除 skills 后检查并清理 `sources.json` 中的无效记录.

#### Scenario: source 下所有 skills 已删除
- **WHEN** 删除 skill 后, 该 source 目录下不再有任何 skill
- **THEN** 系统从 `sources.json` 中移除该 source 的记录

#### Scenario: source 下仍有其他 skills
- **WHEN** 删除 skill 后, 该 source 目录下仍有其他 skills
- **THEN** 系统保留 `sources.json` 中该 source 的记录

### Requirement: symlink 部署失效警告
系统 SHALL 在删除前警告用户已部署的 symlink 可能失效.

#### Scenario: 显示警告信息
- **WHEN** 系统即将删除 skills
- **THEN** 系统输出警告: 已部署到项目中的 symlink 将失效, 建议先用 `skillsmgr remove` 清理部署
