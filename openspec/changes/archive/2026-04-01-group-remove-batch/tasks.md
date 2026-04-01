## 1. 批量移除核心逻辑

- [x] 1.1 在 `group.ts` 中新增 `removeGroupSkills(targetGroup, sourceGroup, skillKeys, service)` 函数 — 遍历 skillKeys, 对每个 key 尝试从 targetGroup 移除, 记录 removed/skipped 结果
- [x] 1.2 在 `group.ts` 中新增 `removeRepoSkills(targetGroup, ownerRepo, skills, service)` 函数 — 遍历 repo skills, 构建 key 后尝试从 targetGroup 移除

## 2. executeGroupRemove 重写

- [x] 2.1 重写 `executeGroupRemove`: 复用 `resolveGroupAddIdentifier` 解析标识符, 按 candidate type 分发到 single remove / removeGroupSkills / removeRepoSkills
- [x] 2.2 单 skill 移除保持现有行为和输出格式不变
- [x] 2.3 batch 输出格式与 `group add` 对称: "Removed N skills from group/repo 'X' in 'Y':" + 每行结果

## 3. 测试

- [x] 3.1 在 `group.test.ts` 中新增测试: `group remove` 按 group 批量移除 (交集移除, 非交集跳过)
- [x] 3.2 在 `group.test.ts` 中新增测试: `group remove` 按 owner/repo 批量移除
- [x] 3.3 在 `group.test.ts` 中新增测试: 空源 group, 自引用报错

## 4. 验证

- [x] 4.1 运行 `pnpm test` 确保所有测试通过
- [x] 4.2 `pnpm build` 确保编译成功
