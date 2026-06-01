# Smart Add

增强的 `add` 命令, 根据参数格式智能路由到不同处理分支, 整合远程安装与项目部署为一步操作.

## 参数路由

`add` 命令 SHALL 根据参数格式按以下优先级路由:

| 格式 | 判断条件 | 路由目标 |
|------|---------|---------|
| 无参数 | arg 为空 | init 流程 |
| 完整 URL | arg 含 `://` | URL 安装流程 |
| owner/repo | arg 含 `/` 且不含 `://` | provider/repo 流程 |
| skill name | 其他 | 中央仓库搜索流程 |

### Requirement: 无参数路由到 init

`add` 无参数时 SHALL 执行与 `init` 命令完全相同的流程.

#### Scenario: add 无参数执行 init 流程
- **WHEN** 用户执行 `skillsmgr add` (无参数)
- **THEN** 执行 init 流程, 包含 agent 选择和 skill 选择

#### Scenario: add 无参数传递 --copy 选项
- **WHEN** 用户执行 `skillsmgr add --copy`
- **THEN** init 流程使用 copy 模式部署

### Requirement: URL 格式路由到 URL 安装流程

arg 含 `://` 时 SHALL 进入 URL 安装流程, 不查询中央仓库.

#### Scenario: GitHub URL 路由
- **WHEN** 用户执行 `skillsmgr add https://github.com/owner/repo`
- **THEN** 进入 URL 安装流程, 不查询中央仓库

#### Scenario: Git URL 路由
- **WHEN** 用户执行 `skillsmgr add git://example.com/repo.git`
- **THEN** 进入 URL 安装流程

### Requirement: owner/repo 格式路由到 provider/repo 流程

arg 含 `/` 且不含 `://` 时 SHALL 进入 provider/repo 流程, 先查询中央仓库.

#### Scenario: owner/repo 路由
- **WHEN** 用户执行 `skillsmgr add anthropics/skills`
- **THEN** 先在中央仓库中搜索匹配的 provider/repo

### Requirement: 纯名称路由到中央仓库搜索

arg 不含 `/` 且不含 `://` 时 SHALL 在中央仓库中按 skill 名称搜索.

#### Scenario: skill name 路由
- **WHEN** 用户执行 `skillsmgr add code-review`
- **THEN** 在中央仓库中搜索名为 `code-review` 的 skill

## Skill Name 流程

### Requirement: 中央仓库搜索 skill 名称

按名称搜索中央仓库, 找到后让用户选择目标 agent 并部署.

#### Scenario: 找到单个匹配
- **WHEN** 中央仓库中只有一个名为 `code-review` 的 skill
- **THEN** 直接使用该 skill, 进入 agent 选择

#### Scenario: 找到多个匹配 (不同 source)
- **WHEN** 中央仓库中有多个名为 `code-review` 的 skill, 来自不同 source (如 `official/anthropic/skills` 和 `community/someuser/somerepo`)
- **THEN** 提示用户选择, 列表中显示 `{source}/{name}` 便于区分
- **AND** 用户选择后按 path 精确匹配对应 skill

#### Scenario: 找到多个匹配 (相同 source)
- **WHEN** 中央仓库中有多个名为 `jt-release` 的 skill, 来自相同 source 前缀 (如都在 `custom` 下)
- **THEN** 提示用户选择, 列表中显示包含父目录的完整路径便于区分
- **AND** 用户选择后按 path 精确匹配对应 skill

#### Scenario: 用户消歧义选择返回无效值
- **WHEN** 多匹配消歧义 prompt 返回了无法匹配到任何 skill 的值
- **THEN** 输出 "Failed to resolve skill selection."
- **AND** 以退出码 1 退出
- **AND** 不 crash

#### Scenario: 未找到匹配的 skill 也不是 group 名
- **WHEN** 中央仓库中没有名为 `xxx` 的 skill
- **AND** `xxx` 也不是已注册的 group 名 (虚拟或物理)
- **THEN** 输出 "Skill or group 'xxx' not found. Use 'skillsmgr search xxx' to look it up, or 'skillsmgr install <owner/repo|url|path>' to install from a remote source first."
- **AND** 以退出码 1 退出
- **AND** 不触发远程安装 (bare 名字不存在确定的 remote 源)

### Requirement: 纯名称匹配 group 名时按 group 批量部署

当 `add <name>` 的 `name` 在中央仓库中找不到 skill, 但匹配到一个已注册 group (虚拟或物理) 时, 命令 SHALL 派发到 group 批量部署流程, 等价于 `add --group <name>`, 并跳过 skill 选择 UI (用户已显式指定了 group, 无需再让其挑选成员).

