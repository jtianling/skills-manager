## 1. 提取共享工具函数

- [x] 1.1 将 `add.ts` 中的 `findRepoInCentralRepository` 提取到共享模块 (如 `src/utils/repo-lookup.ts`), `add.ts` 改为导入
- [x] 1.2 将 `add.ts` 中的 `detectArgFormat` 提取到共享模块, `add.ts` 改为导入

## 2. remove 命令增加 owner/repo 支持

- [x] 2.1 在 `remove.ts` 的 `executeRemove` 中, 对每个 skillName 检测格式: owner/repo 走新分支, 纯名称走原逻辑
- [x] 2.2 实现 owner/repo 分支: 调用 `findRepoInCentralRepository` 获取 source 下的 skills, 与 deployed skills 交叉匹配, 批量移除
- [x] 2.3 处理错误场景: 中央仓库无匹配时输出 "'x/y' not found in central repository"; 无已部署 skill 时输出 "No deployed skills found from 'x/y'"
- [x] 2.4 确保 `--global` 模式下 owner/repo 格式也能正常工作

## 3. 测试

- [x] 3.1 为 `findRepoInCentralRepository` 和 `detectArgFormat` 的共享模块补充单元测试 (如果原有测试在 add.test.ts 中, 确认迁移)
- [x] 3.2 为 `remove` 命令的 owner/repo 场景编写测试: 正常批量移除、中央仓库无匹配、无已部署 skill、不影响其他 source 同名 skill
- [x] 3.3 确认现有 remove 按 skill name 的测试仍通过
