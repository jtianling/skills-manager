## Context

`install` 命令的职责是将 skill 从源(GitHub repo, 本地路径, zip)下载到中央仓库 `~/.skills-manager/`. 它不涉及向项目部署或 agent 选择 — 这是 `add` 命令的职责.

当前 `install.ts` 注册了 `-a, --agent` 选项, `InstallOptions` 类型包含 `agent` 字段, 但 `executeInstall` 和 `installBySourceType` 从未读取这个字段. 这是一个从未实现的废弃选项.

## Goals / Non-Goals

**Goals:**
- 移除 install 命令中无功能的 `-a` 选项
- 保持 `InstallOptions` 类型干净
- 同步更新 spec 文档

**Non-Goals:**
- 不改变 `add` 和 `remove` 的 `-a` 行为(它们正常工作)
- 不重构 `resolveTargetAgents` 或其他共享工具函数

## Decisions

1. **直接删除, 不做废弃过渡**: install 的 `-a` 从未生效过, 没有用户依赖它, 无需 deprecation warning.

2. **同步更新 spec**: `skill-agent-flags` spec 第 27 行声明 install 支持 `--agent`, 需更正为只有 `add, remove` 支持.

## Risks / Trade-offs

无实质风险. 删除的是从未生效的死代码.
