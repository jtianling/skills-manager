## 1. getSourceInnerGroup 修改

- [x] 1.1 移除 `getSourceInnerGroup` 中 `if (source.startsWith('custom')) return undefined;` 排除逻辑
- [x] 1.2 更新 `inner-group-choices.test.ts` 中 custom innerGroup 相关测试: custom 子路径 source 返回 innerGroup, 平铺 custom 仍返回 undefined

## 2. 同名跳过逻辑

- [x] 2.1 `buildVirtualGroupChoices` 的 `toChoice` 中, 当 `innerGroup === subGroup` 时将 innerGroup 设为 undefined
- [x] 2.2 `buildSourceGroupedChoices` 的 `toChoice` 中, 当 `innerGroup === subGroup` 时将 innerGroup 设为 undefined
- [x] 2.3 添加测试: custom/openspec skill 在 develop 组有 innerGroup, 在 openspec 组无 innerGroup

## 3. 更新现有测试

- [x] 3.1 更新 `prompts.test.ts` 中 `buildVirtualGroupChoices innerGroup` 测试用例
- [x] 3.2 更新 `prompts.test.ts` 中 `buildSourceGroupedChoices cross-source virtual groups` 测试用例
- [x] 3.3 确认所有测试通过
