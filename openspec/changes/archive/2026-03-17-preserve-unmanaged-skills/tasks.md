## 1. init 命令修改

- [x] 1.1 修改 `src/commands/init.ts` 中 skill 的 `toRemove` 过滤逻辑, 增加 `s.source !== 'unknown'` 条件
- [x] 1.2 收集未托管 skill (`source === 'unknown'`), 在部署输出中显示 `~ name (unmanaged)`
- [x] 1.3 修改 `src/commands/init.ts` 中 command 的 `toRemove` 过滤逻辑, 增加 `c.source !== 'unknown'` 条件
- [x] 1.4 收集未托管 command (`source === 'unknown'`), 在部署输出中显示 `~ /name (unmanaged)`

## 2. sync 命令修改

- [x] 2.1 修改 `src/commands/sync.ts` 中 skill 同步逻辑, 在冲突检测之前增加 unmanaged 检测 (`source === 'unknown'` 且 `conflict !== true`), 输出 `~ name (unmanaged)` 并跳过
- [x] 2.2 修改 `src/commands/sync.ts` 中 command 同步逻辑, 在查找源之前增加 unmanaged 检测 (`source === 'unknown'`), 输出 `~ /name (unmanaged)` 并跳过

## 3. 验证

- [ ] 3.1 手动测试: 在项目 skills 目录中创建未托管 skill, 运行 init 确认不被删除 (needs manual run)
- [ ] 3.2 手动测试: 在项目 commands 目录中创建未托管 command, 运行 init 确认不被删除 (needs manual run)
- [ ] 3.3 手动测试: 运行 sync 确认未托管项显示 unmanaged 而非 orphaned (needs manual run)
