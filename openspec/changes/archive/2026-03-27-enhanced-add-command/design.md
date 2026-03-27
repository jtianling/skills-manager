## Context

当前 `add` 命令仅支持从中央仓库已安装的 skills 中按名称查找并部署到项目.  用户需要先 `install` 再 `add`, 流程割裂.  本设计将 `add` 改造为统一入口, 根据参数格式智能分流, 一步完成发现 → 安装 → 部署的全流程.

现有代码结构:
- `src/commands/add.ts` — `executeAdd(name, options)`, 参数必填
- `src/commands/init.ts` — `executeInit(options)`, 包含完整的 tool 选择 + skill 选择 + 部署流程
- `src/commands/install.ts` — `executeInstall(source, options)`, 包含 source 解析 + 远程下载 + skill 选择
- `src/utils/prompts.ts` — `promptTools()`, `promptSkills()`, `promptSkillsToInstall()`, `interactiveCheckbox()`

## Goals / Non-Goals

**Goals:**
- `add` 成为用户添加 skill 的统一入口
- 无参数时复用 init 流程
- 有参数时根据格式智能路由到不同处理分支
- 支持 `-a`/`--agent` 和 `-s`/`--same-agents` 标志跳过 agent 选择
- 远程安装 + 部署失败时回滚
- 用户面术语从 "tools" 改为 "agents"

**Non-Goals:**
- 不改变 `install` 命令的独立性和现有行为
- 不重构内部代码中的 `tools`/`ToolConfig` 等命名 (后续单独做)
- 不改变 `init` 命令的行为
- 不新增远程 skill 搜索能力 (只搜索中央仓库)

## Decisions

### D1: 参数格式判断逻辑

**决定**: 按以下顺序判断 arg 格式:
1. 含 `://` → 完整 URL
2. 含 `/` 且不含 `://` → `owner/repo` 格式
3. 其他 → skill name

**备选**: 用正则精确匹配 GitHub URL vs Git URL vs owner/repo.
**理由**: 简单的字符串特征判断足够区分三种格式, 且与 install 命令现有的 source 解析逻辑一致.

### D2: 复用 init 和 install 的核心逻辑

**决定**: 提取可复用的核心函数:
- 从 `init.ts` 提取 init 流程为可被外部调用的函数 (当前 `executeInit` 即可直接调用)
- 从 `install.ts` 提取 install 核心逻辑为独立函数, 返回安装路径列表用于回滚
- 从 `prompts.ts` 新增 `resolveTargetAgents(options)` 函数统一处理 agent 选择

**备选**: 在 `add.ts` 中重新实现安装逻辑.
**理由**: 复用避免重复代码, 保持 install 和 add 行为一致.

### D3: 回滚策略

**决定**: 记录 install 阶段创建的路径列表, 在用户取消或 deploy 失败时:
1. 删除安装到中央仓库的 skill 目录
2. 清理 `sources.json` 中对应条目
3. 输出 "Installation rolled back."

**备选**: 不回滚, 保留已安装的 skills.
**理由**: 用户明确要求原子性 — add 是 "安装并部署" 的一步操作, 半成功状态违反直觉.

### D4: `-a`/`--agent` 支持逗号分隔多选

**决定**: `-a claude-code,cursor` 解析为 `['claude-code', 'cursor']`, 逗号分隔, 无空格.  验证每个值是否为合法的 tool name, 不合法时报错退出.

**备选**: 多次指定 `-a claude-code -a cursor`.
**理由**: 逗号分隔更简洁, 与 vercel-labs/skills 的 `--agent` 风格一致.

### D5: `-s`/`--same-agents` 语义

**决定**: 获取项目中已配置的 agents (通过 `getConfiguredTools()`), 无配置时报错: "No agents configured. Run 'skillsmgr init' or omit -s flag."

**理由**: 复用已有逻辑, 语义清晰 — "和当前项目已配置的 agents 保持一致".

### D6: owner/repo 在中央仓库中查找时的匹配逻辑

**决定**: 遍历 `official/`, `community/` 目录, 匹配 `{owner}/{repo}` 路径:
- `official/{providerKey}/{repo}` — 需将 providerKey 对应的 owner 与输入的 owner 比较
- `community/{owner}/{repo}` — 直接匹配

**备选**: 只匹配目录结构, 不考虑 official provider 的 owner 映射.
**理由**: official provider 的目录名是 providerKey (如 `anthropic`), 而输入可能是 owner (如 `anthropics`), 需要通过 OFFICIAL_PROVIDERS 映射.

### D7: Skill 选择列表中 "已部署锁定" 的实现

**决定**: 在 `interactiveCheckbox` 的 choices 中, 已部署 skill 设置 `checked: true` 和 `disabled: true` (或等效的 locked 标记).  disabled 状态下 Space 键无效果, 视觉上使用不同颜色 (如灰色) 表示不可操作.

**备选**: 不显示已部署的 skills.
**理由**: 显示完整列表让用户了解 repo 的全貌, 锁定防止误操作 (删除应通过 `remove` 命令).

### D8: 用户面术语 "agents" 替换

**决定**: 以下位置的 "tools" 改为 "agents":
- `promptTools()` 的提示消息 → `promptAgents()` (函数重命名)
- interactiveCheckbox 中工具选择的 `message` 参数
- `list --deployed` 输出中的 "Configured tools:" → "Configured agents:"
- CLI `-a` 标志命名为 `--agent`
- CLI `-s` 标志命名为 `--same-agents`

不改动的位置 (内部实现, 后续重构):
- `ToolConfig`, `ToolName`, `SUPPORTED_TOOLS` 等类型和常量
- `getConfiguredTools()`, `scanAllTools()` 等方法名
- `tool-integration` spec 中的内部描述

**理由**: 用户面一致性优先, 内部重构范围大且与本次功能变更无关.

## Risks / Trade-offs

**[Risk] install 逻辑提取可能引入回归** → 提取时保持函数签名不变, 只增加返回值 (安装路径列表).  对 install 命令添加回归测试确保行为不变.

**[Risk] 回滚时部分删除失败** → 使用 try-catch 包裹每个删除操作, 失败时 warn 但继续.  最差情况是中央仓库残留少量文件, 用户可手动清理或重新 install.

**[Risk] `-a` 指定的 agent 未配置 (无 symlink bridge)** → `-a` 只指定部署目标, 不自动创建 symlink bridge.  如果指定的 non-native agent 没有 symlink, 输出警告但仍部署到 `.agents/skills/`.  用户需 `init` 来创建 symlink bridge.

**[Trade-off] `add` 命令职责扩大** → `add` 从简单的单步操作变为复杂的多步流程.  通过清晰的参数路由和错误提示, 保持用户体验简洁.  `install` 保持独立, 给高级用户提供细粒度控制.
