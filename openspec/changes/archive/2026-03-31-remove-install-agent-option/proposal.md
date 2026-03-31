## Why

`install` 命令注册了 `-a, --agent` 选项但从未使用. install 流程只负责从源下载 skill 到中央仓库, 不涉及 agent 部署, agent 选择在后续 `add` 命令中完成. 这个选项误导用户, 且与 spec 描述不一致.

## What Changes

- 移除 `install` 命令的 `-a, --agent` 选项注册
- 移除 `InstallOptions` 类型中的 `agent` 字段
- 更新 `skill-agent-flags` spec, 将 install 从 `--agent` 支持列表中移除

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `skill-agent-flags`: 移除 install 命令对 `--agent` 参数的要求, 因为 install 只操作中央仓库不涉及 agent 部署

## Impact

- `src/commands/install.ts`: 移除 option 注册
- `src/types.ts`: 移除 `InstallOptions.agent` 字段
- `openspec/specs/skill-agent-flags/spec.md`: 更新 spec 描述
