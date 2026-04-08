# Tasks: w02-add-bundle-tracking

## 1. 类型定义

- [x] 1.1 在 `src/types.ts` 新增 `BundleType = 'local-batch' | 'git' | 'zip'`
- [x] 1.2 新增 `SelectionMode = 'all' | 'subset'`
- [x] 1.3 新增 `BundleInfo` interface (type, url, selectionMode, members, installedAt, updatedAt)
- [x] 1.4 新增 `Bundle = BundleInfo` alias (用于存储)
- [x] 1.5 更新 `SourcesData` interface: 新增 `bundles: Record<string, Bundle>` 字段, 把 version 类型改为 `'1.0' | '2.0'`

## 2. URL 归一化辅助

- [x] 2.1 在 `src/utils/source-detection.ts` 或新建 `src/utils/url-normalize.ts` 添加 `normalizeGitUrl(input)` 函数: 去 `.git` 后缀, ssh → https 等价转换, host 小写
- [x] 2.2 添加 `normalizeLocalPath(input)` 函数: 展开 `~`, 转绝对路径
- [x] 2.3 添加 `makeBundleId(type, normalizedUrl)` 函数: 返回 `{type}:{url}` 格式
- [x] 2.4 单元测试: 每种归一化规则的边界 case

## 3. SourcesService bundle CRUD

- [x] 3.1 修改 `src/services/sources.ts`: `SourcesData` 类型和默认值包含 `bundles: {}`
- [x] 3.2 新增 `getAllBundles()`, `getBundle(id)` 方法
- [x] 3.3 新增 `addBundle(id, info)`: 保留已有 `installedAt`, 更新 `updatedAt`
- [x] 3.4 新增 `updateBundleMembers(id, members)`: 更新 members 和 updatedAt
- [x] 3.5 新增 `updateBundleTimestamp(id)`: 仅更新 updatedAt
- [x] 3.6 新增 `removeBundle(id)`: delete 操作, 不级联删成员
- [x] 3.7 新增 `findBundleByUrl(normalizedUrl, type)`: 按 id 构造查找
- [x] 3.8 `save()` 改为原子写: 写 `sources.json.tmp` 后 rename 为 `sources.json`

## 4. V1 → V2 迁移逻辑

- [x] 4.1 `SourcesService.load()` 在读到 version `"1.0"` 或缺失 version 时触发迁移
- [x] 4.2 实现 `migrateV1ToV2(data)`: 按 `(type, url, installMethod)` 聚合 sources 生成 bundles
- [x] 4.3 单成员组不建 bundle
- [x] 4.4 多成员组生成 bundle, selectionMode 统一为 `'all'`
- [x] 4.5 bundleId 通过 `makeBundleId` 生成, url 归一化
- [x] 4.6 migration 完成后立即 save 写回 v2 格式
- [x] 4.7 migration 写回失败时, 内存中仍返回 v2 结构, 下次 load 再尝试写

## 5. SourcesService 测试

- [x] 5.1 `src/services/sources.test.ts`: 新增 bundle CRUD 测试 (addBundle, getBundle, updateBundleMembers, removeBundle, findBundleByUrl)
- [x] 5.2 新增 migration 测试: 给 v1 fixture (单 skill, 多 skill batch, 混合), 验证迁移后 bundle 条目正确
- [x] 5.3 测试原子写: mock fs 写失败, 验证原文件保持完整
- [x] 5.4 测试 findBundleByUrl 的归一化匹配 (ssh vs https 等价, `.git` 后缀等价)

## 6. promptSkillsToInstall 返回类型变化

- [x] 6.1 修改 `src/utils/prompts.ts` 的 `promptSkillsToInstall` 签名: 返回 `Promise<{ names: string[], isAll: boolean }>`
- [x] 6.2 内部实现计算 `isAll`: 比较选中的非 locked count 与可用非 locked 总数
- [x] 6.3 locked skill 不计入 isAll 判断 (locked 是已安装的保护态)
- [x] 6.4 单元测试: 全选/部分选/空选/含 locked 的各种 case

## 7. selectSkills 传递 isAll

- [x] 7.1 修改 `src/commands/install-utils.ts` 的 `selectSkills`: 返回类型改为 `Promise<{ skills: InstallableSkill[], isAll: boolean }>`
- [x] 7.2 `--all` flag 路径返回 `isAll: true`
- [x] 7.3 `-s/--skill` 显式列表路径返回 `isAll: false` (明显是 subset)
- [x] 7.4 只有 1 个可选的路径返回 `isAll: true`
- [x] 7.5 全部已安装的路径返回 `{ skills: [], isAll: false }`
- [x] 7.6 交互式路径透传 `promptSkillsToInstall` 的 `isAll`

## 8. install 命令写 bundle

- [x] 8.1 修改 `src/commands/install-local.ts` 的 `installFromLocalDirBatch`:
  - 在现有 sourceKeys 收集逻辑后, 计算 `bundleId = makeBundleId('local-batch', absPath)`
  - 在 InstallResult 中新增 `bundleInfo?: { id, info }` 字段
- [x] 8.2 修改 `installFromLocalDir` (单 skill 路径): 不写 bundle (保持 bundleInfo undefined)
- [x] 8.3 修改 `installFromZip` / `installFromRemoteZip`: 写 `type: 'zip'` bundle
- [x] 8.4 修改 `installViaGitClone`: 写 `type: 'git'` bundle, url 归一化
- [x] 8.5 修改 `src/commands/install.ts` 的 `executeInstall`: 当 `result.bundleInfo` 存在时, 调用 `sourcesService.addBundle(id, info)`
- [x] 8.6 selectionMode 从 `selectSkills` 返回的 `isAll` 推断 (或 `--all` / `-s` flag 直接推断)

## 9. Install 测试更新

- [x] 9.1 `src/commands/install.test.ts`: 新增 bundle 写入验证
- [x] 9.2 `src/commands/install-git.test.ts`: 验证 git install 后 bundles 有 git 条目
- [x] 9.3 `src/commands/install-local.test.ts` (若存在): 验证 batch install 后 bundles 有 local-batch 条目
- [x] 9.4 验证单 skill install 不写 bundle
- [x] 9.5 验证 registry install 不写 bundle
- [x] 9.6 验证 selectionMode 推断规则的所有 case

## 10. 回归验证

- [x] 10.1 运行 `pnpm test` 全部通过
- [x] 10.2 手动验证 v1 → v2 迁移: 保留一份 v1 sources.json, 跑一次 `skillsmgr list`, 检查迁移后结构
- [x] 10.3 手动验证 `skillsmgr install ./spec-tdd` 写入 local-batch bundle
- [x] 10.4 手动验证 update / uninstall 行为与 w01 完成状态一致 (bundle 不被使用, 保持兼容)
- [x] 10.5 手动验证 `skillsmgr list` 输出无变化

## 11. 文档与 lint

- [x] 11.1 更新 CHANGELOG 或 release notes: sources.json 升级 v1 → v2, 提醒不要回退旧版本
- [x] 11.2 运行 `pnpm lint` / `pnpm typecheck` 确认无错误
- [x] 11.3 运行 `openspec validate w02-add-bundle-tracking --strict` 确认 spec 无效
