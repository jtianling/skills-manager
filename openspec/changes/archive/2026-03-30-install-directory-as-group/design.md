## Context

当前 `installFromLocalDir` 要求目标路径根目录包含 SKILL.md, 只能安装单个 skill.  用户在工作目录中常以子目录组织相关 skills (如 `./openspec/` 下 10 个 skill), 需要一次性批量安装并自动分组.

现有基础设施:
- `scanSkillDirectories()` 已支持递归扫描子目录找 SKILL.md
- `selectSkills()` 已支持交互选择/`--all`/`--skill` 过滤
- `cleanEmptyParents()` 已在 uninstall 中实现空目录清理
- `GroupsService` 已支持虚拟分组的完整 CRUD

## Goals / Non-Goals

**Goals:**
- `install ./dir` 在目标无 SKILL.md 时回退为批量安装目录下所有 skills
- 批量安装的 skills 物理存储到 `custom/{dirName}/{skillName}/`
- 自动创建以目录名命名的虚拟 group, `--group` 可覆盖
- `SkillsService` 和 `findInstalledCustomSkill` 支持两层 custom 目录扫描
- uninstall 后自动清理空物理父目录 (已有 `cleanEmptyParents`)
- skill key 保持 `custom/{skillName}` 不变

**Non-Goals:**
- 不支持嵌套超过两层的 custom 目录
- 不改变虚拟 group 的 add/remove/delete 语义
- 不支持通过文件系统直接管理分组
- 不改变 official/community 的安装流程

## Decisions

### D1: 回退式检测, 而非新命令或新 flag

`install ./openspec` 先检查 SKILL.md, 无则扫描子目录.  不引入 `--batch` flag 或 `install-dir` 子命令.

**替代方案**: 新增 `--batch` flag 显式标记批量安装.  放弃, 因为回退逻辑自然且向后兼容, 用户无需记忆额外 flag.

### D2: 物理子目录 + 虚拟 group 双重记录

批量安装时:
- 物理: `custom/{dirName}/{skillName}/`
- 虚拟: `groups.json` 中创建 `{dirName}` group (或 `--group` 指定的名字)

groups.json 是分组的唯一真相源.  物理子目录仅为存储组织, 对 group 语义透明.

**替代方案**: 纯虚拟 (物理仍平铺到 `custom/{skillName}/`).  放弃, 因为物理子目录让文件系统可读, 便于用户理解来源.

### D3: skill key 保持 `custom/{skillName}`

不将物理子目录编码进 skill key.  所有现有引用 skill key 的代码 (group add, deploy, remove 等) 无需修改.

`findInstalledCustomSkill` 改为两层扫描: 先查 `custom/{name}/SKILL.md`, 再查 `custom/*/{name}/SKILL.md`.

### D4: `getCustomSkillDir` 接受可选 subdirectory 参数

```typescript
getCustomSkillDir(skillName: string, subdirectory?: string): string
```

- 无 subdirectory: `custom/{skillName}/` (现有行为)
- 有 subdirectory: `custom/{subdirectory}/{skillName}/`

批量安装时传入目录名作为 subdirectory.

### D5: `--group` 覆盖自动命名, 不影响物理目录

```
install ./openspec              → 物理: custom/openspec/*, group: "openspec"
install ./openspec --group tools → 物理: custom/openspec/*, group: "tools"
```

`--group` 只影响 groups.json 中的 group 名, 物理存储位置始终由源目录名决定.

### D6: 复用现有机制

- 子目录扫描: 复用 `scanSkillDirectories(dir, maxDepth=1)`
- skill 选择: 复用 `selectSkills()` (支持 `--all`, `--skill`, 交互)
- 空目录清理: uninstall 已有 `cleanEmptyParents`, 无需改动

## Risks / Trade-offs

- **skill name 冲突**: 两层扫描可能在 `custom/a/` 和 `custom/b/` 下发现同名 skill → `findInstalledCustomSkill` 返回第一个匹配, 与现有 name-based 查找一致.  后续可增强为提示用户选择.
- **SkillsService custom 扫描性能**: 两层扫描增加一层目录遍历 → 对 custom 目录规模 (通常 <100) 无影响.
