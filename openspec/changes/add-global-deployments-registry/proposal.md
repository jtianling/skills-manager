## Why

Change `add-deployment-manifest` 引入了项目侧清单, update 完成后输出笼统提示 "可能需要去相关项目跑 `skillsmgr deploy --refresh`".  但笼统提示价值有限 — 用户记不清哪些项目 follow 了这个 group, 或者哪些项目 pinned 了哪些 skill, 很容易漏刷某个项目.

本 change 增加**全局 deployments 注册表** `~/.skills-manager/deployments.json`, 在每次 `deploy` / `deploy --refresh` 时记录 "哪个项目路径 / 用的什么 mode / follow 了哪些 group / pin 了哪些 skill".  然后 `skillsmgr update` 能精确提示:

```
✓ Updated tdd-spec: + ts-new-skill

Projects to refresh:
  ✓ /Users/jt/projects/a     (follow: will auto-add on next refresh)
  · /Users/jt/projects/b     (pinned: re-deploy to include new skill)
  ⚠ /Users/jt/old-project    (path missing, run `skillsmgr deployments prune`)
```

并提供 `skillsmgr deployments list` / `skillsmgr deployments prune` 子命令, 便于用户查看和清理.

## What Changes

- **新增** `~/.skills-manager/deployments.json` 全局注册表, schema:
  ```json
  {
    "version": "1.0",
    "deployments": {
      "/absolute/path/to/project": {
        "mode": "link" | "copy",
        "followGroups": ["tdd-spec"],
        "pinnedSkills": ["custom/jt-codex", "..."],
        "lastDeployedAt": "ISO timestamp"
      }
    }
  }
  ```
- **修改** `skillsmgr deploy` 完成后, 除写入项目 manifest (Change 2 的行为) 外, 同步更新全局注册表对应项目路径条目
- **修改** `skillsmgr deploy --refresh` 完成后, 同步更新全局注册表条目的 `lastDeployedAt`
- **修改** `skillsmgr update` 的 bundle 完成提示: 查全局注册表, 找到 followGroups 或 pinnedSkills 涉及该 bundle/group 的项目, 按 follow / pinned / 路径失效分组输出
- **新增** `skillsmgr deployments list` 子命令, 列出所有注册项目, 标识路径失效
- **新增** `skillsmgr deployments prune` 子命令, 移除路径已不存在的项目条目 (交互确认, `-y` 跳过)
- **新增** `skillsmgr deployments remove <path>` 子命令, 手动移除某项目条目 (不删除项目本身的 manifest)

## Capabilities

### New Capabilities

- `global-deployments-registry`: 全局注册表的 schema, 读写规则, 与 deploy/update 的集成, `deployments` 子命令族

### Modified Capabilities

- `deployment-manifest`: 明确 deploy/refresh 完成后 SHALL 同步更新全局注册表; update 的提示文案从 Change 2 的笼统提示升级为 "枚举受影响项目 + 分组 follow/pinned/失效"

## Impact

- `src/services/deployments-registry.ts` (新): 读写 `~/.skills-manager/deployments.json`, 提供 `recordDeploy`, `remove`, `list`, `findAffectedByGroup`, `prune` 等方法
- `src/commands/deploy.ts`: deploy 和 refresh 完成后调用 `deploymentsRegistry.recordDeploy(projectRoot, manifest)`
- `src/commands/deployments.ts` (新): 实现 `list` / `prune` / `remove` 子命令
- `src/index.ts`: 注册 `deploymentsCommand`
- `src/commands/update.ts`: 用 `findAffectedByGroup` 输出精确提示
- 新增测试: `src/services/deployments-registry.test.ts`, `src/commands/deployments.test.ts`, `src/commands/update.test.ts` (新 scenario)
- 兼容性: 首次运行无注册表 → 自动创建; 已有用户升级后, 旧已部署的项目要等下次 `deploy` 或 `deploy --refresh` 才被记录 (可选 `deployments adopt` 命令扫 ~/.claude 等目录回填, 本 change 不做)
- 隐私: 注册表记录本地绝对路径.  不上传, 不同步.  README 说明
