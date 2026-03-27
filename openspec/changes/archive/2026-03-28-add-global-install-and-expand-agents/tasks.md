## 1. 数据结构和类型

- [x] 1.1 更新 `src/constants.ts`: SUPPORTED_TOOLS 扩展到 45 个, 重命名 kilo-code→kilo, roo-code→roo
- [x] 1.2 更新 `src/types.ts`: ToolConfig 新增 `globalSkillsDir: string` 和 `showInList: boolean` 字段, AddOptions 新增 `global?: boolean`, 移除旧的 `group` 透传语义
- [x] 1.3 重写 `src/tools/configs.ts`: 45 个 agent 的完整配置, 包含 native, symlinkDir, globalSkillsDir, showInList

## 2. Install 命令调整

- [x] 2.1 更新 `src/commands/install.ts`: 移除 `-g` 短选项, 保留 `--group <name>` 长选项

## 3. 全局部署核心

- [x] 3.1 更新 `src/services/deployer.ts`: 新增 `deploySkillGlobal()` 方法, 支持 per-skill symlink/copy 到各 agent 全局目录
- [x] 3.2 全局目标路径冲突处理: symlink 替换, 真实目录跳过并 warn

## 4. Add 命令改造

- [x] 4.1 更新 `src/commands/add.ts`: 新增 `-g, --global` 参数, 移除旧的 `-g, --group` 定义
- [x] 4.2 实现全局模式分支: `-g` 时调用 `deploySkillGlobal()` 替代 `deploySkill()`
- [x] 4.3 实现 `--group <name>` 批量部署: 从 SkillsService 按组过滤 skills, 展示选择列表
- [x] 4.4 `--group` 与位置参数互斥校验

## 5. 交互选择适配

- [x] 5.1 更新 `src/utils/prompts.ts`: 项目级 agent 选择 — "Agents Skills Standard" 聚合 native 且 showInList=true 的 agent, non-native 且 showInList=true 单独显示
- [x] 5.2 更新 `src/utils/prompts.ts`: 全局级 agent 选择 — 所有 showInList=true 的 agent 独立显示, 附带全局路径
- [x] 5.3 displayOrder 排列: Claude Code, Codex, Cursor, OpenClaw, OpenCode, Gemini CLI, GitHub Copilot, Cline, Kilo Code, Roo Code, Kiro CLI, Trae, Trae CN, CodeBuddy, Windsurf, Goose

## 6. 现有引用更新

- [x] 6.1 全局搜索 `kilo-code` 和 `roo-code` 引用, 替换为 `kilo` 和 `roo`
- [x] 6.2 更新 `src/services/scanner.ts`: 确保扫描逻辑兼容新增的 non-native agent (更多 symlinkDir)
- [x] 6.3 更新 `src/commands/init.ts`: agent 选择列表适配新配置

## 7. 测试

- [x] 7.1 更新 `configs.test.ts`: 45 个 agent 配置验证, globalSkillsDir 和 showInList 字段
- [x] 7.2 新增全局部署测试: deploySkillGlobal per-skill symlink/copy
- [x] 7.3 更新 add 命令测试: -g 全局模式, --group 批量部署
- [x] 7.4 更新重命名相关测试: kilo-code→kilo, roo-code→roo
- [x] 7.5 运行完整测试套件确认无回归
