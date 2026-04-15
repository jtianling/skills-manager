## Context

当前 deploy 的部署状态只能通过扫描 `.agents/skills/` 目录反推 (DeploymentScanner), 无法区分:
- "我就是要这几个 skill, 以后 group 涨跌跟我无关" (pinned)
- "我要跟随 tdd-spec group 的演进" (follow)

用户手动到 `.claude/skills/` 里查看也只看到一堆 symlink, 没有"跟随"语义.  一旦 `~/.skills-manager/` 里 bundle/group 的内容变了, 项目侧无法自动感知, 只能下次手动重新 `deploy` 全部挑一遍.

本 change 在项目根写一个可读清单, 让 follow/pinned 语义成为一等公民, 并提供一个"按清单对齐"的 refresh 命令.  这是为后续 global deployments registry (Change 3) 打基础.

## Goals / Non-Goals

**Goals:**
- 区分 follow 和 pinned 语义, 各自可独立使用或组合
- 单一文件项目根 `.skills-manager/deployment.json`, schema 简单明确
- `deploy --refresh` 幂等, 可重复运行, 不依赖任何交互
- 交互式 `deploy` 不引入 follow UX (保持最小改动), follow 仅由 CLI flag 声明
- update 输出笼统提示, 不强制推动用户 (尊重多项目自治)

**Non-Goals:**
- 不改动交互式 UI (不加"follow entire group"选项); 该 UX 延后
- 不实现全局 deployments registry (Change 3 独立处理)
- 不支持 `deploy -g` (全局) 写入 manifest; 全局部署延后
- 不支持 agent 差异化 (manifest 里不记 per-agent 选择, 因为现有 deploy 每次用当前 `configured tools` 或 `--agent` 统一应用)
- 不迁移已部署的项目 (没有 manifest 就等用户下次 deploy 时写入; 无侵入)

## Decisions

### Decision 1: manifest schema 最小化

```json
{
  "mode": "link",
  "followGroups": ["tdd-spec", "openspec"],
  "pinnedSkills": [
    "custom/openspec/openspec-propose",
    "community/obra/superpowers/brainstorming"
  ],
  "deployedAt": "2026-04-15T09:00:00.000Z"
}
```

- `mode`: 部署模式 (link/copy), 下次 refresh 沿用, 避免与当下混用
- `followGroups`: 使用 group 名 (不是 bundle id), 因为 group 是用户可见可控的一等概念.  本地 batch 和 `--group` 显式指定的 group 都适用.
- `pinnedSkills`: skill key 格式 `{source}/{...}/{name}`, 与 `sources.json` / `groups.json` 保持一致
- `deployedAt`: 诊断用, 非行为输入

**替代方案 A**: 记 bundle id 而非 group 名 → bundle id 形如 `local-batch:/path`, 不是用户概念, 且 bundle 不一定有同名 group.  不选.

**替代方案 B**: 记部署过的每个 agent → 每个 agent 可能期望不同 skill 子集.  → 当前 deploy 行为是"选中的 skill 全量应用到选中的 agents", 不存在 per-agent 差异.  不需要.

### Decision 2: follow vs pinned 的冲突规则

同一个 skill key 既在某个 followGroup 的当前成员里, 又在 pinnedSkills 里 → **follow 优先**.  pinnedSkills 里冗余的 key 不视为错误, 但 refresh 时不强制再单独保留 (follow 已经包含它).

```
expected_set = union(
  ∪ members(group) for group in followGroups,
  pinnedSkills
)
```

### Decision 3: --follow-group 的 UX

```
# 纯 follow
skillsmgr deploy --follow-group tdd-spec --follow-group openspec

# 纯 pinned (交互式)
skillsmgr deploy

# 混合: follow tdd-spec, 交互挑其它作为 pinned
skillsmgr deploy --follow-group tdd-spec

# 组合 --all: 本次完成后把选中集写为 pinnedSkills
skillsmgr deploy --all
```

交互模式下, followGroups 指定的 group 的 skill **不**出现在勾选列表里 (因为它们已由 follow 接管), 避免混淆.

