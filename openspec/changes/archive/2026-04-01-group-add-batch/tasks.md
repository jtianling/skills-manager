## 1. name 冲突检测

- [x] 1.1 在 `group.ts` 中添加 `checkNameConflict(targetGroupKeys, newKey)` 函数: 从 key 提取 name, 检查目标 group 中是否有同名但不同 key 的条目, 返回冲突的旧 key 或 null
- [x] 1.2 添加冲突解决交互 prompt: 覆盖 (替换旧 key) / 跳过
- [x] 1.3 添加单元测试: name 冲突检测和无冲突场景

## 2. identifier 统一解析

- [x] 2.1 在 `group.ts` 中新增 `resolveGroupAddIdentifier(identifier, targetGroup, allSkills, groupsService)` 函数, 并行搜索 full key match / name match / group match / owner-repo match, 收集 candidates
- [x] 2.2 实现 candidate 决策逻辑: 0 个报错, 1 个直接返回, 多个交互选择 (显示类型标签)
- [x] 2.3 自引用防护: candidate 为 group 且 name 等于目标 group 时过滤, 过滤后若无 candidate 报错 "Cannot add a group to itself."
- [x] 2.4 添加单元测试: 各种 identifier 格式的解析和多类型匹配

## 3. 批量添加逻辑

- [x] 3.1 重构 `executeGroupAdd`: 根据 resolved candidate 的 type 分发 — skill 走单个添加, group/repo 走批量添加
- [x] 3.2 实现 group→group 批量添加: 读取源 group 的 skill keys, 逐个调用 addSkill + name 冲突检测, 空 group 提前报错
- [x] 3.3 实现 owner/repo 批量添加: 调用 findRepoInCentralRepository 获取 skill 列表, 构建 key 后逐个添加 + name 冲突检测, 未安装时报错
- [x] 3.4 实现批量添加的输出格式: ✓ 添加 / · 跳过 / ⚠ 冲突替换

## 4. 集成单个添加的冲突检测

- [x] 4.1 在原有单个 skill 添加路径中接入 name 冲突检测逻辑 (复用 1.1 和 1.2)

## 5. 验证

- [x] 5.1 运行 `pnpm test` 确保所有单元测试通过
- [x] 5.2 运行 `pnpm build` 确保编译通过
- [x] 5.3 手动验证: `group add develop openspec` (group→group 批量)
- [x] 5.4 手动验证: `group add develop obra/superpowers` (owner/repo 批量)
- [x] 5.5 手动验证: name 冲突场景的交互提示
