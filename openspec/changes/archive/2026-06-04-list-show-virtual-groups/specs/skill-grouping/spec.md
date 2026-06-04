## MODIFIED Requirements

### Requirement: list 命令二级缩进输出
`list` 命令的 listAvailable SHALL 在 category separator 下按子组分组显示, 子项缩进.  子组来源有两类: (1) source-path 派生的物理子组 (official/community 的 `provider/repo`、custom 的 `custom/{name}` 子目录), (2) `groups.json` 中 `kind: "virtual"` 的虚拟 group.  属于某个虚拟 group 的 skill SHALL 在该虚拟 group 的子标题下缩进显示, 并 SHALL NOT 出现在该 category 的平铺 (无子组) 列表中.  不属于任何子组的 skill SHALL 直接平铺列在 category 下, 不带额外的分组标题.

子组排序 SHALL 为: 物理子组在前, 虚拟 group 子组在后, 各自按名字升序; 平铺 skill 最后.

一个 skill 同时属于多个虚拟 group 时 SHALL 在每个所属 group 子标题下各列一次.  虚拟 group 成员跨 category 时, 成员 SHALL 在其所属 category 区块内以该 group 子标题缩进, 同名 group 标题可在多个 category 区块各出现一次.

#### Scenario: list 显示 official 二级分组
- **WHEN** 用户运行 `skillsmgr list`, 且有 vercel-labs 来源的 skills
- **THEN** 输出包含 `── official ──`, 其下 `  vercel-labs/agent-skills (N)`, 各自下方列出 skills

#### Scenario: list 显示 custom 物理子组
- **WHEN** 用户运行 `skillsmgr list`, 且 custom 下有 `custom/openspec` 子目录的 skills
- **THEN** 在 `── custom ──` 下显示 `  openspec (N)`, 其下方缩进列出 skill 名称

#### Scenario: list 显示虚拟 group 作为子标题
- **WHEN** 用户运行 `skillsmgr list`, 且存在 `kind: "virtual"` 的 group `develop`, 其成员为 `custom/jt-code-reviewer` 等平铺 custom skill
- **THEN** 在 `── custom ──` 下显示 `  develop (N)` 子标题, 其下方缩进列出 `jt-code-reviewer` 等成员名称

#### Scenario: 虚拟 group 成员不再平铺单独列出
- **WHEN** 用户运行 `skillsmgr list`, skill `jt-code-reviewer` 属于虚拟 group `develop`
- **THEN** `jt-code-reviewer` 仅出现在 `develop` 子标题下, 不再出现在 custom 的平铺列表中

#### Scenario: 不属于任何子组的 skill 直接平铺
- **WHEN** 用户运行 `skillsmgr list`, custom skill `jt-share` 不属于任何虚拟 group 也无物理子目录
- **THEN** `jt-share` 直接缩进列在 `── custom ──` 下, 不带 `(ungrouped)` 或其他分组标题

#### Scenario: 物理子组排在虚拟 group 子组之前
- **WHEN** 用户运行 `skillsmgr list`, custom 下同时有物理子组 `openspec` 和虚拟 group `develop`
- **THEN** `openspec (N)` 先输出, `develop (N)` 后输出

#### Scenario: skill 属于多个虚拟 group 各列一次
- **WHEN** 用户运行 `skillsmgr list`, skill `jt-codex` 同时属于虚拟 group `develop` 和 `tools`
- **THEN** `jt-codex` 在 `develop` 子标题下列一次, 在 `tools` 子标题下也列一次

#### Scenario: 无虚拟 group 时行为不变
- **WHEN** 用户运行 `skillsmgr list`, `groups.json` 中无 `kind: "virtual"` 的 group
- **THEN** 输出与本变更前一致 (仅 source-path 物理子组 + 平铺 skill)
