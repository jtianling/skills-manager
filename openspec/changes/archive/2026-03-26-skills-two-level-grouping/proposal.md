## Why

当前 `init` 命令的 skill 选择列表按 source 分组 (official/community/custom) 只有一级分组, 所有 skill 平铺在分类下.  随着 official 提供者增多 (anthropic, openai, vercel 等) 和 community 仓库增多 (obra/superpowers, user/repo 等), 列表变得冗长且难以浏览.  用户无法快速按 provider 或 repo 批量选择/取消整组 skill.  custom skill 也缺乏分组能力, 全部平铺在 custom 分类下.

## What Changes

- `interactiveCheckbox` 新增 `group-header` 项类型, 支持三态显示和批量选择:
  - 三态: 全未选 `◯`, 部分选 `◐`, 全选 `◉`
  - Space 切换: partial → all → none
  - group-header 可聚焦, 可选择, 但不出现在最终返回值中
  - 子项在 group-header 下缩进一级
  - group-header 显示子项计数: `"owner/repo (4)"`
- `promptSkills` 解析 `skill.source` 构建二级分组数据:
  - `official/provider` → category="official", groupId="provider"
  - `community/owner/repo` → category="community", groupId="owner/repo"
  - `custom/groupName` → category="custom", groupId="groupName"
  - `custom` (无分组) → category="custom", 无 groupId, 平铺显示
- 搜索模式下: 无匹配子项的 group-header 隐藏, 三态正确刷新
- `list` 命令输出适配二级缩进结构
- `custom-install` 新增 `--group / -g` 选项:
  - `skillsmgr ci ./my-skill --group my-tools` → 安装到 `~/.skills-manager/custom/my-tools/my-skill/`
  - 无 `--group` → 保持现有行为, 安装到 `~/.skills-manager/custom/my-skill/`
- `getSkillsFromSource` 扫描 custom 目录时支持分组目录:
  - 含 SKILL.md 的目录 = 无分组 skill (source = "custom")
  - 不含 SKILL.md 的目录 = 分组目录, 扫描下一层 (source = "custom/{groupName}")
- `custom-update` 适配分组路径

## Capabilities

### New Capabilities
- `skill-grouping`: interactiveCheckbox 的 group-header 三态选择机制, 及 promptSkills 的二级分组数据构建
- `custom-skill-group`: custom-install 的 --group/-g 参数和 custom 目录的分组扫描逻辑

### Modified Capabilities
- `cli-interaction`: interactiveCheckbox 新增 group-header 项类型, 键盘操作需兼容 group-header, 搜索过滤需处理 group-header 隐藏
- `custom-install`: 新增 --group/-g 选项, 安装路径支持 `custom/{groupName}/{skillName}/`
- `custom-update`: 适配分组路径下的 skill 更新
- `source-management`: custom 来源分类新增 `custom/{groupName}` 路径模式

## Impact

- **核心文件**: `src/utils/interactive-select.ts` (新增 group-header 逻辑), `src/utils/prompts.ts` (分组数据构建), `src/services/skills.ts` (custom 分组扫描), `src/commands/custom-install.ts` (--group 选项), `src/commands/custom-update.ts` (分组路径), `src/commands/list.ts` (二级缩进输出)
- **类型**: `src/types.ts` 可能需要新增分组相关类型
- **向后兼容**: 现有无分组 custom skill 继续正常工作; `promptSkillsToInstall` 和 `promptTools` 不受影响
- **UI 变化**: init 命令的 skill 选择列表从一级平铺变为二级分组
