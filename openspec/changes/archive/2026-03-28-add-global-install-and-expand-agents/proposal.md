## Why

skillsmgr 目前只支持项目级部署, 无法将 skill 安装到各 agent 的全局目录 (如 `~/.claude/skills/`), 导致每个项目都需要重复配置.  同时仅支持 12 个 agent, 远少于 ref skills 的 45 个, 限制了工具覆盖面.

## What Changes

- `add` 命令新增 `-g, --global` 参数, 支持将 skill 部署到各 agent 的全局 skills 目录
- 全局部署采用单 skill 粒度的 symlink (或 `--copy`), 直接链接到各 agent 全局目录, 无中间层
- `add --group <name>` 语义变更: 从"透传 group 给 install"改为"批量部署指定组的所有 skills"
- `install` 命令的 `--group` 保留, 去掉 `-g` 短选项
- agent 支持从 12 个扩展到 45 个, 对齐 vercel-labs/skills README
- **BREAKING**: `kilo-code` 重命名为 `kilo`, `roo-code` 重命名为 `roo`
- **BREAKING**: `add` 命令的 `-g` 从 `--group` 改为 `--global`
- ToolConfig 新增 `globalSkillsDir` 字段
- 交互选择列表区分显示/隐藏 agent, 隐藏的仍可通过 `--agent` 直接使用
- 项目级和全局级交互选择列表显示逻辑不同

## Capabilities

### New Capabilities

- `global-deploy`: 全局部署机制 — 将 skill 以 per-skill symlink/copy 方式部署到各 agent 的全局 skills 目录
- `batch-add-by-group`: `add --group <name>` 批量部署中央仓库中指定组的所有 skills

### Modified Capabilities

- `tool-integration`: 从 12 个 agent 扩展到 45 个, 新增 `globalSkillsDir` 字段, 重命名 kilo-code→kilo / roo-code→roo, 增加 `showInList` 显示控制
- `smart-add`: add 命令新增 `-g/--global` 参数, `--group` 语义变更为批量部署
- `symlink-bridge`: 新增全局级 per-skill symlink 模式 (区别于项目级目录桥接)

## Impact

- `src/tools/configs.ts`: 重写, 扩展到 45 个 agent 配置, 新增 globalSkillsDir
- `src/constants.ts`: SUPPORTED_TOOLS 扩展, 重命名
- `src/types.ts`: ToolConfig 接口新增字段
- `src/commands/add.ts`: 新增 -g 全局模式, --group 批量部署逻辑
- `src/commands/install.ts`: 移除 `-g` 短选项
- `src/services/deployer.ts`: 新增全局部署方法 (per-skill symlink/copy)
- `src/utils/prompts.ts`: 交互选择列表适配全局/项目级不同显示
- 测试文件需同步更新