#### Scenario: bare 名字匹配虚拟 group
- **WHEN** 用户执行 `skillsmgr add openspec`
- **AND** 中央仓库中没有名为 `openspec` 的 skill
- **AND** `openspec` 已在 `groups.json` 中登记为虚拟 group
- **THEN** 进入 group 批量部署流程
- **AND** 跳过 skill 选择 UI
- **AND** 仅交互 agent 选择 (或在 `-a` / `--same-agents` 已指定时跳过)
- **AND** 部署该 group 的全部 (符合 targetAgents 过滤后) 成员

#### Scenario: bare 名字匹配物理 group
- **WHEN** 用户执行 `skillsmgr add openspec`
- **AND** `openspec` 是 `local-batch` 物理 group, 目录 `~/.skills-manager/custom/openspec/` 下含多个 sub-skill
- **THEN** 进入 group 批量部署流程
- **AND** 部署 `custom/openspec/` 下所有 sub-skill

#### Scenario: skill 名与 group 名都存在时优先 skill
- **WHEN** 中央仓库中存在名为 `foo` 的 skill
- **AND** `groups.json` 中也存在名为 `foo` 的 group
- **THEN** 走单 skill 部署流程 (skill 优先于 group)

## Provider/Repo 流程

### Requirement: 中央仓库匹配 provider/repo

先在中央仓库中查找匹配的 `owner/repo`, 匹配逻辑:
- `official/{providerKey}/{repo}`: 通过 OFFICIAL_PROVIDERS 将 providerKey 映射到 owner, 与输入的 owner 比较
- `community/{owner}/{repo}`: 直接匹配

#### Scenario: 匹配 official provider
- **WHEN** 用户执行 `skillsmgr add anthropics/skills`
- **AND** 中央仓库中存在 `official/anthropic/skills/`
- **THEN** 匹配成功 (anthropic provider 的 owner 是 anthropics)

#### Scenario: 匹配 community repo
- **WHEN** 用户执行 `skillsmgr add someuser/somerepo`
- **AND** 中央仓库中存在 `community/someuser/somerepo/`
- **THEN** 匹配成功

#### Scenario: 未匹配到中央仓库
- **WHEN** 用户执行 `skillsmgr add unknown/repo`
- **AND** 中央仓库中不存在匹配
- **THEN** 进入远程安装流程

### Requirement: 中央仓库匹配后的 skill 选择

匹配成功时, 展示该 repo 下所有 skills 的选择列表:
- 已部署到项目的 skill: `checked: true` 且锁定 (不可取消选中)
- 未部署的 skill: `checked: false`, 可选择

#### Scenario: 展示 skill 列表 (部分已部署)
- **WHEN** 中央仓库 `official/anthropic/skills/` 有 5 个 skills, 其中 2 个已部署
- **THEN** 展示 5 个 skills, 2 个已部署的预选且锁定, 3 个未部署的可选择

#### Scenario: 所有 skills 已部署 (无 --skill 参数)
- **WHEN** 该 repo 下所有 skills 都已部署到项目
- **AND** 未指定 `--skill` 参数
- **THEN** 输出提示 "All skills from this source are already deployed."
- **AND** 正常退出

