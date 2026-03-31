## 1. prompts.ts choice builder 修改

- [x] 1.1 `buildVirtualGroupChoices`: 将 ungrouped skills 的 `subGroup` 从 `'(ungrouped)'` 改为 `undefined`
- [x] 1.2 `buildSourceGroupedChoices`: custom 分类中 ungrouped skills 的 `subGroup` 从 `'(ungrouped)'` 改为 `undefined`
- [x] 1.3 `buildSkillChoices`: `effectiveGroupId` 中去除 `'(ungrouped)'` 赋值, 改为 `undefined`

## 2. list 命令修改

- [x] 2.1 `list.ts` `listAvailable`: custom 分类的 ungrouped skills 去除 `(ungrouped)` 标题, 直接缩进一层输出(与 official/community 一致)

## 3. 测试更新

- [x] 3.1 `prompts.test.ts`: 更新 "builds virtual group choices with ungrouped last" 用例, 期望 `subGroup` 从 `'(ungrouped)'` 改为 `undefined`
- [x] 3.2 验证所有测试通过 (`pnpm test`)
