## ADDED Requirements

### Requirement: 项目部署清单文件 schema
项目根 SHALL 使用 `.skills-manager/deployment.json` 记录已部署 skill 的声明式意图.  文件结构:

```json
{
  "mode": "link" | "copy",
  "followGroups": ["<group-name>", "..."],
  "pinnedSkills": ["<skill-key>", "..."],
  "deployedAt": "<ISO 8601 timestamp>"
}
```

字段语义:
- `mode`: 部署模式, 取 `"link"` 或 `"copy"`.  refresh 沿用
- `followGroups`: group 名数组.  refresh 时按 group 当前成员展开
- `pinnedSkills`: skill key 数组 (格式 `{source}/{...}/{name}`).  refresh 时精确保持
- `deployedAt`: 上次 deploy / refresh 完成的 ISO 时间戳, 纯诊断用

不合法字段 SHALL 被忽略 (向前兼容); 核心字段缺失时 refresh SHALL 报错并给出 schema 指引.

#### Scenario: 首次 deploy 创建 manifest
- **GIVEN** 项目根没有 `.skills-manager/` 目录
- **WHEN** 用户执行 `skillsmgr deploy --all` 并完成选择
- **THEN** 系统 SHALL 创建 `.skills-manager/deployment.json`
- **AND** `pinnedSkills` SHALL 包含本次部署的所有 skill key
- **AND** `followGroups` SHALL 为空数组
- **AND** `mode` SHALL 反映本次部署模式 (未传 `--copy` 时为 `"link"`)

#### Scenario: manifest 非法 JSON
- **WHEN** `.skills-manager/deployment.json` 存在但非法 JSON
- **THEN** 系统 SHALL 报错 "Invalid deployment manifest: <path>.  Re-run `skillsmgr deploy` to regenerate."
- **AND** refresh SHALL 以非 0 退出码终止, 不触达部署阶段

### Requirement: --follow-group CLI 选项
`skillsmgr deploy` SHALL 支持 `--follow-group <name>` 选项 (可重复).  该选项将指定 group 声明为"追随", 写入 manifest 的 `followGroups`.  group 不存在时 SHALL fail-fast.

交互行为:
- followGroups 指定的 group 的 skill SHALL **不**出现在交互勾选列表中 (由 follow 接管)
- `--follow-group` 可与交互模式或 `--all` 组合: 交互/`--all` 的选中结果作为 `pinnedSkills`, follow 作为 `followGroups`, 两者并集为本次实际部署

#### Scenario: 纯 follow 部署
- **WHEN** 用户执行 `skillsmgr deploy --follow-group tdd-spec -y`
- **THEN** 系统 SHALL 把 `tdd-spec` group 当前所有成员部署到项目
- **AND** manifest `followGroups` SHALL 包含 `"tdd-spec"`
- **AND** manifest `pinnedSkills` SHALL 为空

#### Scenario: follow 与 pinned 混合
- **WHEN** 用户执行 `skillsmgr deploy --follow-group tdd-spec`, 交互中再勾选 `custom/jt-codex` 和 `community/obra/superpowers/brainstorming`
- **THEN** 系统 SHALL 部署 tdd-spec 全部成员 + jt-codex + brainstorming
- **AND** manifest `followGroups` SHALL 为 `["tdd-spec"]`
- **AND** manifest `pinnedSkills` SHALL 为 `["custom/jt-codex", "community/obra/superpowers/brainstorming"]` (顺序可排序)
- **AND** tdd-spec group 的 skill SHALL **不**出现在交互勾选列表

#### Scenario: --follow-group 指定不存在的 group
- **WHEN** 用户执行 `skillsmgr deploy --follow-group nonexistent`
- **THEN** 系统 SHALL 报错 `Unknown group: nonexistent.  Run \`skillsmgr group list\` to see available groups.`
- **AND** 以非 0 退出码终止, 不写 manifest, 不部署

#### Scenario: 多个 --follow-group
- **WHEN** 用户执行 `skillsmgr deploy --follow-group tdd-spec --follow-group openspec -y`
- **THEN** manifest `followGroups` SHALL 包含两项, 顺序去重

### Requirement: deploy --refresh 按清单对齐
`skillsmgr deploy --refresh` SHALL 读取项目 manifest, 将项目的 `.agents/skills/` 对齐到 "followGroups 当前成员 ∪ pinnedSkills" 的期望集合.  refresh 不交互, 不 prompt.

