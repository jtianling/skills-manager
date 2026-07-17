## Why

Codex 现在原生扫描项目及用户级 `.agents/skills`, 但 skillsmgr 仍将其建模为
需要 `.codex/skills` bridge 的 non-native agent。这会产生冗余 symlink、误导性的
交互分类，并使 Agents Skills Standard 虚拟选项与 Codex 的 `targetAgents` /
companion 语义脱节。

## What Changes

- 将 Codex 标记为原生支持 Agents Skills Standard，不再创建或要求
  `.codex/skills -> .agents/skills` bridge。
- 在项目级 agent 选择和 deployed 状态输出中，将 Codex归入
  “Agents Skills Standard” 聚合项。
- 保留 `codex` 作为真实 agent ID，继续用于 `targetAgents`、全局部署和
  Codex 专属 companions。
- 让项目级 “Agents Skills Standard” 虚拟选择在兼容性过滤和 companion
  部署时解析为全部可见 native agent，确保 `targetAgents: ["codex"]` 正确匹配。
- 扫描已有项目时，不再通过 `.codex/skills` bridge 判定 Codex 是否 configured；
  只要 `.agents/skills` 中存在部署，Codex即作为 native agent 被识别。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `tool-integration`: Codex 从 non-native bridge 工具变为 Agents Skills Standard
  原生工具，并明确虚拟标准选项的真实 agent 展开语义。
- `cli-interaction`: deployed 列表与项目级 agent 选择将 Codex显示在标准聚合项中。
- `symlink-bridge`: Codex 不再创建、检测或移除 `.codex/skills` bridge。
- `skill-target-agents`: 标准聚合选择能匹配 `targetAgents: ["codex"]`。
- `skill-companions`: 标准聚合选择能部署面向 Codex 等 native agent 的 companion。

## Impact

影响 `src/tools/configs.ts`、agent prompt/selection 解析、deployment scanner、
`add`/`deploy` 的 targetAgents 与 companion 调用路径，以及相应 unit/E2E specs。
现有 `.codex/skills` symlink 不再是 Codex 可用性的必要条件；本变更不会主动删除
用户已有的冗余 bridge，避免升级时产生破坏性副作用。
