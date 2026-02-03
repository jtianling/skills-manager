# Skills Manager 设计文档

## 概述

Skills Manager (skillsmgr) 是一个统一管理 AI 编程工具 skills 的 CLI 工具。它允许用户在 `~/.skills-manager/` 目录下集中管理所有 skills，并将它们部署到不同项目的不同 AI 工具中。

灵感来源于 [rules-manager](https://github.com/jtianling/rules-manager)，但专注于 skills 而非 rules。

## 支持的工具

| 工具 | Skills 目录 | Mode-Specific |
|------|------------|---------------|
| Claude Code | `.claude/skills/` | 否 |
| Cursor | `.cursor/skills/` | 否 |
| Windsurf | `.windsurf/skills/` | 否 |
| Cline | `.cline/skills/` | 否 |
| Roo Code | `.roo/skills/` | 是 |
| Kilo Code | `.kilocode/skills/` | 是 |
| Antigravity | `.agent/skills/` | 否 |

## 目录结构

### ~/.skills-manager/ 目录

```
~/.skills-manager/
├── official/                    # 官方 skills (仅 anthropic/skills)
│   └── anthropic/
│       ├── code-review/
│       │   └── SKILL.md
│       └── tdd/
│           └── SKILL.md
├── community/                   # 社区 skills (其他 git 仓库)
│   └── awesome-skills/
│       ├── react-patterns/
│       │   └── SKILL.md
│       └── docker-deploy/
│           └── SKILL.md
└── custom/                      # 本地自定义 skills
    └── example-skill/
        └── SKILL.md
```

### 项目元数据文件 (.skillsmgr.json)

```json
{
  "version": "1.0",
  "tools": {
    "claude-code": {
      "targetDir": ".claude/skills",
      "mode": "all",
      "deployedAt": "2026-02-03T10:00:00Z",
      "skills": [
        {
          "name": "code-review",
          "source": "official/anthropic",
          "deployMode": "link"
        },
        {
          "name": "react-patterns",
          "source": "community/awesome-skills",
          "deployMode": "copy"
        }
      ]
    },
    "roo-code": {
      "targetDir": ".roo/skills-code",
      "mode": "code",
      "deployedAt": "2026-02-03T10:00:00Z",
      "skills": [...]
    }
  }
}
```

## CLI 命令

### 命令概览

```bash
skillsmgr setup              # 初始化 ~/.skills-manager/ 目录结构
skillsmgr install <source>   # 下载 skills 到 ~/.skills-manager/
skillsmgr list               # 列出可用的 skills
skillsmgr init               # 交互式部署 skills 到当前项目
skillsmgr add <skill>        # 快速添加单个 skill
skillsmgr remove <skill>     # 快速移除单个 skill
skillsmgr sync               # 同步并验证已部署的 skills
```

### setup

初始化 `~/.skills-manager/` 目录结构，创建示例 skill。

```bash
$ skillsmgr setup

Creating ~/.skills-manager/...
✓ Created official/
✓ Created community/
✓ Created custom/
✓ Created custom/example-skill/SKILL.md

Setup complete!

Next steps:
  skillsmgr install anthropic    # Download official Anthropic skills
  skillsmgr list                 # View available skills
  skillsmgr init                 # Deploy skills to your project
```

### install

下载 skills 到 `~/.skills-manager/`。

- `anthropic` → `official/anthropic/`
- 其他 git 仓库 → `community/<repo-name>/`
- `--custom` 标志 → `custom/<repo-name>/`

```bash
# 安装整个仓库 → 提供选择
$ skillsmgr install anthropic
Cloning anthropic/skills...
Found 12 skills.

? Select skills to install:
  ◉ code-review      Reviews code for bugs and style
  ◉ tdd              Test-driven development workflow
  ◯ debugging        Systematic debugging approach
  ...

✓ Installed 2 skills to ~/.skills-manager/official/anthropic/

# 安装特定 skill → 直接安装
$ skillsmgr install https://github.com/anthropics/skills/tree/main/code-review
✓ Installed code-review to ~/.skills-manager/official/anthropic/

# 使用 --all 跳过选择，全部安装
$ skillsmgr install anthropic --all
✓ Installed 12 skills to ~/.skills-manager/official/anthropic/

# 安装到 custom 目录
$ skillsmgr install https://github.com/user/repo --custom
✓ Installed to ~/.skills-manager/custom/repo/
```

### list

列出可用的 skills。

```bash
$ skillsmgr list
Available skills in ~/.skills-manager/:

── official/anthropic (12 skills) ──
  code-review      Reviews code for bugs and style
  tdd              Test-driven development workflow
  ...

── community/awesome-skills (8 skills) ──
  react-patterns   React best practices and patterns
  docker-deploy    Docker deployment automation
  ...

── custom (1 skill) ──
  example-skill    Example skill template

$ skillsmgr list --deployed
Deployed skills in current project:

Claude Code (.claude/skills/):
  ◉ code-review     (link) ← official/anthropic
  ◉ react-patterns  (copy) ← community/awesome-skills
```

### init

交互式部署 skills 到当前项目。

**基本流程：**

```bash
$ skillsmgr init

? Select target tools:
  ◉ Claude Code
  ◉ Roo Code
  ◯ Cursor
  ...

# 因为选了 Roo Code，询问 mode
? Select target mode for Roo Code:
  ◉ All modes (.roo/skills/)
  ◯ Code mode only (.roo/skills-code/)
  ◯ Architect mode only (.roo/skills-architect/)

? Select skills to deploy:

── official/anthropic ──
  ◉ code-review      Reviews code for bugs and style
  ◯ tdd              Test-driven development workflow

── community/awesome-skills ──
  ◉ react-patterns   React best practices and patterns
  ...

Deploying skills...

Claude Code:
  ✓ code-review (linked)
  ✓ react-patterns (linked)

Roo Code:
  ✓ code-review (linked)
  ✓ react-patterns (linked)

Done! Deployed 2 skills to 2 tools.
```

**增量模式（已有部署时）：**

```bash
$ skillsmgr init

? Select target tools:
  ◉ Claude Code      [configured]
  ...

? Select skills to deploy:

── official/anthropic ──
  ◉ code-review      [deployed]
  ◉ tdd
  ...

Changes: +1 (tdd), -0

Deploying skills...

Claude Code:
  · code-review (unchanged)
  ✓ tdd (linked)

Done! Added 1 skill, 1 unchanged.
```

### add

快速添加单个 skill 到项目。

```bash
# 添加到所有已配置的工具
$ skillsmgr add code-review
Adding code-review to configured tools...
  ✓ Claude Code (linked)
  ✓ Roo Code (linked)

# 添加到指定工具
$ skillsmgr add code-review --tool claude-code
  ✓ Claude Code (linked)

# 使用 copy 模式
$ skillsmgr add code-review --copy
  ✓ Claude Code (copied)

# skill 名称有歧义时提示选择
$ skillsmgr add react-patterns
Multiple skills found with name 'react-patterns':
  1. community/awesome-skills/react-patterns
  2. custom/my-skills/react-patterns
? Select skill: 1
  ✓ Claude Code (linked)
```

### remove

快速移除 skill。

```bash
# 从所有工具移除
$ skillsmgr remove code-review
Removing code-review...
  ✓ Removed from Claude Code
  ✓ Removed from Roo Code

# 从指定工具移除
$ skillsmgr remove code-review --tool claude-code
  ✓ Removed from Claude Code
```

### sync

同步并验证已部署的 skills。

```bash
$ skillsmgr sync

Checking deployed skills...

Claude Code (.claude/skills/):
  ✓ code-review: up to date (link)
  ⚠ react-patterns: source changed (copy)
  ✗ old-skill: orphaned (source deleted)
  ? unknown-skill: not managed by skillsmgr

Roo Code (.roo/skills/):
  ✓ code-review: up to date (link)
  ✓ tdd: up to date (link)

Issues found:
  react-patterns: source file changed
    [O]verwrite  [S]kip  [D]iff  > d

    --- local
    +++ source
    @@ -1,3 +1,4 @@
     name: react-patterns
    -description: React patterns
    +description: React best practices and patterns
    +version: 2.0

    [O]verwrite  [S]kip  > o
    ✓ Updated react-patterns

  old-skill: source no longer exists
    [R]emove  [K]eep  > r
    ✓ Removed old-skill

Sync complete: 1 updated, 1 removed, 1 untracked (ignored)
```

## 工具配置

```typescript
interface ToolConfig {
  name: string;
  displayName: string;
  skillsDir: string;
  supportsLink: boolean;
  supportsModeSpecific: boolean;
  modePattern?: string;
  availableModes?: string[];
}

const TOOL_CONFIGS: ToolConfig[] = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.cline/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  {
    name: 'roo-code',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
];
```

## 项目结构

```
skills-manager/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── constants.ts          # 常量定义
│   ├── types.ts              # TypeScript 类型
│   ├── commands/
│   │   ├── setup.ts          # setup 命令
│   │   ├── install.ts        # install 命令
│   │   ├── init.ts           # init 命令
│   │   ├── list.ts           # list 命令
│   │   ├── add.ts            # add 命令
│   │   ├── remove.ts         # remove 命令
│   │   └── sync.ts           # sync 命令
│   ├── services/
│   │   ├── skills.ts         # SkillsService - 管理 ~/.skills-manager/
│   │   ├── deployer.ts       # Deployer - 部署逻辑
│   │   └── git.ts            # GitService - 克隆仓库
│   ├── tools/
│   │   └── configs.ts        # 工具配置
│   ├── utils/
│   │   ├── fs.ts             # 文件系统工具
│   │   ├── prompts.ts        # 交互式提示
│   │   └── diff.ts           # diff 显示
│   └── templates/
│       └── example-skill/
│           └── SKILL.md      # 示例 skill 模板
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 设计决策总结

| 决策项 | 选择 |
|--------|------|
| 目录结构 | 按来源分组：official/community/custom |
| 选择交互 | 分组展示，一次性多选 |
| 项目更新 | 增量模式，已部署默认勾选 |
| 部署追踪 | `.skillsmgr.json` 元数据文件 |
| sync 功能 | 同步 + 完整性验证 |
| mode-specific | 仅 Roo Code 和 Kilo Code 支持 |
| 默认部署模式 | symlink，可选 --copy |
| CLI 命令 | setup, install, init, list, add, remove, sync |
| install 行为 | 仓库提供选择，单个 skill 直接安装 |
| 支持工具 | Claude Code, Cursor, Windsurf, Cline, Roo Code, Kilo Code, Antigravity |

## 技术栈

- **语言**: TypeScript
- **CLI 框架**: Commander.js
- **交互式提示**: Inquirer
- **构建工具**: tsup
- **测试框架**: Vitest
- **运行时**: Node.js 18+
