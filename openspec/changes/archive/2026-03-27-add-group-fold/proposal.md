## Why

当安装的 skills 数量较多时, init/add 的交互式多选列表会很长, 用户需要反复滚动才能浏览和选择.  需要组折叠功能让用户快速收起不关心的分组, 聚焦于目标 skills.

## What Changes

- interactiveCheckbox 的 group-header 支持折叠/展开, 折叠时隐藏所有子项 choice
- 新增快捷键: `h`/`←` 折叠当前组, `l`/`→` 展开当前组, `c` 全局 toggle 所有组
- 折叠图标: `▶` (折叠) / `▼` (展开), 替换原有的固定前缀
- 搜索模式下忽略折叠状态, 显示所有匹配项
- 帮助栏增加折叠相关提示
- 默认状态: 全部展开 (向后兼容)

## Capabilities

### New Capabilities
- `group-fold`: interactiveCheckbox 的组折叠/展开功能, 包括快捷键、折叠状态管理、渲染逻辑

### Modified Capabilities
- `skill-grouping`: group-header 增加折叠/展开行为, 显示折叠图标
- `cli-interaction`: 帮助栏增加折叠提示, 新增 h/l/c 快捷键说明

## Impact

- 修改文件: `src/utils/interactive-select.ts` (核心逻辑)
- 修改文件: `src/utils/prompts.ts` (如帮助栏定义在此)
- 无新依赖, 无 API 变更, 无破坏性变更
- 不影响 promptSkills 的数据构建, 仅影响 interactiveCheckbox 的渲染和交互
