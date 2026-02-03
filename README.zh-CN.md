# skillsmgr

AI 编码工具的统一 Skills 管理器。在 `~/.skills-manager/` 中管理 skills，并部署到多个 AI 工具。

[English](./README.md)

## 支持的工具

| 工具 | Skills 目录 | 支持模式特定 |
|------|------------|-------------|
| Claude Code | `.claude/skills/` | 否 |
| Cursor | `.cursor/skills/` | 否 |
| Windsurf | `.windsurf/skills/` | 否 |
| Cline | `.cline/skills/` | 否 |
| Roo Code | `.roo/skills/` | 是 |
| Kilo Code | `.kilocode/skills/` | 是 |
| OpenCode | `.opencode/skills/` | 否 |
| Trae | `.trae/skills/` | 否 |
| Antigravity | `.agent/skills/` | 否 |

## 快速开始

```bash
# 初始化 skills 管理器
npx skillsmgr setup

# 安装官方 Anthropic skills
npx skillsmgr install anthropic

# 部署 skills 到你的项目
cd your-project
npx skillsmgr init
```

## 命令

### `npx skillsmgr setup`

初始化 `~/.skills-manager/` 目录结构，包含示例 skill。

```bash
npx skillsmgr setup
```

### `npx skillsmgr install <source>`

从仓库下载 skills。

```bash
# 安装官方 Anthropic skills
npx skillsmgr install anthropic

# 从任意 GitHub 仓库安装
npx skillsmgr install https://github.com/user/skills-repo

# 安装特定 skill
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review

# 安装所有 skills（无需确认）
npx skillsmgr install anthropic --all

# 安装到 custom/ 而非 community/
npx skillsmgr install https://github.com/user/repo --custom
```

### `npx skillsmgr list`

列出可用的 skills。

```bash
# 列出所有可用 skills
npx skillsmgr list

# 列出当前项目已部署的 skills
npx skillsmgr list --deployed
```

### `npx skillsmgr init`

交互式部署 skills 到当前项目。

```bash
npx skillsmgr init
```

功能：
- 选择目标工具（Claude Code、Cursor 等）
- 为 Roo Code / Kilo Code 选择模式
- 通过搜索过滤选择要部署的 skills
- 增量更新（添加/移除 skills）

### `npx skillsmgr add <skill>`

快速添加 skill 到项目。

```bash
# 添加到所有已配置的工具
npx skillsmgr add code-review

# 添加到特定工具
npx skillsmgr add code-review --tool claude-code

# 使用复制模式而非符号链接
npx skillsmgr add code-review --copy
```

### `npx skillsmgr remove <skill>`

从项目移除 skill。

```bash
# 从所有工具移除
npx skillsmgr remove code-review

# 从特定工具移除
npx skillsmgr remove code-review --tool claude-code
```

### `npx skillsmgr sync`

同步并验证已部署的 skills。

```bash
npx skillsmgr sync
```

### `npx skillsmgr update`

从远程更新已安装的 skills 到最新版本。

```bash
# 更新所有已安装的源
npx skillsmgr update

# 更新特定源
npx skillsmgr update anthropic
```

## 目录结构

```
~/.skills-manager/
├── official/           # 官方 skills (anthropic/skills)
│   └── anthropic/
│       ├── code-review/
│       └── tdd/
├── community/          # 社区 skills (其他仓库)
│   └── awesome-skills/
│       └── react-patterns/
└── custom/             # 本地自定义 skills
    └── my-skill/
```

## 特性

- **统一管理**：在一处管理所有 skills
- **多工具支持**：部署到 9 种不同的 AI 工具
- **默认符号链接**：修改自动同步
- **搜索过滤**：快速搜索大型 skill 仓库
- **进度指示**：下载时显示可视化反馈
- **增量更新**：无需完全重新部署即可添加/移除 skills

## 许可证

MIT