对齐算法:
1. 读 manifest; 不存在则报错 "No deployment manifest found.  Run \`skillsmgr deploy\` first."
2. `expected = union(members(g) for g in followGroups) ∪ pinnedSkills`
   - followGroups 里的 group 不存在 → warn 并跳过该 group, 不删除 manifest 条目
   - pinnedSkills 里的 skill key 在 `~/.skills-manager/` 不存在 → warn 并跳过, 不删除 manifest 条目
3. `current = scan(.agents/skills/)`
4. `to_add = expected \ current`; `to_remove = (current \ expected) - unmanaged`
5. 按 manifest `mode` 执行 add / remove
6. 更新 manifest `deployedAt`

Unmanaged skill (存在于 `.agents/skills/` 但没有对应 `~/.skills-manager/` source) SHALL 保持不动.

#### Scenario: follow group 新增 skill 后 refresh 自动补
- **GIVEN** 项目 manifest `followGroups: ["tdd-spec"]`, tdd-spec 当前成员有 14 项 (含刚通过 update 新增的 `ts-debugging`)
- **AND** 项目 `.agents/skills/` 只有 11 个 tdd-spec 相关 skill (manifest 创建时的快照)
- **WHEN** 用户执行 `skillsmgr deploy --refresh`
- **THEN** 系统 SHALL 新增部署缺失的 3 个 skill (`ts-debugging`, `ts-ff-explore`, `ts-ff-propose`) 到 `.agents/skills/`
- **AND** 不改动 pinned 或 unmanaged skill
- **AND** manifest `deployedAt` 更新

#### Scenario: follow group 被删除 skill 后 refresh 自动移除
- **GIVEN** 项目 manifest `followGroups: ["tdd-spec"]`, 上游已从 tdd-spec group 移除 `ts-archive`
- **AND** 项目 `.agents/skills/ts-archive/` 仍存在
- **WHEN** 用户执行 `skillsmgr deploy --refresh`
- **THEN** 系统 SHALL 从 `.agents/skills/` 移除 `ts-archive`
- **AND** 不报错

#### Scenario: pinned skill 被 uninstall 后 refresh 跳过
- **GIVEN** 项目 manifest `pinnedSkills: ["custom/jt-codex", "custom/jt-gone"]`, `custom/jt-gone` 已在 `~/.skills-manager/` 被 uninstall
- **WHEN** 用户执行 `skillsmgr deploy --refresh`
- **THEN** 系统 SHALL 部署 `custom/jt-codex` (若未部署) 并 warn "pinned skill custom/jt-gone no longer exists, skipping"
- **AND** manifest 保持 pinnedSkills 原样 (不自动删条目)

#### Scenario: follow group 被用户删除后 refresh 跳过
- **GIVEN** 项目 manifest `followGroups: ["deleted-group"]`, groups.json 中无该 group
- **WHEN** 用户执行 `skillsmgr deploy --refresh`
- **THEN** 系统 SHALL warn "follow group deleted-group does not exist, skipping"
- **AND** 不移除 manifest 条目
- **AND** 不影响其它 followGroup 或 pinnedSkills 的处理

#### Scenario: 无 manifest 报错
- **WHEN** 用户在无 `.skills-manager/deployment.json` 的项目执行 `skillsmgr deploy --refresh`
- **THEN** 系统 SHALL 报错 "No deployment manifest found at <path>.  Run \`skillsmgr deploy\` first to create one."
- **AND** 以非 0 退出码终止, 不修改 `.agents/skills/`

#### Scenario: unmanaged skill 保持不动
- **GIVEN** 项目 `.agents/skills/` 有用户手动放入的 `my-custom/SKILL.md` (不在 `~/.skills-manager/` 索引中)
- **AND** manifest 正常
- **WHEN** 用户执行 `skillsmgr deploy --refresh`
- **THEN** `my-custom` SHALL 保留不动
- **AND** 其它 expected / current 差异正常处理

### Requirement: follow vs pinned 冲突优先 follow
同一 skill key 既在某个 `followGroups` 成员里, 又出现在 `pinnedSkills` 中时, SHALL 视为 follow 接管, 不重复部署, 不报错.  manifest 保留 pinnedSkills 原条目 (不自动清理), 留给用户下次显式 deploy 时规范化.

