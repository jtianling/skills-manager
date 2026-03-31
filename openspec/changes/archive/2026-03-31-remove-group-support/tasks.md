## 1. 通用 helper

- [x] 1.1 在 `src/utils/prompts.ts` 中实现 `buildVirtualGroupChoices` 函数: 接受 skill 列表和 groups 数据, 按虚拟 group 构建 `SelectChoice[]`, 支持 suffix/locked 自定义选项
- [x] 1.2 为 `buildVirtualGroupChoices` 编写单元测试: 覆盖分组构建, (ungrouped) 排序, 多 group 归属, 无 group 时扁平显示, 自定义 suffix/locked

## 2. remove --group 支持

- [x] 2.1 在 `src/types.ts` 的 `RemoveOptions` 中添加 `group?: string` 字段, 在 `removeCommand` 中注册 `--group <name>` 选项
- [x] 2.2 实现 `--group` 流程: 读取 GroupsService, 筛选已部署 skill, 非交互/交互模式移除, 与 `--all`/`-y`/`-g` 组合处理, 与 skill 名参数互斥校验
- [x] 2.3 为 `remove --group` 编写单元测试: 覆盖按组移除, 组不存在, 组内无已部署 skill, --all 组合, 互斥校验

## 3. 交互列表分组显示

- [x] 3.1 改造 `interactiveRemove` 函数: 加载 groups 数据, 使用 `buildVirtualGroupChoices` 构建分组 choices 传给 `interactiveCheckbox`
- [x] 3.2 改造 `removeByOwnerRepo` 中的交互选择: 如适用, 也使用分组 choices

## 4. group 引用清理

- [x] 4.1 在 `executeRemove` 中, 所有移除路径完成后调用 `GroupsService.removeSkillFromAll` 清理 `groups.json` 引用
- [x] 4.2 为 group 引用清理编写单元测试: 验证移除后 groups.json 中不再包含对应 skill key

## 5. E2E 测试

- [x] 5.1 在 e2e 测试中添加 `remove --group` 场景: 按组移除, 验证 skill 被移除且 group 引用被清理, 验证非目标 skill 不受影响
