## 1. add 补 agent (RED → GREEN)

- [x] 1.1 在 `add.test.ts` 写失败测试: 已部署 skill (仅 codex bridge) 执行 `add <skill> -a claude-code` → 创建 `.claude/skills` bridge, codex bridge 与 `.agents/skills/<skill>` 不受影响
- [x] 1.2 在 `add.test.ts` 写失败测试: bridge 已存在时 `add <skill> -a <agent>` 幂等, 不重复创建、不报错
- [x] 1.3 在 `add.test.ts` 写失败测试: 带 companions 的已部署 skill 补 agent → 补写该 agent companions 并记录到 `deployments.json`
- [x] 1.4 改 `handleSkillName`: 移除 `alreadyExists` 裸早退; 改为解析 agent → `ensureSymlinkBridges(selectedAgents)`; 若 skill 有 companions 则 `deploySkill(skill, mode, selectedAgents)` 补写
- [x] 1.5 改 `handleRepoSkillSelection`: `allDeployed` 分支与 `newSkills.length===0` 分支在 return 前调用 `ensureSymlinkBridges(selectedAgents)` (对齐 `handleRemoteInstallAndDeploy`)
- [x] 1.6 跑 1.1–1.3 测试转 GREEN

## 2. add 无 -a 进入 agent 交互 (锁定已配置 agent)

- [x] 2.1 写失败测试: 已部署 skill 无 `-a` 时进入 agent 交互, 已有 bridge 的 agent 标记 locked + checked, 取消无效
- [x] 2.2 让补 agent 路径在无 `-a`/`--same-agents` 时走 `resolveTargetAgents` 的交互分支; agent 选择 prompt 支持锁定已配置 agent (复用 add 锁定语义, 下沉到 agent 粒度)
- [x] 2.3 跑 2.1 测试转 GREEN

## 3. remove 对称: project 模式 -a 撤 bridge (RED → GREEN)

- [x] 3.1 在 `remove.test.ts` 写失败测试: 已建 codex+claude-code bridge, `remove <skill> -a claude-code` → 撤除 `.claude/skills` bridge + 清理 claude-code 该 skill companions; codex bridge 与 `.agents/skills/` 内容不变
- [x] 3.2 在 `remove.test.ts` 写失败测试: `remove <skill> -a <无 bridge 的 agent>` → no-op + 提示, 不抛致命错误
- [x] 3.3 在 `remove.test.ts` 写失败测试: `remove <skill>` 无 `-a` → 仍从 `.agents/skills/` 删该 skill (现有行为不回归)
- [x] 3.4 改 `remove.ts` project 模式: 当提供 `-a` 时, 解析 agents 并对每个 agent 撤 bridge (复用 deployer 既有撤 bridge 方法) + 按记录清理该 agent companions; 撤前打印警告 (该 agent 失去对全部 skill 访问)
- [x] 3.5 `removeSkillNames` 区分有/无 `-a` 两条路径; 在 `deployer` 上按需暴露撤 bridge / 按 agent 清 companion 的入口
- [x] 3.6 跑 3.1–3.3 测试转 GREEN

## 4. 收尾验证

- [x] 4.1 `pnpm run build` 通过, 无类型错误
- [x] 4.2 `pnpm test` 全绿; 确认 `add.test.ts` / `remove.test.ts` 既有用例无回归
- [x] 4.3 自查命令对称性: add 的每个新增 agent 能力在 remove 有对称反向能力
- [x] 4.4 函数 <50 行、文件 <800 行、行宽 ≤88、不可变性、显式错误处理复核
