## 1. CLI 选项声明

- [x] 1.1 `add` 命令 Commander.js 注册 `--all` 选项(若尚未显式注册)和 `-y, --yes` 选项
- [x] 1.2 `remove` 命令 Commander.js 注册 `--all` 选项, `-y, --yes` 选项, `--same-agents` 选项(若尚未有)

## 2. -y 标志展开逻辑

- [x] 2.1 在 `src/utils/prompts.ts` 或新建工具函数中实现 `expandYesFlag(options)`: 若 `options.yes` 为 true, 按规则设置 `sameAgents` 和 `all`
- [x] 2.2 为 `expandYesFlag` 编写单元测试, 覆盖: 纯 -y, -y + -a, -y + -s, -y + --all, -y + --same-agents, -y + -a + -s(不展开)

## 3. add 命令交互顺序反转

- [x] 3.1 `handleRepoSkillSelection()` 重构: 先调用 `resolveTargetAgents()`, 再调用 skill 选择; 流程入口处调用 `expandYesFlag`
- [x] 3.2 `handleRemoteInstallAndDeploy()` 重构: 同样反转 agent/skill 交互顺序
- [x] 3.3 `handleSkillName()` 审查: skill 已确定, 确认仅需 agent 选择, 无需改动则标记完成
- [x] 3.4 更新 `add.test.ts` 中受影响的测试用例, 验证新的交互顺序

## 4. remove 命令交互顺序反转

- [x] 4.1 `removeByOwnerRepo()` 重构: 先调用 agent 解析, 再进入 skill 选择; 流程入口处调用 `expandYesFlag`
- [x] 4.2 审查 `interactiveRemove()` 和 `removeByGroup()`: 确认是否需要同步调整交互顺序
- [x] 4.3 更新 `remove-owner-repo.test.ts` 和相关测试用例

## 5. 集成验证

- [x] 5.1 运行全量单元测试 `pnpm test`, 确保无回归
- [x] 5.2 手动验证核心场景: `add owner/repo`(先 agent 后 skill), `add owner/repo -y`, `add owner/repo -a x -s y`(无交互), `remove owner/repo -y`
