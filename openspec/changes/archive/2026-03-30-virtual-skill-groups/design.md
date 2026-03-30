## Context

当前 group 基于物理目录实现 (`custom/{group}/{skill}/`), 限制了 skill 只能属于一个 group, 且 official/community skill 无法加入用户 group.  需要改为纯元数据的虚拟 group 系统.

相关代码:
- `src/commands/install-utils.ts`: `getCustomSkillDir`/`getCustomSkillKey` 带 group 参数
- `src/commands/install-local.ts`: 安装到 group 子目录
- `src/commands/add.ts`: `handleGroupBatchDeploy` 从物理目录读取
- `src/services/skills.ts`: custom 目录扫描区分 group/非 group

## Goals / Non-Goals

**Goals:**
- 虚拟 group: 一个 skill 可属于多个 group, official/community/custom 均可入组
- 集中元数据: `groups.json` 存储所有 group→skill 映射
- 统一更新: 更新 skill 一处, 所有 group 引用自动生效
- `group` 子命令: 完整的 CRUD 操作
- `install --group`: 安装后自动入组

**Non-Goals:**
- 向后兼容物理 group 目录
- 迁移工具 (用户需手动处理已有物理 group)
- group 间的依赖或继承关系
- group 的远程同步/分享

## Decisions

### 1. groups.json 存储格式

```json
{
  "python": ["custom/my-linter", "official/anthropic/skills/commit"],
  "rust": ["custom/my-linter", "community/obra/superpowers/debug"]
}
```

key 为 group name, value 为 skill source key 数组.  source key 与 `SkillsService.getAllSkills()` 返回的 `skill.source + "/" + skill.name` 路径对应.

**替代方案**: 每个 group 一个文件 → 对 skill 数量级来说过度设计, 单文件更简单.

### 2. GroupsService 职责

新增 `src/services/groups.ts`, 提供:
- `listGroups()`: 返回所有 group 名
- `getGroup(name)`: 返回 group 内 skill key 数组
- `createGroup(name)`: 创建空 group
- `deleteGroup(name)`: 删除 group
- `addSkill(group, skillKey)`: 添加 skill 引用
- `removeSkill(group, skillKey)`: 移除 skill 引用
- `removeSkillFromAll(skillKey)`: 从所有 group 中移除某 skill (供 uninstall 调用)

读写 `~/.skills-manager/groups.json`.  文件不存在时视为空 `{}`.

### 3. skill 标识解析 (group add 时)

用户输入 skill name → 调用 `SkillsService.getAllSkills()` 查找:
1. 精确匹配 name, 唯一 → 使用其 source key
2. 精确匹配 name, 多个 → 报错列出所有匹配的完整 key
3. 无匹配 → 尝试作为完整 source key 匹配
4. 仍无匹配 → 报错 skill 未安装

### 4. skill source key 格式

统一为 `{source}/{name}`:
- `custom/my-linter`
- `official/anthropic/skills/commit`
- `community/obra/superpowers/debug`

这与 `SkillInfo.source + "/" + SkillInfo.name` 一致.

### 5. 废弃物理 group

- `SkillsService.getSkillsFromSource("custom")`: 只扫描 `custom/` 一级子目录, 不递归
- `getCustomSkillDir(name)`: 移除 group 参数, 始终返回 `custom/{name}/`
- `getCustomSkillKey(name)`: 移除 group 参数, 始终返回 `custom/{name}`
- 已有的 `custom/{group}/{skill}/` 目录被忽略 (不报错, 不扫描)

### 6. install --group 语义

安装流程不变, 安装完成后额外调用 `GroupsService.addSkill(group, skillKey)`.  group 不存在时自动创建.

### 7. 移除 custom-install 命令

`ci` 子命令整个移除.  本地安装统一通过 `install` 命令 (已支持本地路径).

## Risks / Trade-offs

- **悬空引用**: 用户手动删除 skill 目录但未通过 `uninstall` → groups.json 中留下悬空 key → `add --group` 时跳过不存在的 skill 并警告
- **物理 group 数据丢失**: 升级后已有 `custom/{group}/{skill}/` 不再被识别 → 用户需手动移动文件. 接受此风险, 不做兼容
- **groups.json 并发写入**: 单 CLI 进程, 不存在并发问题
