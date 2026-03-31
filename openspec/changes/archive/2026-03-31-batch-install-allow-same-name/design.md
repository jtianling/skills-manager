## Context

当前 skill 的唯一标识在 install 层用 source key (`custom/skillName`), 但在 batch install 场景中, 不同目录来源的同名 skill 会产生 key 冲突.  `findInstalledCustomSkill` 按 bare name 查找, 找到任意同名 skill 即返回, 导致 batch install 被重定向到已有路径.

现有行为:
- `installFromLocalDirBatch` 调用 `findInstalledCustomSkill(name)` → 找到 → 用已有路径 → 触发 overwrite
- `selectSkills` 把所有 `findInstalledCustomSkill` 匹配的标记为 installed/locked
- 全部 locked → "All skills already installed" → 空结果 → group 不创建

## Goals / Non-Goals

**Goals:**
- 不同来源目录的同名 skill 可以共存于 `custom/` 下
- batch install 始终安装到 `custom/{dirName}/{skillName}/`, 不因同名而跳过
- source key 包含子目录以保证唯一性
- bare name 有歧义时提供交互消歧义

**Non-Goals:**
- 不改变单 skill install 行为 (`install ./single-skill` 仍装到 `custom/{name}/`)
- 不支持同一项目 deploy 多个同名 skill (用户自行管理)
- 不引入版本管理或 alias 机制

## Decisions

### D1: source key 包含子目录

batch install 的 source key 改为 `custom/{dirName}/{skillName}`.

- `skillsmgr install ./develop` 中的 jt-codex → key: `custom/develop/jt-codex`
- `skillsmgr install ./jt-codex` (单 skill) → key: `custom/jt-codex` (不变)

**替代方案**: 保持 key 不含子目录, 用路径区分 → 但 key 不唯一, groups.json 和 sources.json 会冲突.

### D2: batch install 已安装判断基于目标路径

`installFromLocalDirBatch` 中, "已安装"的判断从 `findInstalledCustomSkill(name)` (按 bare name) 改为检查 `custom/{dirName}/{skillName}/` 是否存在.

- `custom/jt-codex` 存在 + `custom/develop/jt-codex` 不存在 → develop 下的 jt-codex 视为未安装
- `custom/develop/jt-codex` 存在 → 视为已安装, 可选 overwrite

### D3: findInstalledCustomSkills 返回数组

新增 `findInstalledCustomSkills(skillName): InstalledCustomSkill[]` (复数), 返回所有匹配指定 name 的 custom skill.  原 `findInstalledCustomSkill` 保留, 用于单 skill install 等只需单结果的场景.

### D4: 消歧义策略

统一消歧义模式, 在 uninstall, add 等命令中复用:
1. bare name 只匹配一个 → 直接使用
2. bare name 匹配多个 → 列出完整 key, 交互让用户选择
3. 用户传入完整 key (如 `custom/develop/jt-codex`) → 精确匹配, 跳过消歧义

消歧义逻辑抽为独立工具函数, 各命令调用.

## Risks / Trade-offs

- [source key 格式变更] → groups.json 和 sources.json 中已有的 `custom/skillName` 条目不受影响, 新 batch install 产生的条目使用新格式.  两种格式共存, 无需迁移.
- [findInstalledCustomSkill 扫描范围] → 需要扫描 custom/ 的子目录子目录 (两层), 对于 skill 数量很大的情况可能有性能影响, 但 custom/ 规模有限, 可忽略.
- [消歧义交互增加] → 之前不会遇到同名, 现在 uninstall/add 等命令可能弹出选择提示.  用完整 key 可避免.
