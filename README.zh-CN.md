# skillsmgr

面向 AI 编码工具的统一 Skills 管理器.  先把 skills 安装到 `~/.skills-manager/`, 再通过统一的 `.agents/skills/` 目录部署到项目里.  支持 50+ 工具, 一套工作流搞定.

[English](./README.md)

## 亮点

- **中央仓库, 随处部署** — Skills 只需安装一次到 `~/.skills-manager/`.  之后通过 `add` 命令可以交互式地从所有本地已安装的 skills 中选择, 部署到任意项目或全局 — 不用每次都去翻原始仓库地址或路径.
- **自定义分组, 批量管理** — 将自己的 skills 组织到命名分组中 (如 `--group my-tools`).  一条 `add --group` 命令即可将整组 skills 部署到项目, 方便维护和分享个人技能集合.
- **支持 zip 包安装** — 可以直接从 `.zip` 文件安装 skills, 方便在 GitHub 之外打包和分享技能.

## 环境要求

- Node.js `>=18`

## 支持的工具

所有 skill 统一部署到 `.agents/skills/`.  原生工具直接读取该目录, 非原生工具通过符号链接桥接到旧目录.  总共支持 50+ 工具, 下表列出交互选择器中显示的工具.

| 工具 | 类型 | 项目中的路径 |
|------|------|-------------|
| Claude Code | Symlink bridge | `.claude/skills -> .agents/skills` |
| Codex | 原生 | `.agents/skills` |
| Cursor | 原生 | `.agents/skills` |
| OpenClaw | Symlink bridge | `skills -> .agents/skills` |
| OpenCode | 原生 | `.agents/skills` |
| Gemini CLI | 原生 | `.agents/skills` |
| GitHub Copilot | 原生 | `.agents/skills` |
| Cline | 原生 | `.agents/skills` |
| Kilo Code | Symlink bridge | `.kilocode/skills -> .agents/skills` |
| Roo Code | Symlink bridge | `.roo/skills -> .agents/skills` |
| Kiro CLI | Symlink bridge | `.kiro/skills -> .agents/skills` |
| Trae | Symlink bridge | `.trae/skills -> .agents/skills` |
| Trae CN | Symlink bridge | `.trae/skills -> .agents/skills` |
| CodeBuddy | Symlink bridge | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Symlink bridge | `.windsurf/skills -> .agents/skills` |
| Goose | Symlink bridge | `.goose/skills -> .agents/skills` |

## 快速开始

```bash
# 1. 初始化 ~/.skills-manager/
npx skillsmgr setup

# 2. 安装官方 Anthropic skills
npx skillsmgr install anthropic

# 3. 部署到当前项目
cd your-project
npx skillsmgr init

# 4. 查看当前项目中的已部署 skills
npx skillsmgr list --deployed
```

## 部署模型

```text
project/
├── .agents/
│   └── skills/
│       ├── code-review -> ~/.skills-manager/official/anthropic/skills/code-review
│       └── example-skill -> ~/.skills-manager/custom/example-skill
├── .claude/
│   └── skills -> ../.agents/skills
└── .cursor/
    └── skills -> ../.agents/skills
```

- 原生工具直接读取 `.agents/skills/`
- 非原生工具在 `init` 或 `add` 时创建 symlink bridge
- 默认用符号链接部署 skill; 如果需要项目内独立副本, 可使用 `--copy`
- 使用 `-g` 全局部署到 agent 用户级目录 (如 `~/.claude/skills`)

## 命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `skillsmgr setup` | - | 初始化 `~/.skills-manager/`, 并创建 `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | 从 GitHub, 本地目录或 zip 压缩包安装 skills |
| `skillsmgr uninstall [identifier]` | - | 从 `~/.skills-manager/` 卸载 skills |
| `skillsmgr update [source]` | - | 从已记录的来源更新已安装 skills |
| `skillsmgr list` | - | 列出 `~/.skills-manager/` 中已安装的 skills |
| `skillsmgr list --deployed` | - | 列出当前项目中已部署的 skills 和已配置工具 |
| `skillsmgr init` | - | 交互式部署到当前项目 |
| `skillsmgr add [name]` | - | 添加 skill 到项目 |
| `skillsmgr remove [name]` | - | 从项目中移除已部署的 skill |

### 命令选项

**install**

