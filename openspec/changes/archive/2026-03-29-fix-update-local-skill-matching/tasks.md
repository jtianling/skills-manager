## 1. findInstalledCustomSkill 公共函数

- [x] 1.1 在 `src/commands/install-utils.ts` 中新增 `findInstalledCustomSkill(skillName): { key: string, path: string } | null`, 在 `~/.skills-manager/custom/` 下按 name 查找, 支持直接子目录和 group 子目录
- [x] 1.2 编写 `findInstalledCustomSkill` 的单元测试: 直接子目录匹配, group 子目录匹配, 未找到, 优先直接子目录

## 2. update 命令重构 local-path 匹配

- [x] 2.1 重构 `update.ts` 中 `sourceType === 'local-path'` 分支: 验证 source 路径存在且有 SKILL.md, 提取 skillName, 调用 `findInstalledCustomSkill` 查找, 不再依赖 sources.json url 匹配
- [x] 2.2 update 成功后维护 sources.json: 有记录则更新 url 和 updatedAt, 无记录则补写
- [x] 2.3 更新 `update.test.ts` 中 local-path 相关测试: 按 name 匹配, 从不同 CWD 匹配, source 不存在, skill 未安装

## 3. install 命令统一检测逻辑

- [x] 3.1 在 `install-local.ts` 的 `installFromLocalDir` 中, 用 `findInstalledCustomSkill(skillName)` 替代直接检查 targetDir 存在性
- [x] 3.2 处理同名 skill 不同 group 的情况: 已存在于其他 group 时报错, 不允许安装
- [x] 3.3 更新 install 相关测试

## 4. 集成验证

- [x] 4.1 确保 `pnpm test --run` 全部通过 (除 add.test.ts 已有的 2 个 pre-existing 失败)
- [x] 4.2 确保 `pnpm build` 成功
