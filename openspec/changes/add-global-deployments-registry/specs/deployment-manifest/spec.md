## MODIFIED Requirements

### Requirement: update 输出笼统刷新提示
`skillsmgr update` 在检测到 bundle sync 结果 `added > 0 || removedHard > 0 || removedKept > 0` 时, SHALL 在该 bundle 的摘要行后输出受影响项目信息.  具体输出行为由 `global-deployments-registry` capability 的 "update 枚举受影响项目" 需求定义:

- 若注册表中**有**项目 follow / pin 该 bundle/group: SHALL 输出分组列表 (follow / pinned / missing)
- 若注册表中**无**相关项目 (或注册表不存在): SHALL 输出单行 "Note: projects following this bundle's group may need `skillsmgr deploy --refresh` to pick up changes." (本需求原有行为, 作为 fallback)

纯 up-to-date 的 bundle 不输出提示.

#### Scenario: 有注册项目时输出分组
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 源目录新增 skill, 注册表有项目 follow `tdd-spec`
- **THEN** 输出 "Projects using this bundle's group: follow: /path/a" 分组格式
- **AND** 不输出笼统提示

#### Scenario: 无注册项目时退回笼统提示
- **WHEN** 同上但注册表为空或无相关项目
- **THEN** 输出单行 "Note: projects following..." 笼统提示

#### Scenario: 注册表损坏时退回笼统提示
- **WHEN** 同上但注册表文件损坏
- **THEN** 系统 warn 注册表读取失败, 退回笼统提示 (更上层的 `deployments list` 仍报错; update 是旁路只读)
- **AND** update 成功退出码 0

### Requirement: deploy 完成后写入 manifest
普通 `skillsmgr deploy` (交互或 `--all` / `-y`) 完成部署后 SHALL 写入 / 更新项目 manifest **并** 同步更新全局 deployments 注册表对应项目条目.  写入规则:

- `pinnedSkills` = 本次交互勾选或 `--all` 全选的 skill key 集合 (去掉被 follow group 覆盖的)
- `followGroups` = 本次 `--follow-group` 指定的 group 名 (去重; 沿用上次 manifest 中 follow + 本次新增)
- `mode` = 本次部署模式 (与 `--copy` 对应)
- `deployedAt` = now

若已有 manifest:
- `pinnedSkills` 被本次结果**覆盖** (因为交互是当下快照; 若想保留旧 pinned, 用户应 `--refresh` 而不是 `deploy`)
- `followGroups` 取 **union(旧, 本次 --follow-group)**; 若用户想移除 follow, 需显式 `deploy --unfollow-group <name>` (预留)

注册表同步写入细节见 `global-deployments-registry` capability.

#### Scenario: 首次 deploy 无 follow
- **GIVEN** 无 manifest, 无注册表条目
- **WHEN** 用户执行 `skillsmgr deploy` 勾选 3 个 skill
- **THEN** manifest `pinnedSkills` SHALL 为这 3 个 key
- **AND** `followGroups` SHALL 为 `[]`
- **AND** 全局注册表 SHALL 新增本项目条目, 内容与 manifest 一致

#### Scenario: 二次 deploy 覆盖 pinned
- **GIVEN** manifest 已存在 `pinnedSkills: [a, b, c]`, 注册表条目对应
- **WHEN** 用户执行 `skillsmgr deploy` 重新勾选 `[b, d, e]`
- **THEN** manifest `pinnedSkills` SHALL 被覆盖为 `[b, d, e]`
- **AND** 注册表同条目 SHALL 同步更新为 `[b, d, e]`
- **AND** `.agents/skills/` 中的 `a`, `c` SHALL 被移除 (除非是 unmanaged)

#### Scenario: 带 --follow-group 的 deploy 并存量 follow
- **GIVEN** manifest `followGroups: ["openspec"]`, 注册表同步
- **WHEN** 用户执行 `skillsmgr deploy --follow-group tdd-spec -y`
- **THEN** manifest `followGroups` SHALL 为 `["openspec", "tdd-spec"]` (union)
- **AND** 注册表同步更新
