## REMOVED Requirements

### Requirement: custom-install --group 选项
**Reason**: 物理 group 目录废弃, custom skill 全部平铺到 `custom/{name}/`. 分组通过虚拟 group (groups.json) 实现.
**Migration**: 使用 `skillsmgr install ./skill --group <name>` 安装并入组, 或 `skillsmgr group add <group> <skill>` 手动入组.

### Requirement: custom 目录分组扫描
**Reason**: 不再有分组子目录, custom 目录只扫描一级子目录.
**Migration**: 已有的 `custom/{group}/{skill}/` 目录需手动移动到 `custom/{skill}/`.

### Requirement: custom-update 适配分组路径
**Reason**: custom skill 只在 `custom/{name}/` 下, 不再有分组路径.
**Migration**: 无需适配, 直接在 `custom/{name}/` 下查找和更新.
