## Purpose
TBD - update after review.
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

对 **custom** skill (含磁盘上 `custom/<name>/SKILL.md` 的单 skill 本地安装), 搜索 SHALL 以磁盘扫描为权威 — 调用 `findInstalledCustomSkills(name)` 获取所有匹配, 不依赖 sources.json 中是否有对应条目.  卸载完成后 SHALL 删除磁盘目录并清理 `groups.json` 中对该 key 的引用; SHALL NOT 尝试删除 sources.json 中的条目 (按新设计, 单 skill 本地安装不会有条目).

对 **official / community** skill, 搜索与卸载流程保持原样 (遍历 sources.json 中的 git source + 扫描对应磁盘目录), 卸载后仍清理 sources.json 中的相应条目.

#### Scenario: 唯一匹配的 skill (custom, 磁盘有 sources 无)
- **GIVEN** `custom/jt-share/SKILL.md` 存在, `sources.json` 无 `custom/jt-share` 条目
- **WHEN** 用户执行 `skillsmgr uninstall jt-share`
- **THEN** 系统通过 `findInstalledCustomSkills("jt-share")` 发现唯一匹配
- **THEN** 显示 skill 信息 (名称, 路径); warning + 确认
- **THEN** 确认后 删除 `custom/jt-share/` 目录
- **THEN** 从 `groups.json` 所有 group 的 members 中移除 `custom/jt-share` 引用
- **THEN** SHALL NOT 尝试删除 sources.json 条目 (本来就没有)
- **THEN** 以退出码 0 结束

#### Scenario: 唯一匹配的 skill (custom, 磁盘有 sources 也有 legacy 条目)
- **GIVEN** `custom/jt-share/SKILL.md` 存在, `sources.json` 含 legacy `custom/jt-share` local-copy 条目
- **WHEN** 用户执行 `skillsmgr uninstall jt-share`
- **THEN** 磁盘目录被删除, groups.json 引用被清理
- **THEN** 下次 `SourcesService` 有其他写操作时 legacy 条目被自然过滤清除 (不是本命令直接删除)

#### Scenario: 唯一匹配的 skill (official / community)
- **WHEN** 用户执行 `skillsmgr uninstall skill-name`, 在 official 或 community 下找到唯一匹配
- **THEN** 流程与 pre-change 行为一致: 显示 skill 信息, warning + 确认, 删除磁盘目录, 检查同 source 下是否还有其他 skill, 若无则清理 sources.json 对应条目

#### Scenario: 多个同名 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 且多个来源存在同名 skill (可能跨 custom/community/official)
- **THEN** 系统列出所有匹配的 skills 及其来源
- **THEN** 提示用户选择要卸载的 skill

#### Scenario: 未找到 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 但无匹配 (三种来源的磁盘扫描 + sources.json 查询都空)
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

系统 SHALL 在删除 skills 后检查并清理 `sources.json` 中相关的 git / registry / 物理 group 成员的无效记录.

对单 skill local-copy 卸载路径, SHALL NOT 尝试清理 sources.json — 按 "sources.json 不追踪 local-copy 条目" 需求, 本来就没有条目可清.

对物理 group 卸载路径, 清理范围 SHALL 覆盖 `affectedKeys` (物理目录扫描 ∪ sources.json 中以 `custom/<name>/` 开头的 key) 全部, 不依赖 bundle.members 快照 (不变).

#### Scenario: source 下所有 skills 已删除 (git)
- **WHEN** 删除 git source 下最后一个 skill 后, 该 source 目录不再有任何 skill
- **THEN** 系统从 `sources.json` 中移除该 git source 的记录

#### Scenario: source 下仍有其他 skills (git)
- **WHEN** 删除 skill 后, 该 git source 目录下仍有其他 skills
- **THEN** 系统保留 `sources.json` 中该 git source 的记录

#### Scenario: 单 skill 本地卸载不涉及 sources.json 清理
- **WHEN** 用户执行 `skillsmgr uninstall jt-share` (本地 skill)
- **THEN** 系统删除磁盘目录, 清理 groups.json 引用
- **THEN** 系统 SHALL NOT 执行 "清理 sources.json 条目" 步骤 (本来就没有条目)
- **THEN** 若 sources.json 恰好有 legacy 条目, 不报错, 不主动删除 (由读路径过滤 + 下次自然写入清除)

#### Scenario: 物理 group 卸载清理范围以 affectedKeys 为准 (不变)
- **GIVEN** 物理 group `tdd-spec`, 物理目录有 `ts-newname/SKILL.md`, sources.json 含 `custom/tdd-spec/tdd-old1` (物理已不存在)
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** affectedKeys = `{ custom/tdd-spec/ts-newname, custom/tdd-spec/tdd-old1 }`
- **THEN** sources.json 中两条全部清除 (物理 group 成员仍由 sources.json 追踪)

### Requirement: symlink 部署失效警告
系统 SHALL 在删除前警告用户已部署的 symlink 可能失效.

#### Scenario: 显示警告信息
- **WHEN** 系统即将删除 skills
- **THEN** 系统输出警告: 已部署到项目中的 symlink 将失效, 建议先用 `skillsmgr remove` 清理部署

### Requirement: 通过 URL 卸载
系统 SHALL 支持通过 Git URL 格式(HTTPS/SSH)执行卸载.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 卸载流程执行.

系统 SHALL 额外支持通过 well-known 站点 URL 执行卸载: 当 URL 无法提取出 owner/repo 时, 系统 SHALL 按归一化 URL 在已安装 sources 中匹配 `well-known/{hostname}` 条目, 匹配成功即按该 source key 执行卸载流程; 匹配失败才降级为按 skill name 查找.

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

#### Scenario: 通过 well-known 站点 URL 卸载
- **GIVEN** 已从 `https://docs.stripe.com` 安装 skill
- **WHEN** 用户执行 `skillsmgr uninstall https://docs.stripe.com`
- **THEN** 系统 SHALL 匹配到已安装 source key `well-known/docs.stripe.com`
- **THEN** 行为与 `skillsmgr uninstall docs.stripe.com` 一致

#### Scenario: 无法解析的 URL
- **WHEN** 用户执行 `skillsmgr uninstall https://example.com/`
- **THEN** 系统在已安装 sources 中找不到 `well-known/example.com`
- **THEN** 系统报错 skill not found(降级为按 skill name 查找, 自然失败)

