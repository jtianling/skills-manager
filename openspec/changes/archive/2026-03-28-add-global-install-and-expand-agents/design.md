## Context

skillsmgr 当前仅支持项目级部署: skill 安装到 `.agents/skills/`, 非原生 agent 通过目录级 symlink bridge 访问.  支持 12 个 agent.

ref skills (vercel-labs/skills) 支持 45 个 agent, 并通过 `-g` 全局安装到各 agent 的用户级目录.  skillsmgr 需要对齐这两个能力.

## Goals / Non-Goals

**Goals:**

- `add -g` 全局安装: per-skill 粒度的 symlink/copy 到各 agent 的全局 skills 目录
- 扩展到 45 个 agent, 对齐 vercel-labs/skills README 的 Supported Agents 表格
- `add --group <name>` 语义变更为批量部署指定组的所有 skills
- `install` 命令移除 `-g` 短选项 (保留 `--group`)
- 交互选择列表区分全局/项目级不同显示逻辑

**Non-Goals:**

- 不重构项目级部署模型 (保持 canonical `.agents/skills/` + symlink bridge)
- 不实现 agent 自动检测 (ref skills 有 `detectInstalled`, skillsmgr 暂不需要)
- 不实现 `list -g` / `remove -g` 等全局管理命令 (后续迭代)
- 不改变 `install` 命令的行为 (仍然只下载到中央仓库)

## Decisions

### D1: Agent 配置数据结构

新增 `globalSkillsDir` 字段到 ToolConfig, 表示各 agent 的全局 skills 目录.  新增 `showInList` 布尔字段, 控制交互选择时是否显示.

```typescript
interface ToolConfig {
  name: ToolName;
  displayName: string;
  skillsDir: string;          // 项目级, 统一 .agents/skills
  globalSkillsDir: string;    // 全局路径, 如 ~/.claude/skills
  supportsLink: boolean;
  native: boolean;
  symlinkDir?: string;        // 项目级 symlink bridge 路径
  showInList: boolean;        // 交互选择是否显示
}
```

**理由**: 全局路径每个 agent 不同, 无法像项目级那样用统一目录 + bridge.  `showInList` 将 45 个 agent 分为可交互选择 (16 个) 和仅 `--agent` 操作 (29 个), 避免列表过长.

**替代方案**: 用 `scope: 'project' | 'global'` 枚举 — 但全局和项目级是并行需求, 不是互斥, 所以单独字段更清晰.

### D2: 全局部署采用 per-skill symlink

项目级: 目录级 bridge (`.claude/skills → .agents/skills/`)
全局级: per-skill symlink (`~/.claude/skills/my-skill → ~/.skills-manager/.../my-skill`)

**理由**:
1. 全局目录 (`~/.claude/skills/`) 可能已有其他 skills, 不能整个目录替换
2. 各 agent 全局目录独立, 无共享 canonical 目录可做 bridge
3. 需要按 skill × agent 独立控制

### D3: Deployer 新增 `deploySkillGlobal()` 方法

```typescript
deploySkillGlobal(
  skill: SkillInfo,
  agents: ToolName[],
  mode: 'link' | 'copy'
): void
```

遍历选中的 agents, 对每个 agent:
1. 确定目标路径: `{agent.globalSkillsDir}/{skill.name}`
2. mode=link: symlink skill.path → 目标路径
3. mode=copy: 复制 skill 目录到目标路径

不修改现有 `deploySkill()` 方法, 项目级逻辑完全不变.

### D4: 交互选择列表显示逻辑

**项目级** (`add skill-name`):
- "Agents Skills Standard" 聚合选项 (包含所有 native agent 名称说明), 默认选中
- 每个 non-native 且 `showInList=true` 的 agent 单独显示
- native agent 不单独显示 (已包含在聚合选项中)

**全局级** (`add -g skill-name`):
- 无聚合选项, 每个 `showInList=true` 的 agent 独立显示
- 显示全局路径而非项目路径
- 按用户指定顺序排列

### D5: `--group` 语义变更

`add --group <name>` 从透传 install 改为:
1. 从 SkillsService 获取所有 skills
2. 过滤 `source` 以 `custom/<name>` 开头的
3. 批量部署所有匹配的 skills

`add` 命令移除旧的 group 透传逻辑.  远程安装时如果需要分组, 用户应先 `install --group` 再 `add`.

### D6: Agent 命名对齐

对齐 ref skills README 表格中的 CLI flag 列:
- `kilo-code` → `kilo`
- `roo-code` → `roo`

其他 agent 保持 ref skills 的 CLI flag 名称.

### D7: 显示顺序

交互选择列表的显示顺序由配置中的 `displayOrder` 数组控制, 而非字母排序:

```
Claude Code, Codex, Cursor, OpenClaw, OpenCode, Gemini CLI,
GitHub Copilot, Cline, Kilo Code, Roo Code, Kiro CLI, Trae,
Trae CN, CodeBuddy, Windsurf, Goose
```

`showInList=false` 的 agent 不参与排序.

## Risks / Trade-offs

- [全局 symlink 可能与用户手动安装的 skills 冲突] → 如果目标路径已存在且非 symlink, 跳过并 warn (与项目级 bridge 行为一致)
- [45 个 agent 的 globalSkillsDir 依赖 ref skills 文档准确性] → 以 README 表格为准, 后续可通过配置更新
- [kilo-code → kilo, roo-code → roo 是 breaking change] → 在 SUPPORTED_TOOLS 中直接替换, 不做兼容 alias
- [`add --group` 语义变更是 breaking change] → 旧行为使用频率极低 (仅透传), 直接替换