#### Scenario: --skill 指定的 skill 已全部部署
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill-a`
- **AND** `skill-a` 在本地中央仓库中存在
- **AND** `skill-a` 已部署到项目
- **THEN** 输出 "No new skills selected."
- **AND** 正常退出

#### Scenario: 锁定 skill 不可取消
- **WHEN** 用户在选择列表中对已部署的锁定 skill 按 Space
- **THEN** 该 skill 的选中状态不变

### Requirement: --skill 指定的 skill 不在本地时回退到远程安装

当 repo 已在中央仓库部分安装, 但 `--skill` 指定的 skill 不在本地已安装列表中时, `add` 命令 SHALL 回退到远程安装流程, 从远程获取缺失的 skill 后部署.

#### Scenario: repo 已部分安装, --skill 指定未安装的 skill
- **WHEN** 中央仓库中 `community/kepano/obsidian-skills/` 已安装 `obsidian-web-clipper`
- **AND** 用户执行 `skillsmgr add kepano/obsidian-skills --skill obsidian-markdown`
- **AND** `obsidian-markdown` 不在本地已安装列表中
- **THEN** 系统 SHALL 回退到远程安装流程
- **AND** 从远程仓库安装 `obsidian-markdown`
- **AND** 安装后将 `obsidian-markdown` 部署到项目

#### Scenario: repo 已部分安装, --skill 指定多个 skill, 部分不在本地
- **WHEN** 中央仓库中 `community/owner/repo/` 已安装 `skill-a`
- **AND** 用户执行 `skillsmgr add owner/repo -s skill-a -s skill-b`
- **AND** `skill-b` 不在本地已安装列表中
- **THEN** 系统 SHALL 回退到远程安装流程
- **AND** 安装 `skill-a` 和 `skill-b` (安装阶段 `skill-a` 已存在则跳过或覆盖)
- **AND** 部署 `skill-a` 和 `skill-b`

#### Scenario: repo 已部分安装, --skill 指定的 skill 全部在本地
- **WHEN** 中央仓库中 `community/owner/repo/` 已安装 `skill-a` 和 `skill-b`
- **AND** 用户执行 `skillsmgr add owner/repo -s skill-a`
- **THEN** 系统 SHALL 走本地部署路径, 不触发远程安装

### Requirement: 远程安装未匹配的 provider/repo

中央仓库未匹配时:
1. 检查是否匹配 official provider (复用 install 命令的逻辑)
2. 不匹配则拼接 `https://github.com/{owner}/{repo}` 作为 GitHub URL
3. 执行远程安装到中央仓库
4. 安装成功后展示 skill 选择列表
5. 选择后进入 agent 选择并部署

#### Scenario: 匹配 official provider 安装
- **WHEN** 用户执行 `skillsmgr add anthropic` (无 `/`, 但通过 provider 别名处理)
- 注: 此场景实际走 skill name 流程, 不走此流程

#### Scenario: 拼接 GitHub URL 安装
- **WHEN** 用户执行 `skillsmgr add unknown/repo`
- **AND** 中央仓库无匹配且非 official provider
- **THEN** 使用 `https://github.com/unknown/repo` 执行远程安装

#### Scenario: 远程安装失败
- **WHEN** 远程安装过程中发生错误 (网络失败, 仓库不存在等)
- **THEN** 输出错误信息并以退出码 1 退出

## URL 安装流程

### Requirement: URL 直接安装

完整 URL 参数不查询中央仓库, 直接执行远程安装.

#### Scenario: GitHub URL 安装
- **WHEN** 用户执行 `skillsmgr add https://github.com/owner/repo`
- **THEN** 直接调用远程安装逻辑, 不查询中央仓库

#### Scenario: 安装成功后选择 skill
- **WHEN** URL 安装成功, 安装了 3 个 skills
- **THEN** 展示 skill 选择列表, 所有 skills 均为未选中状态

## Skill 过滤

### Requirement: -s/--skill 标志指定安装和部署的 skill

`-s`/`--skill` 标志 SHALL 在安装阶段和部署阶段同时生效, 仅安装和部署用户指定的 skill.

当 `-s` 指定了 skill 时:
1. 远程安装阶段 SHALL 仅安装指定的 skill 到中央仓库, 而非整个仓库的所有 skill
2. 部署阶段 SHALL 仅部署指定的 skill 到目标 agent

#### Scenario: -s 过滤穿透到安装阶段
- **WHEN** 用户执行 `skillsmgr add openai/skills -s skill-creator -a claude-code`
- **AND** 仓库包含 44 个 skills
- **THEN** 仅安装 `skill-creator` 到中央仓库
- **AND** 输出 "Found 1 skill."
- **AND** 仅部署 `skill-creator` 到 claude-code

#### Scenario: -s 指定多个 skill
- **WHEN** 用户执行 `skillsmgr add openai/skills -s skill-a -s skill-b`
- **THEN** 仅安装 `skill-a` 和 `skill-b` 到中央仓库
- **AND** 输出 "Found 2 skills."

#### Scenario: -s 指定不存在的 skill
- **WHEN** 用户执行 `skillsmgr add openai/skills -s nonexistent`
- **AND** 仓库中不存在名为 `nonexistent` 的 skill
- **THEN** 输出 "Skill 'nonexistent' not found."
- **AND** 以退出码 1 退出

#### Scenario: 不指定 -s 时安装所有 skill
- **WHEN** 用户执行 `skillsmgr add openai/skills` (无 -s)
- **THEN** 安装仓库中所有 skill 到中央仓库
- **AND** 进入 skill 选择 UI 供用户选择要部署的 skill

## Agent 选择

### Requirement: 默认交互选择 agent

