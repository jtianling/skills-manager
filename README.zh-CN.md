# skillsmgr

面向 AI 编码工具的统一 Skills 管理器。先把 skills 安装到 `~/.skills-manager/`，再通过统一的 `.agents/skills/` 目录部署到项目里。

[English](./README.md)

## 亮点

- 在 `official/`、`community/`、`custom/` 三类来源中统一管理 skills
- 只部署一次到 `.agents/skills/`，对不原生支持的工具自动创建 symlink bridge
- 支持 GitHub 仓库、单个 skill URL、根目录 skill 仓库，以及分组嵌套的 skill 目录
- 交互式选择器支持搜索和 vi 风格导航
- 在 `~/.skills-manager/sources.json` 中记录来源，便于后续 `update`

## 环境要求

- Node.js `>=18`

## 支持的工具

所有 skill 都统一部署到 `.agents/skills/`。原生工具直接读取该目录，非原生工具通过符号链接桥接到旧目录。

| 工具 | 类型 | 项目中的路径 |
|------|------|-------------|
| Claude Code | Symlink bridge | `.claude/skills -> .agents/skills` |
| Codex | 原生 | `.agents/skills` |
| Gemini CLI | 原生 | `.agents/skills` |
| OpenCode | 原生 | `.agents/skills` |
| OpenClaw | 原生 | `.agents/skills` |
| Antigravity | 原生 | `.agents/skills` |
| Cline | 原生 | `.agents/skills` |
| Cursor | Symlink bridge | `.cursor/skills -> .agents/skills` |
| Kilo Code | Symlink bridge | `.kilocode/skills -> .agents/skills` |
| Roo Code | Symlink bridge | `.roo/skills -> .agents/skills` |
| Trae | Symlink bridge | `.trae/skills -> .agents/skills` |
| Windsurf | Symlink bridge | `.windsurf/skills -> .agents/skills` |

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

当前版本统一采用 `.agents/skills/` 作为项目内技能目录：

```text
project/
├── .agents/
│   └── skills/
│       ├── code-review -> ~/.skills-manager/official/anthropic/code-review
│       └── example-skill -> ~/.skills-manager/custom/example-skill
├── .claude/
│   └── skills -> ../.agents/skills
└── .cursor/
    └── skills -> ../.agents/skills
```

- 原生工具直接读取 `.agents/skills/`
- 非原生工具在 `init` 时创建 symlink bridge
- 默认用符号链接部署 skill；如果需要项目内独立副本，可使用 `--copy`

## 命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `skillsmgr setup` | - | 初始化 `~/.skills-manager/`，并创建 `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | 从 Anthropic、GitHub 或其他 git 来源安装 skills |
| `skillsmgr custom-install <name>` | `ci` | 把当前工作目录下的本地 skill 安装到 `custom/` |
| `skillsmgr list` | - | 列出 `~/.skills-manager/` 中已安装的 skills |
| `skillsmgr list --deployed` | - | 列出当前项目中已部署的 skills 和已配置工具 |
| `skillsmgr init` | - | 交互式部署到当前项目 |
| `skillsmgr add <name>` | - | 把一个已安装 skill 加到 `.agents/skills/` |
| `skillsmgr remove <name>` | - | 从 `.agents/skills/` 移除一个已部署 skill |
| `skillsmgr sync` | - | 校验已部署 skills，处理 orphaned skill，并在需要时刷新 copy 部署 |
| `skillsmgr update [source]` | - | 从已记录的来源更新已安装 skills |

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

### 安装本地自定义 skill

```bash
# 当前目录下需要存在 ./my-skill/SKILL.md
npx skillsmgr custom-install my-skill
```

### 常用安装选项

```bash
# 不交互，安装发现到的全部 skills
npx skillsmgr install anthropic --all

# 把远程来源安装到 custom 分类而不是 community
npx skillsmgr install https://github.com/user/repo --custom
```

当前安装器支持这些常见仓库结构：

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- 仓库根目录存在 `SKILL.md`

## 交互式操作

`install` 和 `init` 使用统一的交互式选择器，常用按键如下：

- `j` / `k` 或方向键：移动
- `gg` / `G`：跳到顶部或底部
- `/`：列表较大时进入搜索模式
- `space`：切换选择
- `ctrl+a`：切换所有可见项
- `enter`：确认
- `q` 或 `ctrl+c`：取消

## 目录结构

```text
~/.skills-manager/
├── official/
│   └── anthropic/
├── community/
├── custom/
│   └── example-skill/
└── sources.json
```

- `official/`：官方来源，例如 `anthropic`
- `community/`：第三方仓库
- `custom/`：本地 skill，或明确按 custom 分类安装的 skill
- `sources.json`：供 `update` 使用的来源元数据

## 许可证

MIT
