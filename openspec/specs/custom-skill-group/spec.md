# Custom Skill Group

## Purpose
**此 capability 已废弃.**  物理 group 目录概念已移除, 分组功能迁移到虚拟 group (groups.json).  参见 `virtual-group` capability.

## Requirements

### Requirement: 物理 group 目录已废弃
系统 SHALL NOT 再以物理目录形式 (`custom/{group}/`) 管理 skill 分组.  分组功能 SHALL 通过虚拟 group (`groups.json`) 提供, 参见 `virtual-group` capability.

#### Scenario: 不再创建物理 group 目录
- **WHEN** 用户需要对 custom skill 分组
- **THEN** 系统 SHALL 使用虚拟 group, 不创建 `custom/{group}/` 目录层级
