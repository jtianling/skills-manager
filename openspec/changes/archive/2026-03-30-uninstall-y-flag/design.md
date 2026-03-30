## Context

`uninstall` 命令当前支持 `--all` (跳过选择提示) 和 `-f, --force` (跳过确认提示) 两个独立 flag.  用户需要同时传入 `--all -f` 才能实现完全非交互式卸载.  `-y` 是 CLI 工具中常见的 "yes to all" 惯例 (如 `apt-get -y`, `yum -y`), 需要作为快捷方式支持.

## Goals / Non-Goals

**Goals:**
- 添加 `-y` flag 作为 `--all --force` 的语义等价快捷方式
- 保持 `--all` 和 `-f` 原有行为不变

**Non-Goals:**
- 不修改其他命令 (install, remove 等) 的 flag 体系
- 不改变 uninstall 的核心卸载逻辑

## Decisions

### Decision 1: `-y` 映射为 `options.all = true` + `options.force = true`

在 Commander.js action handler 中, 当 `options.yes` 为 true 时, 将 `options.all` 和 `options.force` 都设为 true.  这样下游逻辑 (`uninstallSource`, `uninstallByName`, `confirmUninstall`) 无需任何修改.

**替代方案**: 在每个下游函数中检查 `options.yes` — 侵入性更大, 改动分散.

### Decision 2: `-y` 不与 `-f` 冲突

`-y` 隐含 `-f`, 但用户同时传入 `-y -f` 或 `-y --all` 不报错, 幂等处理.

## Risks / Trade-offs

- [风险] `-y` 可能被误用导致意外批量删除 → 与 `--all -f` 风险等级相同, 不引入新风险
