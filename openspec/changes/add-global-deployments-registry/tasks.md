## 1. 注册表服务层

- [x] 1.1 新增 `src/services/deployments-registry.ts`, 导出 `DeploymentsRegistry`, `DeploymentEntry` 接口和 `DeploymentsRegistryService` 类
- [x] 1.2 实现 `readRegistry()`: 读 `~/.skills-manager/deployments.json`; 不存在返回空壳 `{ version: '1.0', deployments: {} }`; 非法 JSON 抛明确错误
- [x] 1.3 实现 `writeRegistry(registry)`: 原子写入 (tmp + rename), 目录不存在自动创建
- [x] 1.4 实现 `recordDeploy(projectPath, entry)`: realpath 归一化后以 path 为 key upsert
- [x] 1.5 实现 `remove(projectPath)`: realpath 归一化后删除条目; 不存在抛错
- [x] 1.6 实现 `list()`: 返回所有条目数组, 按路径排序; 附带 `exists` 字段 (由 `fileExists` 判定)
- [x] 1.7 实现 `findAffectedByGroup(groupName, skillKeysOfGroup)`: 遍历条目返回 `{ follow: Entry[], pinned: Entry[], missing: Entry[] }`
- [x] 1.8 实现 `pruneStale()`: 移除所有 `fileExists === false` 的条目, 返回被移除的 path 列表

## 2. Deploy / refresh 集成

- [x] 2.1 在 `src/commands/deploy.ts` 完成 manifest 写入后 (Change 2 引入), 追加 `deploymentsRegistry.recordDeploy(projectRoot, entryFromManifest)` 调用
- [x] 2.2 注册表写入失败时用 `console.warn` 输出, 不抛错, 不改变 deploy 退出码
- [x] 2.3 `deploy --refresh` 结束后同样调用 `recordDeploy` 更新 `lastDeployedAt`
- [x] 2.4 `deploy -g` 分支**不**调用 `recordDeploy`
- [x] 2.5 确认 Change 2 的 `executeDeployRefresh` 在对齐完成后同步调用

## 3. Update 提示升级

- [x] 3.1 修改 `src/commands/update.ts` 中 `printBundleUpdateSummary` 调用后的提示逻辑
- [x] 3.2 对 local-batch: 由 `basename(bundle.url)` 得 auto-group 名; 对 git bundle: 查 `groups.json` 反查该 bundle 的 member skill 所属 groups (可能多个; 本次简化为"不主动识别 git bundle 的 follow 语义", 只走 pinned 反查)
- [x] 3.3 调用 `findAffectedByGroup(groupName, skillKeysOfBundle)`, 格式化输出分组列表
- [x] 3.4 注册表读失败时 warn + 退回 Change 2 的笼统提示

## 4. deployments 子命令

- [x] 4.1 新增 `src/commands/deployments.ts`, 导出 `deploymentsCommand` (Commander 实例, 含 `list`, `prune`, `remove` 子命令)
- [x] 4.2 `list`:
  - 4.2.1 默认 human-readable 表格输出: path, mode, followGroups, pinnedSkills count, lastDeployedAt (相对时间), missing 标识
  - 4.2.2 `--json` 结构化输出
  - 4.2.3 空时输出友好提示
- [x] 4.3 `prune`:
  - 4.3.1 列出所有 missing 条目
  - 4.3.2 无失效 → "No stale entries found."
  - 4.3.3 有失效 → prompt 确认 (default No)
  - 4.3.4 `-y` 跳过 prompt
  - 4.3.5 删除 + 输出摘要
- [x] 4.4 `remove <path>`:
  - 4.4.1 realpath 归一化后匹配; 不存在报错非 0 退出
  - 4.4.2 成功输出 "Removed <path> from registry."
- [x] 4.5 在 `src/index.ts` 注册 `deploymentsCommand`

## 5. 测试

- [x] 5.1 `src/services/deployments-registry.test.ts`:
  - 5.1.1 read/write 往返
  - 5.1.2 realpath 归一化 (可用 tmp dir + symlink 测)
  - 5.1.3 `recordDeploy` upsert 语义
  - 5.1.4 `remove` 不存在抛错
  - 5.1.5 `findAffectedByGroup`: follow / pinned / missing 正确分组
  - 5.1.6 `pruneStale`: 只删 missing
  - 5.1.7 非法 JSON 读取抛错
  - 5.1.8 空注册表 list 返回空数组
- [x] 5.2 `src/commands/deployments.test.ts`:
  - 5.2.1 `list` 输出包含 path/mode/groups
  - 5.2.2 `list --json` 结构化
  - 5.2.3 `prune` 交互确认 (mock prompt)
  - 5.2.4 `prune -y` 跳过 prompt
  - 5.2.5 `prune` 无失效时友好提示
  - 5.2.6 `remove` 成功
  - 5.2.7 `remove` 路径未注册报错
- [x] 5.3 `src/commands/update.test.ts` 新增:
  - 5.3.1 update bundle 有变化 + 注册表有 follow 项目 → 输出分组
  - 5.3.2 update bundle 有变化 + 注册表无相关项目 → 退回笼统提示
  - 5.3.3 update bundle + 注册表损坏 → warn + 退回笼统提示
  - 5.3.4 update 包含 missing 项目 → 分组中出现 missing bucket
- [x] 5.4 `src/commands/deploy.test.ts` 扩展:
  - 5.4.1 deploy 完成后注册表新增/更新条目
  - 5.4.2 refresh 后 lastDeployedAt 更新
  - 5.4.3 deploy -g 不写注册表
  - 5.4.4 注册表写入失败不阻塞 deploy
- [x] 5.5 `pnpm test` 全量回归通过

## 6. CLI 帮助与文档

- [x] 6.1 `skillsmgr deployments --help` / `list` / `prune` / `remove` 各自 help 文本明确
- [x] 6.2 README (若有相关章节) 新增 "Deployments Registry" 小节, 说明注册表用途 + 隐私 (仅本地, 不上传)
- [x] 6.3 CLAUDE.md 或项目首页简短提及 (按项目既有约定)

## 7. 归档准备

- [x] 7.1 手工验证完整链路:
  - 在两个不同项目 deploy: 一个 `--follow-group tdd-spec`, 另一个挑选几个 pinned
  - `deployments list` 查看
  - 源目录新增 skill → `skillsmgr update ./tdd-spec` → 输出 follow/pinned 分组
  - 手动 mv 掉一个项目目录 → update 显示 missing; `deployments prune` 清理
- [x] 7.2 commit 信息 `feat: global deployments registry with precise update reminders`
- [x] 7.3 `openspec verify add-global-deployments-registry` 通过
