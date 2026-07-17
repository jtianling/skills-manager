## 1. Codex 原生配置与选择解析

- [x] 1.1 先更新 config/prompt/scanner 单元测试，断言 Codex归入 Agents Skills Standard、无 `.codex/skills` bridge 且无 bridge 时仍 configured
- [x] 1.2 将 Codex 工具配置改为 native 并更新项目级 agent 选择、扫描与列表行为
- [x] 1.3 增加项目级标准虚拟选择到真实 native agent 集合的规范化 helper 及单元测试

## 2. TargetAgents 与 Companion 集成

- [x] 2.1 先增加 add/deploy 测试，覆盖标准选择匹配 `targetAgents: ["codex"]` 及排除未选 non-native agent
- [x] 2.2 在 add/deploy 的候选过滤和显式兼容性校验中使用规范化后的真实 agent 集合
- [x] 2.3 先增加 deployer/add 测试，覆盖标准选择部署 Codex companion 且跳过未选 non-native companion
- [x] 2.4 在项目级 companion 部署路径使用规范化后的真实 agent 集合，同时保留 bridge 生命周期使用原始选择

## 3. 回归验证

- [x] 3.1 更新所有仍断言 Codex 为 non-native bridge 的对称 add/remove/deploy/scanner 测试
- [x] 3.2 运行相关 Vitest 测试、完整单元测试和构建
- [x] 3.3 检查命令对称性、add/deploy 锁定语义和非目标 agent bridge 未受影响
