## 1. 添加 -y flag

- [x] 1.1 在 `UninstallOptions` interface 中添加 `yes?: boolean` 字段
- [x] 1.2 在 `uninstallCommand` 中添加 `.option('-y, --yes', 'Skip all prompts (equivalent to --all --force)')`
- [x] 1.3 在 `executeUninstall` 入口处, 当 `options.yes` 为 true 时设置 `options.all = true; options.force = true`

## 2. 测试

- [x] 2.1 添加单元测试: `-y` flag 映射为 `all` + `force`
- [x] 2.2 添加 E2E 测试: `uninstall owner/repo -y` 卸载所有关联 skills 且无交互
- [x] 2.3 添加 E2E 测试: `uninstall owner/repo -y` 不影响其他来源 skills (无副作用验证)

## 3. 验证

- [x] 3.1 构建通过 (`npm run build`)
- [x] 3.2 现有测试通过 (`npm test`)
- [x] 3.3 E2E 测试通过
