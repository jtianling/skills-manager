## Why

当前 group 功能基于物理目录 (`custom/{group}/{skill}/`), skill 只能属于一个 group, 且 official/community skill 无法加入用户自定义 group.  用户需要的是按场景 (python/rust/frontend/backend) 组织 skill 集合并批量部署, 同一 skill 可属于多个 group, 更新一处即全部生效.

## What Changes

- **BREAKING**: 废弃物理 group 目录 (`custom/{group}/{skill}/`), custom skill 全部平铺到 `custom/{skill}/`
- **BREAKING**: 移除 `custom-install` (`ci`) 子命令
- 新增 `groups.json` 集中存储虚拟 group 元数据, group 内存储 skill 的 source key 引用 (不拷贝文件)
- 新增 `group` 子命令: `list`, `create`, `delete`, `add`, `remove`
- `install --group <name>`: 安装 skill 后自动将其加入指定虚拟 group
- `add --group <name>`: 数据源从物理目录改为读 groups.json
- `uninstall`: 删除 skill 时自动清理 groups.json 中所有引用
- `group add` 按 skill name 匹配, 同名冲突时报错要求用完整 source key

## Capabilities

### New Capabilities
- `virtual-group`: groups.json 存储, GroupsService CRUD, group 子命令 (list/create/delete/add/remove)

### Modified Capabilities
- `batch-add-by-group`: 数据源从物理目录改为 groups.json
- `custom-install`: 移除 `ci` 子命令, 移除物理 group 目录写入逻辑
- `custom-skill-group`: 废弃物理 group 扫描, custom skill 平铺存储
- `custom-update`: 移除 group 路径查找逻辑, custom skill 只在 `custom/{name}/` 下查找
- `custom-skill-lookup`: 移除 group 路径优先匹配逻辑
- `source-management`: install --group 时 source key 不再包含 group 路径
- `skill-grouping`: list/promptSkills 中 custom skill 不再有 subGroup 分组
- `interactive-uninstall`: uninstall 时清理 groups.json 引用

## Impact

- `src/commands/install-local.ts`: 移除 group 目录逻辑
- `src/commands/install-utils.ts`: 移除 `getCustomSkillDir`/`getCustomSkillKey` 的 group 参数
- `src/commands/add.ts`: `handleGroupBatchDeploy` 改为读 groups.json
- `src/commands/uninstall.ts`: 卸载时清理 group 引用
- `src/commands/list.ts`: custom skill 不再按 group 子目录分组
- `src/services/skills.ts`: custom 扫描不再递归 group 子目录
- `src/types.ts`: `InstallOptions.group` 语义变更
- 新增 `src/services/groups.ts`: GroupsService
- 新增 `src/commands/group.ts`: group 子命令
