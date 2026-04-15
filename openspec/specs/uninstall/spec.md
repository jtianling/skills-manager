## Requirements

### Requirement: 按 provider 卸载
系统 SHALL 支持通过 provider key 卸载该 provider 下所有已安装的 skills.  命令格式: `skillsmgr uninstall <providerKey>`.  系统 SHALL 同时支持 provider 的别名(如 `vercel` -> `vercel-labs`).

#### Scenario: 卸载整个 official provider
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
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
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills` 但 `~/.skills-manager/official/anthropic/` 不存在
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

### Requirement: 按 group 卸载 — 顶层路由

`skillsmgr uninstall <input>` 经 `SourceResolver` 解析后, 若 `ResolvedTarget.kind === 'group'`, SHALL 按 group 类型分发:

- `groupKind === 'local-batch'` → 走物理 group 卸载算法 (见 `group-as-first-class-unit` capability 的 "物理 group 卸载以物理目录扫描为权威" 需求)
- `groupKind === 'virtual'` → 报错提示用 `group delete`, 不卸载 skill

`<input>` 可为 bareword (group 名), `custom/<name>`, 本地路径任一形态, 经 resolver 后行为一致.

#### Scenario: 顶层 uninstall 命中物理 group (bareword)
- **GIVEN** 物理 group `tdd-spec` 存在
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** 走物理 group 卸载算法
- **THEN** 不再报 `Skill 'tdd-spec' not found`

#### Scenario: 顶层 uninstall 命中物理 group (custom 前缀)
- **GIVEN** 物理 group `tdd-spec` 存在
- **WHEN** 用户执行 `skillsmgr uninstall custom/tdd-spec`
- **THEN** SourceResolver 在 `custom/<name>` 路径下识别为物理 group, 走卸载算法
- **THEN** 不再报 `No installed source found for custom/tdd-spec`

#### Scenario: 顶层 uninstall 命中物理 group (本地路径)
- **GIVEN** 物理 group `tdd-spec`, url `/dev/tdd-spec`
- **WHEN** 用户执行 `skillsmgr uninstall ./tdd-spec` (或 `/dev/tdd-spec`)
- **THEN** 走物理 group 卸载算法 (替代旧的 bundle remove 路径)

#### Scenario: 顶层 uninstall 命中逻辑 group 给提示
- **GIVEN** 逻辑 group `python` 存在
- **WHEN** 用户执行 `skillsmgr uninstall python`
- **THEN** 系统 SHALL 报错 `'python' is a virtual group; use 'group delete python' to remove it (skills are not affected)`
- **AND** 不修改任何 skill 或 sources.json

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
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills --force`
- **THEN** 系统跳过确认直接执行删除

### Requirement: sources.json 清理

系统 SHALL 在删除 skills 后检查并清理 `sources.json` 中的无效记录.  对物理 group 卸载路径, 清理范围 SHALL 覆盖 `affectedKeys` (物理目录扫描 ∪ sources.json 中以 `custom/<name>/` 开头的 key) 全部, 不依赖 bundle.members 快照.

#### Scenario: source 下所有 skills 已删除
- **WHEN** 删除 skill 后, 该 source 目录下不再有任何 skill
- **THEN** 系统从 `sources.json` 中移除该 source 的记录

#### Scenario: source 下仍有其他 skills
- **WHEN** 删除 skill 后, 该 source 目录下仍有其他 skills
- **THEN** 系统保留 `sources.json` 中该 source 的记录

#### Scenario: 物理 group 卸载清理范围以 affectedKeys 为准
- **GIVEN** 物理 group `tdd-spec`, 物理目录有 `ts-newname/SKILL.md`, sources.json 含 `custom/tdd-spec/tdd-old1` (物理已不存在), 但旧 bundle.members 仅包含 `tdd-old1`
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** affectedKeys = `{ custom/tdd-spec/ts-newname, custom/tdd-spec/tdd-old1 }`
- **THEN** sources.json 中两条全部清除, 不再因为依赖快照而漏掉 `ts-newname`

### Requirement: symlink 部署失效警告
系统 SHALL 在删除前警告用户已部署的 symlink 可能失效.

#### Scenario: 显示警告信息
- **WHEN** 系统即将删除 skills
- **THEN** 系统输出警告: 已部署到项目中的 symlink 将失效, 建议先用 `skillsmgr remove` 清理部署

### Requirement: 通过 URL 卸载
系统 SHALL 支持通过 Git URL 格式(HTTPS/SSH)执行卸载.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 卸载流程执行.

#### Scenario: 通过 HTTPS URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall https://github.com/openai/skills`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall openai/skills` 一致

#### Scenario: 通过 GitLab HTTPS URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall https://gitlab.com/foo/bar`
- **THEN** 系统提取 `foo/bar` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall foo/bar` 一致

#### Scenario: 通过 SSH URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall git@github.com:openai/skills.git`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall openai/skills` 一致

#### Scenario: 无法解析的 URL
- **WHEN** 用户执行 `skillsmgr uninstall https://example.com/`
- **THEN** 系统报错 skill not found(降级为按 skill name 查找, 自然失败)
