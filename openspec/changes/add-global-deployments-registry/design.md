## Context

Change 2 (`add-deployment-manifest`) 让每个项目自己知道"我 follow 了什么, pin 了什么".  但 `skillsmgr update` 完成后只能笼统提示, 无法定向到具体项目.  这让用户在多项目场景下很容易漏刷某个项目.

本 change 在用户目录加一张全局注册表, 作为 "哪些项目 deploy 了什么" 的索引.  注册表是 **派生数据** (可重建), 不代表真实状态 — 真实状态永远在各项目的 `skillsmgr-deploy.json` 里.  注册表的任务是加速反查, 不是真相源.

## Goals / Non-Goals

**Goals:**
- update 完成后精确提示 "这些项目受影响, 对应的 follow/pinned 状态"
- 提供 `deployments list` / `prune` / `remove` 子命令让用户掌控注册表
- 处理项目路径失效 (项目删了/移动了) 的情况: 标记 + 指引用户手动 prune
- 注册表是可重建的: 破坏后不影响项目本身部署; 下次 deploy 自动重建对应条目

**Non-Goals:**
- 不自动清理路径失效条目 (用户可能只是临时 rename 或把项目移到外接硬盘)
- 不提供 `deployments adopt` 批量扫描已部署项目 (延后; 初期可接受"下次 deploy 时补录")
- 不跨机器同步注册表 (本机索引即可)
- 不在 update 时主动去各项目 refresh (尊重多项目自治; 用户自己决定何时 refresh)
- 不记录 agents 配置 (与 manifest 保持一致)

## Decisions

### Decision 1: 注册表 schema 版本化

```json
{
  "version": "1.0",
  "deployments": {
    "<absolute-path>": {
      "mode": "link" | "copy",
      "followGroups": ["..."],
      "pinnedSkills": ["..."],
      "lastDeployedAt": "ISO"
    }
  }
}
```

每个条目的内容**与项目 manifest 同步**, 由 deploy/refresh 写入.  version 字段便于未来演进.

**替代方案**: 只记项目路径 + 需要时读 manifest → update 时需要 open 所有项目文件, IO 膨胀; 且路径失效时无法显示历史信息.  不选.

### Decision 2: deploy/refresh 写入注册表

一处写入两个地方:
1. 项目 `skillsmgr-deploy.json` (Change 2 行为)
2. 全局 `~/.skills-manager/deployments.json` 里对应条目 (本 change 新增)

为保证两者一致, 实现上由 `DeploymentManifestService` 内部协调调用 `DeploymentsRegistryService`, 外部看是单次 "write" 调用.  任一失败 → 报错, manifest 优先写 (项目侧是真相源), registry 失败只 warn (派生数据, 不 block 用户).

### Decision 3: 路径失效的处理策略

deploy/refresh 的前提是项目路径存在 (用户在项目内运行命令).  `deployments list` / `update` 提示时遍历注册表条目, 对每个 path 做 `fileExists` 检查:
- 路径存在 → 正常显示 (follow/pinned 分类)
- 路径不存在 → 标记 `(path missing)`, 提示可用 `deployments prune` 清理

`prune` 交互式确认要删哪些; `prune -y` 跳过确认删除所有失效.  `deployments remove <path>` 精准删除指定路径的条目.

### Decision 4: update 提示升级

Change 2 的笼统提示改为:

```
✓ Updated tdd-spec: + ts-new-skill

Projects using this bundle's group:
  follow (will auto-add on next refresh):
    - /Users/jt/projects/a
    - /Users/jt/projects/c
  pinned (re-deploy to include):
    - /Users/jt/projects/b
  (path missing, run `skillsmgr deployments prune`):
    - /Users/jt/old-project
```

只显示**直接相关**的项目:
- 若 bundle 新增 skill (diff.added), 列出 follow 该 group 的项目; pinned 里包含该 group 任一 skill 的项目也列出 (re-deploy 才能含新 skill)
- 若 bundle 移除 skill (`--sync`), 列出 follow 的项目 (需要 refresh 清理); pinned 里包含被移除 skill 的项目也列出 (refresh 会 warn)

如果没有任何项目使用该 bundle/group, 不输出项目列表, 只保留单行摘要 (正常结束).

### Decision 5: update 查询逻辑

`findAffectedByBundle(bundleId)` 或 `findAffectedByGroup(groupName)`:
- 确定该 bundle 对应的 auto-group 名 (local-batch: basename(bundle.url); git: 无默认 group, 可能 user 显式指定)
- 遍历注册表:
  - follow: 若 `groupName in entry.followGroups` → follow bucket
  - pinned: 若 entry.pinnedSkills 中任一 key 属于该 group/bundle → pinned bucket
- bundle 若无 auto-group 对应, 则只走 pinned bucket (按 skill key 直接反查)

### Decision 6: `deployments` 子命令结构

```
skillsmgr deployments            # 默认 list
skillsmgr deployments list       # 列出全部, 标识失效
skillsmgr deployments prune      # 交互确认清理失效
skillsmgr deployments prune -y   # 跳过确认
skillsmgr deployments remove <path>  # 精准删除
```

与 `skillsmgr group` 子命令风格对齐.

### Decision 7: 手工编辑注册表的鲁棒性

用户可能手动改 `deployments.json`.  服务层读取时:
- 非法 JSON → 报错, 拒绝继续, 指引用户修复或删除
- 字段缺失 → 按默认值补全 (mode 默认 "link", 数组默认空)
- 未知字段 → 忽略 (向前兼容)
- 写入时原子 (tmp + rename)

## Risks / Trade-offs

- **[风险]** 注册表被破坏或删除 → 行为退化为 Change 2 的笼统提示, 不影响部署; 下次 deploy 自动重建对应条目.  可接受.
- **[风险]** 项目 symlink / 绝对路径不稳定 (例如用 pnpm workspaces) → 多条目指向实质同一项目.  mitigation: 写入时 `fs.realpathSync` 归一化; `list` / update 遍历时去重
- **[风险]** 隐私: 绝对路径泄露本地文件结构 → 注册表仅本地可读, 不传输.  README 明确说明.
- **[风险]** 用户在一个项目反复切 mode / follow, 注册表多次覆写 → 可接受, manifest 和 registry 保持一致就行
- **[trade-off]** 路径失效不自动清理 → 可能累积脏数据, 但让 user 可控 (可能只是临时不可达).  由 `prune` 显式处理

## Migration Plan

- 无破坏性; 从 Change 2 的笼统提示升级为精确提示, 提示内容变好
- 已有用户: 
  - 有 `skillsmgr-deploy.json` 的项目但无全局注册表条目 → 下次 `deploy` 或 `deploy --refresh` 时回填
  - 用户可选 `skillsmgr deployments adopt` (本 change 不做, 延后扩展)
- 回滚: 删除 `~/.skills-manager/deployments.json` 即可; 项目侧 manifest 无影响

## Open Questions

- 是否要在 `skillsmgr update` 完成时自动提议 "run refresh in these projects now"? → 倾向不做, 尊重用户节奏; 可以在 `deployments list` 提供 "stale" 标记 (project lastDeployedAt 早于 group members 变化时刻) 供将来扩展
- Windows 路径大小写不敏感 → realpath 应已经处理, 但测试要覆盖
- `deploy -g` 全局部署是否需要一个 "user-level" 注册表条目? → 当前范围不扩展, 全局仍无 manifest (Change 2 的决策)