**替代方案**: 交互 UI 里显式"follow entire group: tdd-spec"选项 → 本次不做 (见 Non-Goals).

### Decision 4: refresh 的原子性和冲突处理

`deploy --refresh` 步骤:
1. 读取 `.skills-manager/deployment.json`, 无文件 → 报错指引 "Run `skillsmgr deploy` first to create the manifest."
2. 解析 followGroups + pinnedSkills, 计算 `expected_set` (跳过已删除的 group, warn 但不 fail)
3. 扫描 `.agents/skills/` 当前状态, 计算 `current_set`
4. 计算 `to_add = expected \ current`, `to_remove = current \ expected - unmanaged`
5. unmanaged skill (`.agents/skills/` 里但不在 ~/.skills-manager/ 有对应 source 的) 保持不动
6. 按 manifest.mode 执行 add/remove, 更新 manifest 的 deployedAt
7. 输出摘要

### Decision 5: update 后的笼统提示

`executeUpdateWithOptions` 在 bundle sync 返回时, 若 `result.added > 0 || result.removedHard > 0 || result.removedKept > 0`, 输出一行提示:

```
Note: if projects follow this bundle's group, run `skillsmgr deploy --refresh` in each to pick up changes.
```

不枚举具体项目路径 (留给 Change 3).  不强制停顿, 不交互.

### Decision 6: manifest 位置 `.skills-manager/deployment.json`

- 放在项目根 `.skills-manager/` 子目录而非根 `.deployment.json`, 留出将来扩展空间 (未来可能再加 `cache.json`, `lock.json` 等)
- 目录不存在时自动创建
- 建议用户 `.gitignore` 加 `.skills-manager/`, 但**不强制**, manifest 可入仓 (项目标准化场景): 如果用户 commit manifest, 多机器执行 `deploy --refresh` 可复现项目部署状态.  这是额外收益

## Risks / Trade-offs

- **[风险]** `followGroups` 里的 group 被 user 后来删除 → refresh 时跳过 + warn, 不 fail.  manifest 保留 group 名 (用户可能只是临时删, 之后重建)
- **[风险]** `pinnedSkills` 里的 skill key 在 `~/.skills-manager/` 不存在 (被 uninstall) → refresh 时跳过 + warn, 不 fail.  manifest 保留 key
- **[风险]** 用户手动改了 `.agents/skills/` 下某 skill (手动加 / 删文件) → refresh 时根据 "unmanaged" 判定, 不覆盖用户手动加的, 但会移除他手动加的 symlink 么?  → **不移除**, 保留 unmanaged 语义, 和现在 deploy 的 unmanaged 判定一致
- **[风险]** manifest 与实际部署状态不一致 (例如用户手动 `deploy` 后又手动删了 `.agents/skills/<name>/`) → 下次 refresh 会按 manifest 重新创建, 这是 feature 不是 bug
- **[trade-off]** 笼统提示有时会显得"很吵" (每次 update 都提示一次).  → 可接受, 因为有实质变化才提示; 纯 up-to-date 不提示
- **[trade-off]** 没有全局指路 → 用户要记得哪些项目用了这个 group.  接受, 由 Change 3 解决

## Migration Plan

- 无破坏性变更
- 已部署项目: 没 manifest 时, 现有交互式 `deploy` 仍可用, 下次部署自动创建 manifest
- `deploy --refresh` 在无 manifest 时给出明确指引 (error message 非 0 exit)
- 回滚: 删除项目的 `.skills-manager/deployment.json` 即可; manifest 是纯附加, 不影响已部署文件

## Open Questions

- 交互式 UI 什么时候加 "follow entire group" 选项?  → 预计 Change 3 之后, 当有跨项目智能提示后, follow 价值被放大, 再考虑改交互
- `--follow-group` 指定的 group 名不存在时如何处理?  → 应报错 `Unknown group: X.  Run skillsmgr group list.`, 但允许 `--follow-group` 和常规交互混合时, 如果只是某一个 group 名错, 是 fail-fast 还是 warn-skip?  → fail-fast, 避免写入错误 manifest
