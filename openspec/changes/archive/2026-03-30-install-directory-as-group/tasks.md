## 1. Custom Skill 基础设施

- [x] 1.1 修改 `getCustomSkillDir` 接受可选 `subdirectory` 参数, 有值时返回 `custom/{subdirectory}/{skillName}/`
- [x] 1.2 修改 `findInstalledCustomSkill` 支持两层查找: 先查 `custom/{name}/`, 再扫描 `custom/*/{name}/`
- [x] 1.3 修改 `SkillsService.getSkillsFromSource('custom')` 支持两层扫描: 子目录无 SKILL.md 时继续向下一层查找

## 2. 批量安装核心逻辑

- [x] 2.1 修改 `installFromLocalDir` 回退逻辑: 无 SKILL.md 时调用 `scanSkillDirectories` 扫描子目录
- [x] 2.2 实现批量安装流程: 调用 `selectSkills` 选择 → 逐个安装到 `custom/{dirName}/{skillName}/` → 记录 sources.json
- [x] 2.3 批量安装完成后自动创建虚拟 group (目录名或 `--group` 指定名), 将所有 skill key 加入 group

## 3. 测试

- [x] 3.1 为 `findInstalledCustomSkill` 两层查找编写单元测试
- [x] 3.2 为 `SkillsService` custom 两层扫描编写单元测试
- [x] 3.3 为批量安装流程编写集成测试 (含 --group 覆盖, --all, --skill 过滤)
