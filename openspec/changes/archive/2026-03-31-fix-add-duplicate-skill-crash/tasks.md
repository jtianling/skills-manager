## 1. 修复嵌套 custom skill 的 source 值

- [x] 1.1 修改 `src/services/skills.ts` 中 `getSkillsFromSource` 的 custom 分支, 嵌套 skill 的 source 改为 `${sourcePrefix}/${topDir.name}`

## 2. 修复消歧义逻辑

- [x] 2.1 修改 `src/commands/add.ts` 中 `handleSkillName`, choices 的 value 从 `s.source` 改为 `s.path`, find 也按 path 匹配
- [x] 2.2 添加 null guard: find 返回 undefined 时输出 "Failed to resolve skill selection." 并以退出码 1 退出

## 3. 验证

- [x] 3.1 构建项目 (`pnpm build`) 确认无编译错误
- [x] 3.2 手动验证: 确认 `findSkillsByName("jt-release")` 返回的两个 skill source 不同
