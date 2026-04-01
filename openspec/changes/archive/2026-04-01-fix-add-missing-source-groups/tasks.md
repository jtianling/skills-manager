## 1. 修复 promptSkillsFromRepo

- [x] 1.1 将 `promptSkillsFromRepo` 中的 `buildVirtualGroupChoices` 替换为 `buildSourceGroupedChoices`, 传入 `groupsData ?? {}` 和 `getLocked` 选项
- [x] 1.2 清理不再需要的 `buildVirtualGroupChoices` import (若无其他调用方)

## 2. 测试

- [x] 2.1 更新 `add.test.ts` 中 `promptSkillsFromRepo` 相关测试, 验证使用 `buildSourceGroupedChoices`
- [x] 2.2 验证有虚拟组时 owner/repo 分组正常显示
- [x] 2.3 验证已部署 skill 的 locked 语义保持正确
- [x] 2.4 运行全部测试确认无回归