所有带参数的流程 (skill name / provider-repo / URL) SHALL 先进入 agent 选择, 再进入 skill 选择.  当 agent 已通过标志确定时跳过 agent 选择, 当 skill 已通过标志确定时跳过 skill 选择.

#### Scenario: 无 -a 无 -s 先 agent 后 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo` (未指定 `-a`, `-s`, `--all`, `--same-agents`)
- **THEN** 先显示 agent 选择 UI
- **AND** 用户选择 agent 后, 再显示 skill 选择 UI

#### Scenario: 有 -a 跳过 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接显示 skill 选择 UI

#### Scenario: 有 -s 跳过 skill 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill`
- **THEN** 跳过 skill 选择, 直接显示 agent 选择 UI

#### Scenario: -a 加 -s 完全跳过交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -s my-skill`
- **THEN** 完全跳过交互, 直接部署

### Requirement: add -g/--global 全局部署模式

`add` 命令 SHALL 支持 `-g`/`--global` 参数, 启用全局部署模式.  全局模式下 skill 部署到各 agent 的 `globalSkillsDir` 而非项目级 `.agents/skills/`.

#### Scenario: -g 标志启用全局模式

- **WHEN** 用户执行 `skillsmgr add code-review -g`
- **THEN** 进入全局部署模式, 部署到选中 agent 的全局 skills 目录

#### Scenario: --global 长选项

- **WHEN** 用户执行 `skillsmgr add code-review --global`
- **THEN** 行为与 `-g` 相同

#### Scenario: 不指定 -g 保持项目级

- **WHEN** 用户执行 `skillsmgr add code-review` (无 -g)
- **THEN** 保持现有项目级部署行为

### Requirement: add --group 批量部署

`add --group <name>` SHALL 从中央仓库按组批量部署 skills, 不再透传给远程安装逻辑.

#### Scenario: --group 批量部署

- **WHEN** 用户执行 `skillsmgr add --group dev`
- **THEN** 查找 `custom/dev` 组下所有 skills 并展示选择列表

#### Scenario: --group 与 skill name 互斥

- **WHEN** 用户执行 `skillsmgr add code-review --group dev`
- **THEN** 输出错误 "Cannot use --group with a skill argument."
- **AND** 以退出码 1 退出

### Requirement: -a/--agent 标志指定 agent

`-a`/`--agent` 标志 SHALL 接受可重复的 agent 名称, 跳过交互选择. 不再使用逗号分隔.

#### Scenario: 单个 agent
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 跳过 agent 选择, 部署到 claude-code

#### Scenario: 多个 agent
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code -a cursor`
- **THEN** 跳过 agent 选择, 部署到 claude-code 和 cursor

#### Scenario: 无效 agent 名称
- **WHEN** 用户执行 `skillsmgr add code-review -a invalid-name`
- **THEN** 输出 `Unknown agent: 'invalid-name'. Available agents: claude-code, codex, ...`
- **AND** 以退出码 1 退出

#### Scenario: 隐藏 agent 可通过 -a 使用

- **WHEN** 用户执行 `skillsmgr add code-review -a amp`
- **THEN** 部署成功, amp 虽不在交互列表但可通过 -a 操作

### Requirement: --same-agents 标志复用已配置 agent

`--same-agents` 标志 SHALL 使用项目已配置的 agents, 跳过交互选择. 不再有 `-s` 短参数.

#### Scenario: 项目有已配置 agent
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **THEN** 跳过 agent 选择, 部署到已配置的 agents

#### Scenario: 项目无已配置 agent
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **AND** 项目无已配置 agent
- **THEN** 输出 `No agents configured. Run 'skillsmgr deploy' or omit --same-agents flag.`
- **AND** 以退出码 1 退出

### Requirement: -a 和 --same-agents 互斥

`-a` 和 `--same-agents` 不可同时使用.

#### Scenario: 同时指定 -a 和 --same-agents
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code --same-agents`
- **THEN** 输出 `Cannot use --agent and --same-agents together.`
- **AND** 以退出码 1 退出

### Requirement: --skill 参数跳过 skill 选择

add 命令 SHALL 支持 `-s, --skill <name>` 可重复参数. 指定时跳过 skill 选择交互, 仅操作指定的 skill.

#### Scenario: add owner/repo 带 --skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -s frontend-design`
- **AND** 中央仓库中 owner/repo 下存在 `frontend-design` skill
- **THEN** 跳过 skill 选择, 直接进入 agent 选择 (或跳过, 如果 -a 也指定了)