| 选项 | 说明 |
|------|------|
| `--all` | 安装发现到的全部 skills, 不交互 |
| `--custom` | 安装到 `custom/` 而非 `community/` |
| `-f, --force` | 覆盖已存在的 skill, 不确认 |
| `--group <name>` | 将 skills 归入 `custom/<name>/` 分组 |
| `-s, --skill <name>` | 选择指定 skill (可重复) |

**add**

| 选项 | 说明 |
|------|------|
| `--copy` | 复制文件而非创建符号链接 |
| `-a, --agent <name>` | 指定目标 agent (可重复) |
| `-s, --skill <name>` | 选择指定 skill (可重复) |
| `-g, --global` | 全局部署到 agent 用户级目录 |
| `--group <name>` | 批量部署自定义分组中的所有 skills |
| `--same-agents` | 使用当前已配置的 agents |

**remove**

| 选项 | 说明 |
|------|------|
| `-s, --skill <name>` | 指定要移除的 skill (可重复) |
| `-a, --agent <name>` | 指定目标 agent (可重复) |
| `-g, --global` | 从全局 agent 目录移除 |

**init**

| 选项 | 说明 |
|------|------|
| `--copy` | 复制文件而非创建符号链接 |
| `-g, --global` | 全局部署到 agent 用户级目录 |

**uninstall**

| 选项 | 说明 |
|------|------|
| `-f, --force` | 跳过确认提示 |
| `-s, --skill <name>` | 指定要卸载的 skill (可重复) |

## 安装 Skills

### 安装官方 Anthropic skills

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### 从 GitHub 安装

```bash
# owner/repo 简写
npx skillsmgr install Fission-AI/OpenSpec

# 完整 GitHub URL
npx skillsmgr install https://github.com/user/skills-repo

# 单个 skill 路径
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### 从本地目录或 zip 安装

```bash
# 从本地目录安装 (路径需以 ./ 或 / 开头)
npx skillsmgr install ./my-skill

# 从 zip 文件安装
npx skillsmgr install ./skills-archive.zip

# 安装到自定义分组
npx skillsmgr install ./my-skill --group my-tools
```

### 常用安装选项

```bash
# 不交互, 安装发现到的全部 skills
npx skillsmgr install anthropic --all

# 只安装指定名称的 skills
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# 把远程来源安装到 custom 分类而不是 community
npx skillsmgr install https://github.com/user/repo --custom
```

安装器支持这些常见仓库结构:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- 仓库根目录存在 `SKILL.md`

## 部署 Skills

### 交互式部署

```bash
# 部署到当前项目 (交互选择 agent 和 skill)
npx skillsmgr init

# 全局部署到 agent 用户级目录
npx skillsmgr init -g
```

### 非交互式部署

```bash
# 添加指定 skill 到指定 agent
npx skillsmgr add code-review -a claude-code

# 添加多个 skills 到多个 agents
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# 全局部署
npx skillsmgr add code-review -g -a claude-code

# 移除 skill
npx skillsmgr remove code-review

# 从全局移除
npx skillsmgr remove code-review -g -a claude-code
```

## 交互式操作

`install`, `init`, `add`, `uninstall` 使用统一的交互式选择器, 快捷键如下:

| 按键 | 操作 |
|------|------|
| `j` / `k` 或方向键 | 移动光标 |
| `gg` / `G` | 跳到顶部或底部 |
| `h` / `l` | 折叠 / 展开当前分组 |
| `c` | 切换所有分组的折叠状态 |
| `/` | 进入搜索模式 (列表较大时) |
| `space` | 切换选择 |
| `ctrl+a` | 切换所有可见项 |
| `enter` | 确认 |
| `q` 或 `ctrl+c` | 取消 |

## 目录结构

```text
~/.skills-manager/
├── official/
│   └── anthropic/
│       └── skills/
│           ├── code-review/SKILL.md
│           └── commit-message/SKILL.md
├── community/
│   └── owner/
│       └── repo-name/
│           └── skill-name/SKILL.md
├── custom/
│   ├── example-skill/SKILL.md
│   └── my-group/
│       └── my-skill/SKILL.md
└── sources.json
```

- `official/`: 官方来源, 例如 `anthropic`
- `community/`: 第三方仓库
- `custom/`: 本地 skill, 分组 skill, 或明确按 custom 分类安装的 skill
- `sources.json`: 供 `update` 使用的来源元数据

## 致谢

本项目独立创建, 但后续很多改进的灵感来源于 [vercel-labs/skills](https://github.com/vercel-labs/skills).

## 许可证

MIT
