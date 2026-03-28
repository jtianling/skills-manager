# skillsmgr

Unified skills manager for AI coding tools. Install skills into `~/.skills-manager/`, then deploy them to projects through a single `.agents/skills/` directory. Supports 50+ tools with one workflow.

[中文文档](./README.zh-CN.md)

## Highlights

- **Central repository, deploy anywhere** — Skills are installed once into `~/.skills-manager/`. After that, `add` lets you interactively pick from all locally installed skills and deploy them to any project or globally — no need to remember the original repo URL or path every time.
- **Custom groups for batch management** — Organize your own skills into named groups (e.g., `--group my-tools`). Deploy an entire group to a project with a single `add --group` command, making it easy to maintain and share personal skill collections.
- **Zip archive support** — Install skills directly from `.zip` files, which makes it simple to package and share skill bundles outside of GitHub.

## Requirements

- Node.js `>=18`

## Supported Tools

All skills deploy to `.agents/skills/`. Native tools read that directory directly. Non-native tools use a symlink bridge to their legacy skill path. Over 50 tools are supported; the table below lists those shown in the interactive selector.

| Tool | Type | Project Path |
|------|------|--------------|
| Claude Code | Symlink bridge | `.claude/skills -> .agents/skills` |
| Codex | Native | `.agents/skills` |
| Cursor | Native | `.agents/skills` |
| OpenClaw | Symlink bridge | `skills -> .agents/skills` |
| OpenCode | Native | `.agents/skills` |
| Gemini CLI | Native | `.agents/skills` |
| GitHub Copilot | Native | `.agents/skills` |
| Cline | Native | `.agents/skills` |
| Kilo Code | Symlink bridge | `.kilocode/skills -> .agents/skills` |
| Roo Code | Symlink bridge | `.roo/skills -> .agents/skills` |
| Kiro CLI | Symlink bridge | `.kiro/skills -> .agents/skills` |
| Trae | Symlink bridge | `.trae/skills -> .agents/skills` |
| Trae CN | Symlink bridge | `.trae/skills -> .agents/skills` |
| CodeBuddy | Symlink bridge | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Symlink bridge | `.windsurf/skills -> .agents/skills` |
| Goose | Symlink bridge | `.goose/skills -> .agents/skills` |

## Quick Start

```bash
# 1. Initialize ~/.skills-manager/
npx skillsmgr setup

# 2. Install skills from the official Anthropic repository
npx skillsmgr install anthropic

# 3. Deploy skills to the current project
cd your-project
npx skillsmgr init

# 4. Inspect deployed skills
npx skillsmgr list --deployed
```

## Deployment Model

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

- Native tools read `.agents/skills/` directly.
- Non-native tools are configured by creating a symlink bridge during `init` or `add`.
- Skill deployment defaults to symlinks; use `--copy` if you want project-local copies instead.
- Use `-g` to deploy globally to agent user-level directories (e.g., `~/.claude/skills`).

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `skillsmgr setup` | - | Initialize `~/.skills-manager/` and create `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | Install skills from GitHub, local directory, or zip archive |
| `skillsmgr uninstall [identifier]` | - | Remove skills from `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Update installed skills from tracked sources |
| `skillsmgr list` | - | List installed skills in `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | List deployed skills and configured tools in the current project |
| `skillsmgr init` | - | Interactive deployment to the current project |
| `skillsmgr add [name]` | - | Add a skill to the project |
| `skillsmgr remove [name]` | - | Remove a deployed skill from the project |

### Command Flags

**install**

| Flag | Description |
|------|-------------|
| `--all` | Install all discovered skills without prompting |
| `--custom` | Install to `custom/` instead of `community/` |
| `-f, --force` | Overwrite existing skill without confirmation |
| `--group <name>` | Group skills under `custom/<name>/` |
| `-s, --skill <name>` | Select specific skills (repeatable) |

**add**

| Flag | Description |
|------|-------------|
| `--copy` | Copy files instead of creating symlinks |
| `-a, --agent <name>` | Target agent (repeatable) |
| `-s, --skill <name>` | Select specific skills (repeatable) |
| `-g, --global` | Deploy globally to agent user-level directories |
| `--group <name>` | Batch deploy all skills from a custom group |
| `--same-agents` | Use currently configured agents |

**remove**

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Specific skill to remove (repeatable) |
| `-a, --agent <name>` | Target agent (repeatable) |
| `-g, --global` | Remove from global agent directories |

**init**

| Flag | Description |
|------|-------------|
| `--copy` | Copy files instead of creating symlinks |
| `-g, --global` | Deploy skills globally to agent user-level directories |

**uninstall**

| Flag | Description |
|------|-------------|
| `-f, --force` | Skip confirmation prompt |
| `-s, --skill <name>` | Specific skill to uninstall (repeatable) |

## Installing Skills

### Official Anthropic skills

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### GitHub repository

```bash
# owner/repo shorthand
npx skillsmgr install Fission-AI/OpenSpec

# full GitHub URL
npx skillsmgr install https://github.com/user/skills-repo

# specific skill path
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Local directory or zip archive

```bash
# install from a local directory (must start with ./ or /)
npx skillsmgr install ./my-skill

# install from a zip file
npx skillsmgr install ./skills-archive.zip

# install into a custom group
npx skillsmgr install ./my-skill --group my-tools
```

### Useful install options

```bash
# install every discovered skill without prompting
npx skillsmgr install anthropic --all

# install only specific skills by name
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# treat the installed source as custom instead of community
npx skillsmgr install https://github.com/user/repo --custom
```

The installer handles these repository layouts:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` at the repository root

## Deploying Skills

### Interactive deployment

```bash
# deploy to current project (interactive agent and skill selection)
npx skillsmgr init

# deploy globally to agent user-level directories
npx skillsmgr init -g
```

### Non-interactive deployment

```bash
# add a specific skill to a specific agent
npx skillsmgr add code-review -a claude-code

# add multiple skills to multiple agents
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# deploy globally
npx skillsmgr add code-review -g -a claude-code

# remove a skill
npx skillsmgr remove code-review

# remove from global
npx skillsmgr remove code-review -g -a claude-code
```

## Interactive Usage

`install`, `init`, `add`, and `uninstall` use an interactive selector with these shortcuts:

| Key | Action |
|-----|--------|
| `j` / `k` or arrow keys | Move cursor |
| `gg` / `G` | Jump to top or bottom |
| `h` / `l` | Collapse / expand current group |
| `c` | Toggle all groups collapsed |
| `/` | Enter search mode (on large lists) |
| `space` | Toggle selection |
| `ctrl+a` | Toggle all visible items |
| `enter` | Confirm |
| `q` or `ctrl+c` | Cancel |

## Directory Layout

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

- `official/`: built-in official sources such as `anthropic`
- `community/`: third-party repositories
- `custom/`: local skills, grouped skills, and skills explicitly installed as custom
- `sources.json`: source metadata used by `update`

## Acknowledgements

This project was independently created. Many subsequent improvements were inspired by [vercel-labs/skills](https://github.com/vercel-labs/skills).

## License

MIT
