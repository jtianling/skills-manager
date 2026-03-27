## 1. prompts 层

- [x] 1.1 在 `src/utils/prompts.ts` 新增 `promptSkillsToUninstall(skills: SkillInfo[]): Promise<string[]>` 函数, 复用 `parseSource()` 构建 choices (group/subGroup), checked 全为 false, 无 suffix, message 为 "Select skills to uninstall:"

## 2. uninstall 命令

- [x] 2.1 在 `src/commands/uninstall.ts` 将 `.argument('<identifier>', ...)` 改为 `.argument('[identifier]', ...)`
- [x] 2.2 新增 `interactiveUninstall()` 函数: 调用 `getAllSkills()` 获取所有已安装 skill, 空则输出 "No installed skills found." 退出; 调用 `promptSkillsToUninstall` 展示列表; 无选择则输出 "No skills selected." 退出; 有选择则调用 `confirmUninstall` 确认后逐个删除 (rmSync + cleanEmptyParents + cleanSourcesForDir), 输出 "Removed: {name}" 和最终 "Uninstalled {n} skills."
- [x] 2.3 修改 action 回调: identifier 为 undefined 时调用 `interactiveUninstall()`, 否则走原有逻辑

## 3. 验证

- [x] 3.1 构建通过 (`pnpm build`)
- [x] 3.2 现有测试通过 (`pnpm test`)