#### Scenario: 同 skill 既 follow 又 pinned
- **GIVEN** manifest `followGroups: ["tdd-spec"]`, `pinnedSkills: ["custom/tdd-spec/ts-apply"]`, tdd-spec group 包含 `custom/tdd-spec/ts-apply`
- **WHEN** refresh 执行
- **THEN** `ts-apply` 只被算一次 expected, 部署一次
- **AND** 不报错

### Requirement: deploy 完成后写入 manifest
普通 `skillsmgr deploy` (交互或 `--all` / `-y`) 完成部署后 SHALL 写入 / 更新 manifest.  写入规则:

- `pinnedSkills` = 本次交互勾选或 `--all` 全选的 skill key 集合 (去掉被 follow group 覆盖的)
- `followGroups` = 本次 `--follow-group` 指定的 group 名 (去重; 沿用上次 manifest 中 follow + 本次新增)
- `mode` = 本次部署模式 (与 `--copy` 对应)
- `deployedAt` = now

若已有 manifest:
- `pinnedSkills` 被本次结果**覆盖** (因为交互是当下快照; 若想保留旧 pinned, 用户应 `--refresh` 而不是 `deploy`)
- `followGroups` 取 **union(旧, 本次 --follow-group)**; 若用户想移除 follow, 需显式 `deploy --unfollow-group <name>` (本 change 不实现, 预留)

#### Scenario: 首次 deploy 无 follow
- **GIVEN** 无 manifest
- **WHEN** 用户执行 `skillsmgr deploy` 勾选 3 个 skill
- **THEN** manifest `pinnedSkills` SHALL 为这 3 个 key
- **AND** `followGroups` SHALL 为 `[]`

#### Scenario: 二次 deploy 覆盖 pinned
- **GIVEN** manifest 已存在 `pinnedSkills: [a, b, c]`
- **WHEN** 用户执行 `skillsmgr deploy` 重新勾选 `[b, d, e]`
- **THEN** manifest `pinnedSkills` SHALL 被覆盖为 `[b, d, e]`
- **AND** `.agents/skills/` 中的 `a`, `c` SHALL 被移除 (除非是 unmanaged)

#### Scenario: 带 --follow-group 的 deploy 并存量 follow
- **GIVEN** manifest `followGroups: ["openspec"]`
- **WHEN** 用户执行 `skillsmgr deploy --follow-group tdd-spec -y`
- **THEN** manifest `followGroups` SHALL 为 `["openspec", "tdd-spec"]` (union)

### Requirement: update 输出笼统刷新提示
`skillsmgr update` 在检测到 bundle sync 结果 `added > 0 || removedHard > 0 || removedKept > 0` 时, SHALL 在该 bundle 的摘要行后追加一行提示:

```
Note: projects following this bundle's group may need `skillsmgr deploy --refresh` to pick up changes.
```

提示为纯信息, 不交互, 不阻塞.  纯 up-to-date 的 bundle 不输出提示.  本 change **不**枚举具体项目路径 (见 Change 3).

#### Scenario: bundle 新增 skill 后的 update
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 源目录新增 1 个 skill
- **THEN** update 正常完成, 摘要行后输出笼统提示

#### Scenario: 全部 up-to-date 不提示
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 源目录无任何变化
- **THEN** 摘要行后 SHALL **不**输出该提示

#### Scenario: `--sync` 移除 skill 也触发提示
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec --sync`, 源目录删除了 1 个 skill
- **THEN** 摘要行后 SHALL 输出提示

### Requirement: deploy -g 全局模式不写 manifest
`skillsmgr deploy -g` (全局部署) SHALL **不**创建或修改项目 manifest.  全局部署无"项目"概念, 项目 manifest 与之无关.

#### Scenario: 全局 deploy 不影响当前目录 manifest
- **GIVEN** 当前目录是某项目, 可能已有 `.skills-manager/deployment.json`
- **WHEN** 用户执行 `skillsmgr deploy -g -a claude-code`
- **THEN** 系统 SHALL 按现有全局部署逻辑执行
- **AND** 当前目录的 manifest (若有) SHALL 保持不变
- **AND** 若当前目录无 manifest, SHALL **不**新建
