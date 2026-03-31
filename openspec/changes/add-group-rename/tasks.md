## 1. Service 层

- [x] 1.1 在 `GroupsService` 中添加 `renameGroup(oldName, newName)` 方法
- [x] 1.2 在 `groups.test.ts` 中添加 renameGroup 的单元测试 (成功, oldName 不存在, newName 已存在, 格式非法, 相同名字)

## 2. Command 层

- [x] 2.1 在 `group.ts` 中添加 `rename` 子命令和 `executeGroupRename` 函数
- [x] 2.2 在 `group.test.ts` 中添加 rename 子命令的测试 (成功, 错误场景)
