## Why

用户在工作目录中常以子目录组织相关 skills (如 `./openspec/` 下 10 个 skill).  当前 `install` 对本地路径只支持安装单个 skill (要求根目录含 SKILL.md), 无法一次性安装整个目录.  需要让 `install ./openspec` 能批量安装目录下所有 skills 并自动分组.

## What Changes

- `install` 本地路径回退逻辑: 目标目录无 SKILL.md 时, 扫描子目录作为多 skill 目录批量安装
- 批量安装时物理存储到 `custom/{dirName}/{skillName}/`, 自动创建以目录名命名的虚拟 group (可被 `--group` 覆盖)
- `SkillsService` custom skill 发现逻辑支持两层扫描 (`custom/{name}/SKILL.md` + `custom/{group}/{name}/SKILL.md`)
- `findInstalledCustomSkill` 同样支持两层查找
- `uninstall` 清理空的物理父目录
- skill key 保持 `custom/{skillName}` 不变, 物理子目录仅为存储组织

## Capabilities

### New Capabilities
- `install-directory-batch`: 本地目录批量安装 skills 并自动分组, 含物理子目录存储和虚拟 group 创建

### Modified Capabilities
- `custom-install`: 回退逻辑 (无 SKILL.md 时扫描子目录), `getCustomSkillDir` 支持可选 subdirectory 参数
- `virtual-group`: install 批量安装时自动创建虚拟 group
- `uninstall`: 删除 skill 后清理空的物理父目录

## Impact

- `src/commands/install-local.ts`: `installFromLocalDir` 增加回退扫描逻辑
- `src/commands/install-utils.ts`: `getCustomSkillDir`, `findInstalledCustomSkill` 支持子目录
- `src/services/skills.ts`: `getSkillsFromSource('custom')` 两层扫描
- `src/commands/uninstall.ts`: 删除后清理空父目录
- `src/commands/install.ts`: 传递 group 参数到批量安装流程
