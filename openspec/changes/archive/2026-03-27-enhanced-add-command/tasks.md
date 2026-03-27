## 1. 用户面术语替换 (tools → agents)

- [x] 1.1 `promptTools()` 的提示消息从 "Select target tools:" 改为 "Select target agents:", 函数重命名为 `promptAgents()`
- [x] 1.2 `list --deployed` 输出中 "Configured tools:" 改为 "Configured agents:"
- [x] 1.3 更新所有调用 `promptTools` 的地方改为调用 `promptAgents`
- [x] 1.4 为术语变更编写/更新测试

## 2. Agent 选择逻辑提取

- [x] 2.1 新增 `resolveTargetAgents(options)` 函数: 根据 -a/-s/无标志 三种模式返回目标 agent 列表
- [x] 2.2 实现 -a/--agent 解析: 逗号分隔, 验证每个值为合法 tool name, 无效时报错退出
- [x] 2.3 实现 -s/--same-agents 解析: 调用 `getConfiguredTools()`, 无配置时报错退出
- [x] 2.4 实现 -a 和 -s 互斥检查
- [x] 2.5 为 resolveTargetAgents 编写测试 (单个 agent, 多个 agent, 无效名称, 无配置, 互斥)

## 3. Install 核心逻辑提取

- [x] 3.1 从 `install.ts` 提取远程安装核心逻辑为独立函数, 返回安装路径列表和 source key
- [x] 3.2 确保提取后 `install` 命令行为不变 (回归测试)

## 4. 回滚机制

- [x] 4.1 实现 `rollbackInstall(paths, sourceKey)`: 删除安装目录 + 清理 sources.json
- [x] 4.2 回滚中单个删除失败时 warn 并继续
- [x] 4.3 为回滚逻辑编写测试 (正常回滚, 部分删除失败)

## 5. Add 命令重构

- [x] 5.1 修改 Commander 定义: `<name>` 参数改为可选 `[arg]`, 新增 -a/--agent 和 -s/--same-agents 选项
- [x] 5.2 实现参数格式路由: 无参数 → init, 含 `://` → URL, 含 `/` → provider/repo, 其他 → skill name
- [x] 5.3 实现无参数流程: 调用 `executeInit(options)`
- [x] 5.4 实现 skill name 流程: 搜索中央仓库 → 选择 source → resolveTargetAgents → deploy
- [x] 5.5 实现 provider/repo 流程: 中央仓库匹配 → 匹配成功展示 skill 选择 (已部署锁定) → agent 选择 → deploy
- [x] 5.6 实现 provider/repo 未匹配流程: 远程安装 → skill 选择 → agent 选择 → deploy, 失败/取消时回滚
- [x] 5.7 实现 URL 安装流程: 远程安装 → skill 选择 → agent 选择 → deploy, 失败/取消时回滚
- [x] 5.8 实现中央仓库 provider/repo 匹配逻辑: official provider owner 映射 + community 直接匹配

## 6. interactiveCheckbox 锁定支持

- [x] 6.1 在 interactiveCheckbox 中支持 `disabled`/`locked` 状态: checked + locked 的项 Space 键无效果
- [x] 6.2 锁定项视觉区分 (灰色或其他标记)
- [x] 6.3 为锁定功能编写测试

## 7. 集成测试

- [x] 7.1 add 无参数 → init 流程的集成测试
- [x] 7.2 add skill-name 流程 (找到/未找到) 的测试
- [x] 7.3 add provider/repo 流程 (中央仓库匹配/未匹配) 的测试
- [x] 7.4 add URL 流程的测试
- [x] 7.5 -a/-s 标志的端到端测试
- [x] 7.6 回滚的端到端测试 (用户取消后中央仓库被清理)
