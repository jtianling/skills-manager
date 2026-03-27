## Why

当前 `add` 命令功能单一, 只能从中央仓库已安装的 skills 中部署到项目.  用户要添加一个新 skill, 必须先 `install` 再 `add`, 流程割裂.  同时 `add` 不带参数时无法使用, 而 `init` 的批量选择能力没有被复用.  需要将 `add` 打造为统一入口, 根据参数格式智能分流, 一步完成从发现到部署的全流程.

## What Changes

- `add` 参数从必填改为可选, 不带参数时执行 `init` 流程
- 新增参数格式智能路由: 纯名称 → 中央仓库搜索, `owner/repo` → 先查中央仓库再尝试远程安装, 完整 URL → 直接远程安装
- 远程安装后展示 skill 选择列表(已部署的预选且锁定, 未部署的可选择), 选中后部署到项目
- 新增 `-a`/`--agent` 标志: 逗号分隔指定目标 agent, 跳过交互选择
- 新增 `-s`/`--same-agents` 标志: 复用项目已配置的 agents, 跳过交互选择
- 远程安装 + 部署的原子性: 用户取消或部署失败时回滚中央仓库的安装
- 用户交互中的 "tools" 术语统一改为 "agents", 与 vercel-labs/skills 生态一致

## Capabilities

### New Capabilities

- `smart-add`: 增强的 add 命令, 覆盖参数路由(无参数/skillname/owner-repo/URL 四种模式), 远程安装集成, agent 选择标志(-a/-s), 以及 install+deploy 原子性回滚机制

### Modified Capabilities

- `cli-interaction`: add 命令定义变更 — 参数改为可选, 新增 -a/--agent 和 -s/--same-agents 标志
- `tool-integration`: 用户面术语从 "tools" 改为 "agents"(提示文本, 分组标题等)

## Impact

- `src/commands/add.ts`: 主要改动文件, 从简单的单 skill 部署重构为智能路由入口
- `src/commands/init.ts`: `executeInit` 需被 `add` 无参数模式复用, 可能需要提取为可调用函数
- `src/commands/install.ts`: 远程安装逻辑需被 `add` 复用, 需提取 install 核心逻辑为独立函数
- `src/utils/prompts.ts`: agent 选择相关的提示函数, 术语从 "tools" 改为 "agents"
- `src/types.ts`: `AddOptions` 类型扩展, 新增 agent/sameAgents 字段
- `src/tools/configs.ts`: 可能涉及显示名称调整
- 无 **BREAKING** 变更 — 现有 `install` 命令保持独立不变
