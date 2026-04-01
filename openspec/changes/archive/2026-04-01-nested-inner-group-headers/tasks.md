## 1. interactive-select 数据模型

- [x] 1.1 SelectChoice 接口新增 `innerGroup?: string` 字段
- [x] 1.2 DisplayItem 新增 `type: 'inner-group-header'`, 含 `childIndices`, `innerGroupName`, `parentSubGroup`
- [x] 1.3 `isFocusable` 扩展支持 `inner-group-header`

## 2. buildDisplayItems 三层嵌套

- [x] 2.1 解析 innerGroup, 在 subGroup 内部生成 inner-group-header
- [x] 2.2 外层 collapsed 跳过整个 subGroup 下所有 inner-group-header 和 choice
- [x] 2.3 内层 innerCollapsed (key: `${subGroup}/${innerGroup}`) 跳过 innerGroup 下的 choice
- [x] 2.4 搜索模式忽略内外层折叠状态

## 3. 行号分配

- [x] 3.1 行号计数从 `type === 'choice'` 扩展为所有 focusable 项 (choice + group-header + inner-group-header)
- [x] 3.2 `jumpToLineNumber` 改为跳转到第 n 个 focusable 项
- [x] 3.3 separator 不分配行号

## 4. 渲染与缩进

- [x] 4.1 inner-group-header 渲染: 折叠图标 + tristate 图标 + innerGroupName + childCount, 缩进 2 级
- [x] 4.2 inner group 下 choice 缩进 3 级
- [x] 4.3 group-header 渲染增加行号显示
- [x] 4.4 inner-group-header 渲染增加行号显示

## 5. 交互逻辑

- [x] 5.1 space 键支持 inner-group-header 批量选择 (含 syncLinked 联动)
- [x] 5.2 group-header 的 childIndices 包含 inner group 内的所有 choice (外层 space 批量选)
- [x] 5.3 group-header tristate 图标计算包含 inner group 内的 child
- [x] 5.4 h/l 键支持 inner-group-header 折叠/展开
- [x] 5.5 c 键全局 toggle 包含 inner-group-header
- [x] 5.6 折叠后光标重定位兼容内层 header

## 6. prompts.ts 数据构建

- [x] 6.1 `buildVirtualGroupChoices`: 非 custom skill 设置 `innerGroup` 替代 source suffix
- [x] 6.2 `buildSourceGroupedChoices`: custom 分类虚拟组内非 custom skill 设置 `innerGroup`
- [x] 6.3 移除 `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 中的 source suffix 拼接逻辑

## 7. 测试

- [x] 7.1 更新 `prompts.test.ts` source suffix 测试为 innerGroup 测试
- [x] 7.2 新增 `buildDisplayItems` 三层嵌套单元测试
- [x] 7.3 新增行号分配 focusable 项测试
- [x] 7.4 新增内外层折叠交互测试
- [x] 7.5 运行全量测试确认无回归
