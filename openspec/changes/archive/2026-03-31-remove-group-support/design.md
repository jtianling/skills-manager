## Context

`remove` 命令当前以扁平列表展示已部署 skill, 无 group 分组能力.  `add` 命令已支持 `--group` 批量部署.  `interactiveCheckbox` 已有完整的 `group`/`subGroup` 二级分组渲染 (分隔符, 可折叠 header, 批量选中, 三态图标).  `buildSkillChoices` 按 source 分组, 但不支持按虚拟 group 分组.  `remove` 删除 skill 后不调用 `removeSkillFromAll`, 留下悬空引用.

## Goals / Non-Goals

**Goals:**
- `remove --group <name>`: 按虚拟 group 筛选已部署 skill 进行批量移除
- `remove` 默认交互列表按虚拟 group 分组显示, 复用 `interactiveCheckbox` 现有分组能力
- 通用 helper `buildVirtualGroupChoices` 可被任意命令复用
- `remove` 完成后清理 `groups.json` 悬空引用

**Non-Goals:**
- 不改动 `interactiveCheckbox` 的渲染逻辑 (已完备)
- 不改动 `add` 命令的分组显示 (仍按 source 分组)
- 不改动 `GroupsService` 的接口

## Decisions

### 1. 通用 helper 放在 `prompts.ts`

**选择:** 在 `src/utils/prompts.ts` 中新增 `buildVirtualGroupChoices` 函数, 与现有 `buildSkillChoices` 同层.

**理由:** `prompts.ts` 已有 `buildSkillChoices` (按 source 分组) 和所有 prompt 函数.  新 helper 同属 "构建 SelectChoice 数组" 的职责, 放在同一文件符合职责聚合.

**替代方案:** 独立文件 `src/utils/group-choices.ts` — 拆分过度, 只是一个函数.

### 2. 多 group 归属: skill 只出现一次

**选择:** 当一个 skill 属于多个 group 时, 归入第一个匹配的 group.  不重复显示.

**理由:** `interactiveCheckbox` 通过 `choiceIndex` 追踪选中状态, 重复出现会导致同一 skill 有多个 index, 返回值需额外去重, 增加不必要的复杂性.  用户场景是按 group 批量操作, 不需要在每个 group 下都看到同一个 skill.

**替代方案:** 每个 group 下都显示 — index 冲突, 实现复杂, 用户体验反而混乱.

### 3. `--group` 与 `--all`/`-y` 可组合

**选择:** `remove --group dev --all` 直接移除 dev 组内所有已部署 skill, 不弹交互列表.

**理由:** 与 `add --group dev --all` 行为对称.  脚本化场景需要非交互模式.

### 4. 分组层级: 只用 subGroup, 不用 group

**选择:** 虚拟 group 名映射到 `subGroup` 字段, `group` 字段统一为空 (不设顶层分隔符).

**理由:** 虚拟 group 是平级的 (不像 source 有 official/community/custom 的层级), 用 `subGroup` 即可获得折叠和批量选中能力.  如果同时用 `group` 做顶层分隔, 会多一层无意义的嵌套.

**替代方案:** 用 `group` 做分隔符 + `subGroup` 做折叠 — 对虚拟 group 来说两层等于一层, 增加视觉噪音.

### 5. 清理引用的时机和位置

**选择:** 在 `removeSkillNames` 和 `removeSkillNamesGlobal` 调用完成后, 遍历已删除的 skill, 通过 `DeploymentScanner` 反查 source, 构造 skill key 并调用 `removeSkillFromAll`.

**理由:** `removeSkillFromAll` 需要 skill key (格式为 `source/name`).  `DeploymentScanner.getDeployedSkills()` 返回的 `ScannedSkill` 包含 `source` 和 `name`, 可以在删除前构造 key.  在 `executeRemove` 层做清理, 覆盖所有移除路径 (交互/指定名字/owner-repo).

## Risks / Trade-offs

- **[未入组 skill 的分组名]** `(ungrouped)` 与 `buildSkillChoices` 中的 custom ungrouped 概念重叠 → 但两者语境不同 (source 分组 vs 虚拟 group 分组), 不冲突, 接受复用同一命名.
- **[groups.json 为空或无 group]** 当没有任何虚拟 group 时, 所有 skill 都归入 `(ungrouped)`, 退化为单组 → 行为正确, 不比扁平列表更差.  不显示 subGroup header, 直接扁平显示.
- **[skill key 构造依赖 scanner]** 如果 deployed skill 的 source 信息不完整 (如 copy 模式下 source 丢失), 可能构造错误的 key → scanner 的 `ScannedSkill` 已有 source 字段, copy 模式也有, 风险低.
