## Why

当 skill 生态规模增长后, 不同来源的 skill 不可避免会出现同名.  当前 batch install 使用 `findInstalledCustomSkill` 按 bare name 查找, 发现同名即视为"已安装", 导致: 1) 已安装的 skill 被 locked 无法重新选择; 2) 全部同名时直接返回"All skills already installed", group 也不会创建.  用户无法通过目录批量安装一组包含同名 skill 的 skills.

## What Changes

- batch install (`installFromLocalDirBatch`) 不再用 `findInstalledCustomSkill` 判断是否"已安装", 改为检查实际目标路径 `custom/{dirName}/{skillName}` 是否存在
- source key 在 batch install 时包含子目录: `custom/{dirName}/{skillName}` 而非 `custom/{skillName}`
- `selectSkills` 的 installed 判断基于目标路径而非 bare name, 同名但不同路径的 skill 视为不同 skill
- 需要消歧义的命令 (uninstall, add 等) 在 bare name 匹配到多个 skill 时, 列出完整 key 让用户选择

## Capabilities

### New Capabilities

- `skill-disambiguation`: 当 bare name 匹配到多个已安装 skill 时, 列出完整 source key 让用户交互选择; 支持直接使用完整 key 跳过消歧义

### Modified Capabilities

- `install-directory-batch`: batch install 始终安装到 `custom/{dirName}/{skillName}/`, 不因同名 skill 已存在而跳过或覆盖旧路径
- `custom-skill-lookup`: `findInstalledCustomSkill` 改为返回数组, 支持同名多结果; 新增按 source key 精确查找

## Impact

- `src/commands/install-local.ts`: `installFromLocalDirBatch` 安装路径和 installed 判断逻辑
- `src/commands/install-utils.ts`: `findInstalledCustomSkill`, `getCustomSkillKey`, `selectSkills`
- `src/commands/uninstall.ts`: bare name 消歧义
- `src/commands/add.ts`: bare name 消歧义
- `src/services/skills.ts`: skill 列表和查找适配多同名结果
- 无 **BREAKING** 变更: 单个 skill install 行为不变, 已有 source key 格式兼容
