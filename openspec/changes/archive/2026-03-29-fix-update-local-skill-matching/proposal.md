## Why

`update` 命令对 local-path 输入按 sources.json 中的 `url` 字段做精确路径匹配, 但 `install` 存入的是基于当时 CWD resolve 的绝对路径.  用户在不同目录执行 update, 或原始路径含 symlink 时, 路径不匹配导致 "No installed skill found", 即使 skill 确实已安装.  同时 `install` 用文件系统检测已安装, `update` 用 sources.json — 两套逻辑不一致.

## What Changes

- `update` 对 local-path 输入改为按 skill name 在中央仓库 (`~/.skills-manager/custom/`) 文件系统中查找, 不再依赖 sources.json url 精确匹配
- `install` 的 "already exists" 检测也统一为按 skill name 在中央仓库查找, 与 update 保持一致
- 提取公共函数 `findInstalledCustomSkill(skillName)`, install 和 update 共用

## Capabilities

### New Capabilities
- `custom-skill-lookup`: 按 skill name 在中央仓库 custom 目录中查找已安装 skill, 支持跨 group 扫描

### Modified Capabilities
- `source-management`: update 对 local-path 的匹配从 url 精确匹配改为 skill name 查找
- `custom-install`: install 的 "already exists" 检测从 target dir 存在性检查改为统一的 skill name 查找

## Impact

- **代码文件**: `src/commands/update.ts` 重构匹配逻辑, `src/commands/install-local.ts` 统一检测逻辑, 新增 `src/services/skill-lookup.ts` 或类似工具函数
- **测试**: update 和 install-local 的相关测试需更新
- **行为变化**: 从不同目录运行 `update ./path/to/skill` 不再因路径不匹配而失败
