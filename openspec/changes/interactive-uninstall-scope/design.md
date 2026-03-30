## Context

`uninstall` 命令当前有 4 个分支:

1. 无参数 → `interactiveUninstall()` (交互式 checkbox)
2. `OFFICIAL_OWNERS[identifier]` → `uninstallProvider()` (批量删除)
3. `owner/repo` → `uninstallCommunitySource()` (批量删除)
4. 其他 → `uninstallByName()` (按名查找)

分支 2 和 3 直接批量删除, 不给用户选择.  `install` 已移除 provider shorthand, `uninstall` 的 `OFFICIAL_OWNERS` 分支是遗留逻辑.

## Goals / Non-Goals

**Goals:**

- `uninstall owner/repo` 默认展示交互式 checkbox, 让用户选择卸载哪些 skills
- 移除 `OFFICIAL_OWNERS` provider 分支, 裸词统一走 `uninstallByName()`
- `--all` 参数恢复批量删除行为

**Non-Goals:**

- 不改变无参数交互模式的行为
- 不改变 `-s/--skill` 和 `-f/--force` 的行为
- 不重构底层删除/清理逻辑

## Decisions

### 1. 合并 `uninstallProvider` 和 `uninstallCommunitySource` 为统一的 `uninstallSource`

**选择**: 将两个函数合并为一个 `uninstallSource(sourceDir, sourcePrefix)`, 内部加入交互式选择.

**理由**: 两个函数逻辑几乎一致 (扫描 skills → 确认 → 删除 → 清理), 唯一区别是目录前缀.  合并后减少重复, 且交互逻辑只需写一次.

**替代方案**: 分别给两个函数加交互 — 代码重复, 维护成本高.

### 2. `--all` 参数跳过交互

**选择**: 新增 `--all` boolean option, 为 true 时跳过 checkbox 直接批量删除 (即原行为).

**理由**: 与 `install --all` 对称.  脚本化场景需要非交互路径.

### 3. 单个 skill 时跳过 checkbox

**选择**: 当 scoped 范围内只有 1 个 skill 时, 跳过 checkbox, 直接走确认删除流程.

**理由**: 单选 checkbox 无意义, 直接确认更高效.

### 4. 移除 `OFFICIAL_OWNERS` 路由分支

**选择**: 删除 `executeUninstall` 中的 `OFFICIAL_OWNERS[identifier]` 判断, 裸词统一走 `uninstallByName()`.

**理由**: `install` 已移除 provider shorthand.  裸词 "anthropic" 应按 skill name 查找, 找不到报错.

### 5. `owner/repo` 路由同时覆盖 official 和 community

**选择**: `owner/repo` 格式不区分 official/community, 依次查找 `official/{owner}/{repo}` 和 `community/{owner}/{repo}`.

**理由**: 用户不需要关心 skill 的分类, 只需知道 `owner/repo`.

## Risks / Trade-offs

- **BREAKING**: `uninstall anthropic` 不再整删 provider, 而是按 skill name 查找.  → 用 `uninstall anthropics/skills --all` 替代.
- **行为变化**: `uninstall owner/repo` 从直接删除变为交互选择.  → `--all` 恢复原行为, 脚本可加 `--all`.
