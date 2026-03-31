## 1. 移除 install 命令的 -a 选项

- [x] 1.1 删除 `src/commands/install.ts` 中 `.option('-a, --agent ...')` 注册
- [x] 1.2 删除 `src/types.ts` 中 `InstallOptions` 的 `agent` 字段

## 2. 更新 spec

- [x] 2.1 更新 `openspec/specs/skill-agent-flags/spec.md`, 将 install 从 --agent 支持列表移除, 更新相关 scenario
