## Context

当前 `interactiveCheckbox` 使用一级分组: `SelectChoice.group` 字段生成 separator 行 (如 `── official/anthropic ──`), choices 平铺在 separator 下面.  `promptSkills` 直接用 `skill.source` (如 `"official/anthropic"`, `"community/obra/superpowers"`) 作为 group 值.

随着 official provider 和 community repo 增多, 需要二级分组: 第一级为 category (official/community/custom), 第二级为 provider/owner-repo/group-name.  第二级需要可聚焦、可选择, 支持三态批量切换.

关键约束:
- `interactiveCheckbox` 被 `promptSkills`, `promptSkillsToInstall`, `promptTools` 三个调用方使用
- `promptSkillsToInstall` 和 `promptTools` 不需要 group-header 功能, 变更必须向后兼容
- 现有 custom skill 路径 `~/.skills-manager/custom/{name}/` 必须继续工作

## Goals / Non-Goals

**Goals:**
- interactiveCheckbox 新增 group-header 项类型, 支持三态显示和批量选择
- promptSkills 将 skill.source 解析为 category + groupId 构建二级分组
- custom-install 支持 --group/-g 选项指定分组目录
- custom 目录扫描支持分组子目录
- list 命令输出适配二级缩进
- custom-update 适配分组路径

**Non-Goals:**
- 不修改 promptSkillsToInstall 和 promptTools 的调用方式
- 不修改 install 命令的 skill 选择流程
- 不引入持久化的分组配置文件
- 不支持超过两级的嵌套分组

## Decisions

### Decision 1: group-header 作为 DisplayItem 新类型

**选择**: 在 `DisplayItem.type` 中新增 `'group-header'` 类型, 与 `'separator'` 和 `'choice'` 并列.

**替代方案**: 复用 separator 类型并添加 selectable 标记 — 增加复杂度, 语义不清, separator 在多处被跳过.

**理由**: group-header 的行为与 separator 完全不同 (可聚焦, 可选择, 有三态), 独立类型更清晰.  cursor 移动逻辑只需在跳过 separator 的判断中不跳过 group-header.

### Decision 2: group-header 数据通过 SelectChoice 扩展传入

**选择**: 在 `SelectChoice` 接口新增 `subGroup?: string` 字段.  `promptSkills` 构建 choices 时:
- `group` 字段保持作为 category separator (如 "official", "community", "custom")
- `subGroup` 字段用于 group-header 归属 (如 "anthropic", "obra/superpowers", "my-tools")

`buildDisplayItems` 检测到 `subGroup` 变化时插入 group-header 行.

**替代方案**: 在 SelectOptions 中传入独立的分组结构 — 需要额外的数据结构和映射逻辑.

**理由**: 最小变更原则.  现有不使用 `subGroup` 的调用方完全不受影响.

### Decision 3: group-header 的三态计算

**选择**: 每次 render 时动态计算 group-header 状态, 基于其子项的 `selected` 集合:
- 所有子项选中 → `◉` (全选)
- 部分子项选中 → `◐` (部分)
- 无子项选中 → `◯` (未选)

toggle 行为: 当前状态为 partial 或 none → 全选; 当前状态为 all → 全不选.

**替代方案**: 维护 group-header 自身的独立状态 — 状态同步复杂, 容易不一致.

**理由**: 派生状态模式避免了状态不一致问题, render 时计算开销极小 (group 内 skill 数量有限).

### Decision 4: group-header 在 DisplayItem 中关联子项

**选择**: `DisplayItem` 类型为 `group-header` 时, 携带 `childIndices: number[]` (对应 choices 数组的索引).  搜索过滤时重新计算 childIndices (仅包含匹配的子项).

**理由**: 支持 toggle 操作和三态计算, 搜索时动态过滤.

### Decision 5: custom 分组目录的检测策略

**选择**: 在 `getSkillsFromSource` 的 custom 分支中, 对每个一级子目录:
1. 如果含 SKILL.md → 无分组 skill, source = "custom"
2. 如果不含 SKILL.md → 视为分组目录, 扫描下一层, source = "custom/{dirName}"

**替代方案**: 使用 metadata 文件标记分组目录 — 增加复杂度, 需要额外的文件管理.

**理由**: SKILL.md 已经是 skill 目录的标识, 利用其存在与否区分 skill 和分组目录是自然的启发式方法, 无需额外配置.

### Decision 6: custom-install --group 的目录结构

**选择**: `--group my-tools` 将目标路径从 `custom/{name}/` 改为 `custom/{group}/{name}/`.  分组目录自动创建, 不需要预先注册.

**理由**: 简洁, 与 official/community 的目录结构模式一致 (都有中间层级).

## Risks / Trade-offs

- **[Risk] group-header 与 Ctrl+A 交互复杂度** → Ctrl+A 操作所有 choice 类型的 filteredIndices, group-header 不在 filteredIndices 中, 三态自动刷新. 无额外逻辑.
- **[Risk] 搜索模式下 group-header 闪烁** → group-header 仅在有匹配子项时显示, 无子项时完全隐藏, 避免空 group-header 残留.
- **[Risk] 现有 custom skill 与分组目录歧义** → 以 SKILL.md 存在为判定条件, 若用户手动创建不含 SKILL.md 的目录会被误判为分组目录.  但这种情况本身就不是有效 skill, 影响可接受.
- **[Trade-off] group-header 不参与行号编号** → 与 separator 一致, group-header 不分配行号. 数字+G 跳转只跳到 choice, 符合用户直觉.