#### Scenario: add owner/repo 带 --skill 指定不存在的 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -s nonexistent`
- **AND** owner/repo 下不存在名为 `nonexistent` 的 skill
- **THEN** 输出 `Skill 'nonexistent' not found.`
- **AND** 以退出码 1 退出

#### Scenario: add skill-name 带 --skill 无意义但不报错
- **WHEN** 用户执行 `skillsmgr add code-review -s code-review`
- **THEN** 正常执行, `-s` 在 skill-name 流程中被忽略 (arg 本身已经指定了 skill)

## 回滚机制

### Requirement: 远程安装后失败时回滚

远程安装成功后, 如果后续步骤 (skill 选择, agent 选择, 部署) 失败或用户取消, SHALL 回滚中央仓库的安装.

#### Scenario: 用户取消 skill 选择后回滚
- **WHEN** 远程安装成功安装了 `community/owner/repo/` 下的 3 个 skills
- **AND** 用户在 skill 选择时按 Ctrl+C 取消
- **THEN** 删除 `community/owner/repo/` 目录
- **AND** 清理 `sources.json` 中对应条目
- **AND** 输出 "Installation rolled back."

#### Scenario: 用户取消 agent 选择后回滚
- **WHEN** 远程安装成功
- **AND** 用户在 agent 选择时按 Ctrl+C 取消
- **THEN** 回滚中央仓库安装

#### Scenario: 部署失败后回滚
- **WHEN** 远程安装成功
- **AND** 部署过程中发生文件系统错误
- **THEN** 回滚中央仓库安装
- **AND** 输出错误信息

#### Scenario: 用户选择 0 个 skill 后回滚
- **WHEN** 远程安装成功
- **AND** 用户在 skill 选择中未选择任何 skill 并确认
- **THEN** 回滚中央仓库安装

### Requirement: 回滚操作内容

回滚 SHALL 执行:
1. 删除安装到中央仓库的 skill 目录
2. 清理 `sources.json` 中对应条目
3. 删除失败时 warn 但继续清理剩余项

#### Scenario: 回滚删除失败
- **WHEN** 回滚过程中某个目录删除失败
- **THEN** 输出警告信息
- **AND** 继续删除剩余项

## Source 扫描

### Requirement: 嵌套 custom skill source 保留父目录

`getSkillsFromSource` 扫描 `custom/` 目录时, 嵌套在子目录中的 skill SHALL 在 source 中保留父目录路径.

#### Scenario: 顶层 custom skill source
- **WHEN** `~/.skills-manager/custom/jt-release/SKILL.md` 存在
- **THEN** 该 skill 的 source SHALL 为 `"custom"`

#### Scenario: 嵌套 custom skill source 包含父目录
- **WHEN** `~/.skills-manager/custom/init-project/jt-release/SKILL.md` 存在
- **AND** `~/.skills-manager/custom/init-project/SKILL.md` 不存在
- **THEN** 该 skill 的 source SHALL 为 `"custom/init-project"`

#### Scenario: 嵌套 custom skill 与顶层同名时可区分
- **WHEN** 存在 `custom/jt-release` (source: `"custom"`) 和 `custom/init-project/jt-release` (source: `"custom/init-project"`)
- **THEN** 两个 skill 的 `{source}/{name}` 分别为 `"custom/jt-release"` 和 `"custom/init-project/jt-release"`, 互不相同

## 已部署 skill 补 agent

### Requirement: 已部署 skill 不裸早退而进入 agent 补全

`add` 的 skill-name 流程 (`handleSkillName`) 与 repo 选择流程 (`handleRepoSkillSelection`) 在判定目标 skill 已部署时 SHALL NOT 直接 `return`, 而是进入 agent 补全 —— 解析目标 agent 后补建缺失的项目级 bridge.  此行为 SHALL 与远程安装流程 (`handleRemoteInstallAndDeploy`) 在"全部 skill 已部署"时调用 `ensureSymlinkBridges` 的既有正确行为一致, 使三条 already-deployed 路径表现统一.

#### Scenario: skill-name 流程已部署补 bridge

- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`, 而 `code-review` 已部署但 claude-code 无 bridge
- **THEN** 不打印 `already deployed` 后无操作返回
- **AND** 补建 `.claude/skills` bridge

#### Scenario: repo 选择流程全部已部署仍补 bridge

- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`, 该 repo 的全部 skill 均已部署但 claude-code 无 bridge
- **THEN** 不在 "all already deployed" 分支裸早退
- **AND** 补建 claude-code 的 bridge 后再返回
