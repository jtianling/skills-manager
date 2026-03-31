## Context

虚拟 group 系统使用 `groups.json` (`Record<string, string[]>`) 存储 group 名到 skill key 数组的映射.  当前支持 create/delete/add/remove 操作, 但缺少 rename.  用户改名只能 delete + create + 逐个 add, 操作繁琐且容易丢失 skill 引用.

## Goals / Non-Goals

**Goals:**
- 支持 `skillsmgr group rename <old> <new>` 一步完成 group 改名
- 保持与现有 group 命令一致的错误处理和校验风格

**Non-Goals:**
- 不修改物理目录结构 (rename 仅影响 groups.json 的 key)
- 不修改 group 内的 skill key 引用
- 不处理物理 group 与虚拟 group 名称同步

## Decisions

### 1. 纯 JSON key 重命名

在 `GroupsService` 中新增 `renameGroup(oldName, newName)` 方法.  实现为: 将 `data[newName] = data[oldName]`, 然后 `delete data[oldName]`.

**备选方案**: delete + create + 逐个 addSkill.  但不如直接操作 JSON key 简洁, 且多次 save 不如一次高效.

### 2. 前置校验顺序

1. `validateGroupName(newName)` — 新名字格式合法
2. `oldName` 存在 — 否则报错
3. `oldName !== newName` — 相同名字报错
4. `newName` 不存在 — 否则报错 (避免覆盖)

与 createGroup/deleteGroup 的校验风格一致.

## Risks / Trade-offs

- [虚拟名与物理目录脱节] → 设计如此, 虚拟 group 本身就是解耦的元数据层.  不做 mitigation.
