## 1. Custom Skill Lookup 扩展

- [x] 1.1 在 `install-utils.ts` 中新增 `findInstalledCustomSkills(skillName)` (复数), 返回所有匹配的 `InstalledCustomSkill[]`, 扫描顶层和一层子目录
- [x] 1.2 修改 `findInstalledCustomSkill` 支持子目录匹配, key 包含子目录前缀 (如 `custom/develop/jt-codex`)
- [x] 1.3 新增 `findCustomSkillByKey(sourceKey)` 按完整 key 精确查找
- [x] 1.4 修改 `getCustomSkillKey(skillName, subdirectory?)` 支持可选子目录参数, 有子目录时返回 `custom/{subdir}/{name}`

## 2. Batch Install 路径和 Key 修改

- [x] 2.1 修改 `installFromLocalDirBatch` 中的 targetDir 逻辑: 始终使用 `getCustomSkillDir(skill.name, dirName)`, 不再调用 `findInstalledCustomSkill` 重定向到已有路径
- [x] 2.2 修改 `installFromLocalDirBatch` 中的 sourceKey: 调用 `getCustomSkillKey(skill.name, dirName)` 生成含子目录的 key
- [x] 2.3 修改 `installFromLocalDirBatch` 的 installed 判断: 改为检查 `custom/{dirName}/{skillName}/` 是否存在, 而非用 `findInstalledCustomSkill`

## 3. 消歧义工具函数

- [x] 3.1 新增 `resolveSkillByName(name, allSkills)` 工具函数: bare name 唯一匹配直接返回, 多匹配交互选择, 完整 key 精确匹配
- [x] 3.2 在 uninstall 命令中接入 `resolveSkillByName` 替代现有查找逻辑
- [x] 3.3 在 add 命令中接入 `resolveSkillByName` 替代现有查找逻辑
- [x] 3.4 在 group add/remove 命令中接入 `resolveSkillByName`

## 4. 测试

- [x] 4.1 为 `findInstalledCustomSkills` 和 `findCustomSkillByKey` 编写单元测试
- [x] 4.2 为 `resolveSkillByName` 编写单元测试 (唯一匹配、多匹配、完整 key、无匹配)
- [x] 4.3 为 batch install 同名共存场景编写 e2e 测试: 已有 `custom/skill-a`, 再 `install ./dir` 包含 skill-a, 两者共存
- [x] 4.4 为消歧义交互编写 e2e 测试: uninstall/add 时 bare name 触发选择
