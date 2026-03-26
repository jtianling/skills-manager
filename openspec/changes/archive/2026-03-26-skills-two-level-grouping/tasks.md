## 1. 类型和接口扩展

- [x] 1.1 在 `SelectChoice` 接口 (`src/utils/interactive-select.ts`) 新增 `subGroup?: string` 字段
- [x] 1.2 在 `DisplayItem` 接口新增 `'group-header'` 类型, 添加 `childIndices?: number[]` 字段

## 2. interactiveCheckbox group-header 核心逻辑

- [x] 2.1 修改 `buildDisplayItems` 函数: 检测 `subGroup` 变化时插入 `group-header` 类型的 DisplayItem, 计算 `childIndices`
- [x] 2.2 修改 `buildDisplayItems` 的搜索过滤: 无匹配子项的 group-header 隐藏, 有匹配子项的 group-header 保留并更新 childIndices
- [x] 2.3 实现 group-header 三态计算函数: 根据 childIndices 和 selected Set 计算 all/partial/none 状态
- [x] 2.4 修改 render 函数: group-header 行显示三态图标 (`◉`/`◐`/`◯`), 格式 `{subGroup} ({childCount})`, 不分配行号
- [x] 2.5 修改 render 函数: group-header 下的子项 (choice) 额外缩进两个空格

## 3. interactiveCheckbox 导航和交互

- [x] 3.1 修改光标移动逻辑: ↑/↓/j/k 跳过 separator 但不跳过 group-header
- [x] 3.2 修改 Space 键处理: 光标在 group-header 上时批量切换所有 childIndices 的选中状态 (partial/none → all, all → none)
- [x] 3.3 验证 Ctrl+A 与 group-header 兼容: Ctrl+A 操作所有 choice, group-header 三态自动刷新
- [x] 3.4 验证 G/gg 跳转和数字+G 跳转与 group-header 兼容 (group-header 不参与行号)

## 4. interactiveCheckbox 测试

- [x] 4.1 编写 group-header 三态显示测试: all/partial/none 状态正确渲染
- [x] 4.2 编写 group-header 批量切换测试: Space 键切换逻辑
- [x] 4.3 编写搜索过滤与 group-header 交互测试: 隐藏/显示逻辑
- [x] 4.4 编写无 subGroup 向后兼容测试: 现有调用方不受影响

## 5. promptSkills 二级分组构建

- [x] 5.1 修改 `promptSkills` (`src/utils/prompts.ts`): 解析 skill.source 提取 category 和 groupId
- [x] 5.2 构建 choices 时设置 `group` 为 category (official/community/custom), `subGroup` 为 groupId (provider/owner-repo/groupName)
- [x] 5.3 处理无分组 custom skill: source 为 "custom" 时 subGroup 为 undefined

## 6. custom 目录分组扫描

- [x] 6.1 修改 `getSkillsFromSource` (`src/services/skills.ts`) 的 custom 分支: 一级子目录含 SKILL.md 则为无分组 skill (source="custom"), 不含 SKILL.md 则为分组目录, 扫描下一层 (source="custom/{dirName}")
- [x] 6.2 编写 custom 分组扫描测试: 无分组 skill, 分组 skill, 空分组目录, 混合场景

## 7. custom-install --group 选项

- [x] 7.1 在 `custom-install` 命令 (`src/commands/custom-install.ts`) 新增 `--group / -g` 选项
- [x] 7.2 实现分组安装路径: 有 --group 时目标为 `custom/{group}/{name}/`, 自动创建分组目录
- [x] 7.3 实现分组路径下的覆盖确认提示: "Skill 'abc' already exists in group 'my-tools'. Overwrite?"
- [x] 7.4 编写 custom-install --group 测试: 正常安装, 覆盖确认, --force 跳过, 无 --group 向后兼容

## 8. custom-update 适配分组路径

- [x] 8.1 修改 `custom-update` (`src/commands/custom-update.ts`): 查找目标 skill 时先检查 `custom/{name}/`, 再搜索 `custom/*/{name}/`
- [x] 8.2 编写 custom-update 分组路径测试: 无分组更新, 分组更新, 无分组优先, skill 不存在

## 9. list 命令二级缩进输出

- [x] 9.1 修改 `listAvailable` (`src/commands/list.ts`): 按 category 分组后, 在 category 内按 subGroup 再分组
- [x] 9.2 实现二级缩进输出: category 行 `── {category} ──`, group 行 `  {groupId} ({count})`, skill 行 `    {name}`; 无分组 custom skill 直接 `  {name}`
- [x] 9.3 编写 list 命令二级输出测试
