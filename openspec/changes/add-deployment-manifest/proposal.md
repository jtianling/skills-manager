## Why

`skillsmgr deploy` 目前是**无状态**的: 交互式选择完即结束, 没有任何"这次部署了什么"的持久记录.  结果是:

- `skillsmgr update ./tdd-spec` 给 bundle 加了新 skill, 同名 group 里也有了 (见 change `fix-update-bundle-group-sync`), 但**已经在其它项目里部署过这个 group 的项目完全不知情**, 项目的 `.claude/skills/` 里不会出现新 skill.
- 想让用户在每个项目"跟随"一个 group 的未来变化, 还是"钉住"当下选中的那批 skill, 完全无从表达.

本 change 引入项目侧 deployment manifest, 区分 **follow (追随 group)** 和 **pinned (钉住选中)** 语义, 并增加 `deploy --refresh` 手动同步命令.  update 命令新增一条笼统提示, 指引用户去对应项目 refresh (智能指路留给后续 change).

## What Changes

- **新增** 项目根 `skillsmgr-deploy.json` 清单文件, 结构:
  ```json
  {
    "mode": "link" | "copy",
    "followGroups": ["tdd-spec"],
    "pinnedSkills": ["custom/openspec/openspec-propose", "..."],
    "deployedAt": "ISO timestamp"
  }
  ```
- **新增** `skillsmgr deploy --follow-group <name>` CLI flag.  可重复.  把 group 标记为 follow, 部署该 group 当前全部成员.
- **新增** `skillsmgr deploy --refresh` 命令行为.  无交互, 读取项目 manifest, 将当前项目 `.agents/skills/` 对齐到 "follow groups 当前成员 ∪ pinned skills" 的理想集合.
- **修改** `skillsmgr deploy` (交互模式) 在完成部署后写入 manifest.  默认把本次选中的 skill 写为 `pinnedSkills`; `--follow-group` 指定的 group 写为 `followGroups`; 两者可组合.
- **修改** `skillsmgr update` 在检测到 bundle members 有新增/移除时, 输出一行提示 "Projects deploying this bundle's group may need `skillsmgr deploy --refresh` to pick up changes." (笼统提示, 本次不做项目路径枚举)
- `deploy -g` (全局部署) 不写 project-local manifest, 本次范围之外 (后续 change 可扩展 user-level manifest)
- 交互 UI 本次**不**改动 (维持勾选 → pinned 语义); follow 语义仅通过 CLI flag 声明, 保持最小改动

## Capabilities

### New Capabilities

- `deployment-manifest`: 项目侧部署清单的 schema, 读写, follow/pinned 语义, `--follow-group` 和 `--refresh` 的行为定义, 以及 update 完成后的笼统提示

### Modified Capabilities

(无; update 的提示改动放进新 capability 内的 "update reminder 集成" 需求, 避免跨多个 spec 改动)

## Impact

- `src/commands/deploy.ts`: 新增 `--follow-group` 和 `--refresh` 选项处理; 部署完成后写 manifest
- `src/services/deployment-manifest.ts` (新文件): Manifest 读写, 规范化, 合并逻辑
- `src/services/deployer.ts`: `--refresh` 需要一个 "对齐到理想集合" 的方法 (可能是新的 `syncFromManifest`)
- `src/commands/update.ts` (或 `src/services/bundle-manager.ts` 调用处): 检测 members 变化后追加一行提示
- 新增测试: `src/services/deployment-manifest.test.ts`, `src/commands/deploy.test.ts` (新增 flag 和 refresh 行为)
- 向后兼容: 现有已部署项目没有 manifest → 下一次 `deploy` 时被创建; `deploy --refresh` 在无 manifest 时报错指引用户先跑一次普通 deploy
- 用户 `.gitignore` 建议加 `skillsmgr-deploy.json` (design 里讨论)
