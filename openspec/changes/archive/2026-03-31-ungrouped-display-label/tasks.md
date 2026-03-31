## 1. 交互界面 — buildSkillChoices 虚拟分组

- [x] 1.1 在 `src/utils/prompts.ts` 的 `buildSkillChoices()` 中, 对 `grouped` entries 排序: custom 无 groupId 的 entry 排在同 category 最后
- [x] 1.2 在 `buildSkillChoices()` 中, 当 `category === 'custom'` 且 `groupId === undefined` 时, 将 mapChoice 调用的 groupId 参数替换为 `'(ungrouped)'`

## 2. list 命令 — 文字输出同步

- [x] 2.1 在 `src/commands/list.ts` 的 `listAvailable()` 中, 将 `ungroupedByCategory` 中的 custom skills 包裹在 `(ungrouped)` 分组标签下输出, 使用与真实分组相同的缩进格式
- [x] 2.2 确保 `(ungrouped)` 分组在 custom 分类中排在真实分组之后(当前代码已先输出 groups 再输出 ungrouped, 只需补充 group-header 行)

## 3. 测试验证

- [x] 3.1 在 `src/commands/list.test.ts` 中添加测试: custom 未分组 skill 在 list 输出中显示 `(ungrouped)` 标签
- [x] 3.2 运行现有测试确保无回归
