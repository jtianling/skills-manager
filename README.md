# skillsmgr

Unified skills manager for AI coding tools. Install skills into `~/.skills-manager/`, then deploy them to projects through a single `.agents/skills/` directory.

[中文文档](./README.zh-CN.md)

## Highlights

- Manage installed skills in one place: `official/`, `community/`, and `custom/`
- Deploy once to `.agents/skills/`, with symlink bridges for tools that do not read it natively
- Support GitHub repos, specific skill URLs, root-skill repos, and nested grouped skill directories
- Interactive selection UI with search and vi-style navigation
- Track installed sources in `~/.skills-manager/sources.json` for later updates

## Requirements

- Node.js `>=18`

## Supported Tools

All skills are deployed to `.agents/skills/`. Native tools read that directory directly. Non-native tools use a symlink bridge to their legacy skill path.

| Tool | Type | Project Path |
|------|------|--------------|
| Claude Code | Symlink bridge | `.claude/skills -> .agents/skills` |
| Codex | Native | `.agents/skills` |
| Gemini CLI | Native | `.agents/skills` |
| OpenCode | Native | `.agents/skills` |
| OpenClaw | Native | `.agents/skills` |
| Antigravity | Native | `.agents/skills` |
| Cline | Native | `.agents/skills` |
| Cursor | Symlink bridge | `.cursor/skills -> .agents/skills` |
| Kilo Code | Symlink bridge | `.kilocode/skills -> .agents/skills` |
| Roo Code | Symlink bridge | `.roo/skills -> .agents/skills` |
| Trae | Symlink bridge | `.trae/skills -> .agents/skills` |
| Windsurf | Symlink bridge | `.windsurf/skills -> .agents/skills` |

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

`skillsmgr` now uses a unified deployment model:

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

- Native tools read `.agents/skills/` directly.
- Non-native tools are configured by creating a symlink bridge during `init`.
- Skill deployment defaults to symlinks; use `--copy` if you want project-local copies instead.

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `skillsmgr setup` | - | Initialize `~/.skills-manager/` and create `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | Install skills from Anthropic, GitHub, or another git source |
| `skillsmgr custom-install <name>` | `ci` | Install a local skill directory from the current working directory into `custom/` |
| `skillsmgr list` | - | List installed skills in `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | List deployed skills and configured tools in the current project |
| `skillsmgr init` | - | Interactive deployment to the current project |
| `skillsmgr add <name>` | - | Add one installed skill to `.agents/skills/` |
| `skillsmgr remove <name>` | - | Remove one deployed skill from `.agents/skills/` |
| `skillsmgr sync` | - | Verify deployed skills, detect orphaned skills, and refresh copied skills when needed |
| `skillsmgr update [source]` | - | Update installed skills from tracked sources |

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

### Local custom skill

```bash
# from a directory that contains ./my-skill/SKILL.md
npx skillsmgr custom-install my-skill
```

### Useful install options

```bash
# install every discovered skill without prompting
npx skillsmgr install anthropic --all

# treat the installed source as custom instead of community
npx skillsmgr install https://github.com/user/repo --custom
```

The installer currently handles these repository layouts:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` at the repository root

## Interactive Usage

`install` and `init` use an interactive selector with these shortcuts:

- `j` / `k` or arrow keys: move
- `gg` / `G`: jump to top or bottom
- `/`: enter search mode when the list is large
- `space`: toggle selection
- `ctrl+a`: toggle all visible items
- `enter`: confirm
- `q` or `ctrl+c`: cancel

## Directory Layout

```text
~/.skills-manager/
├── official/
│   └── anthropic/
├── community/
├── custom/
│   └── example-skill/
└── sources.json
```

- `official/`: built-in official sources such as `anthropic`
- `community/`: third-party repositories
- `custom/`: local skills and skills intentionally installed as custom
- `sources.json`: source metadata used by `update`

## License

MIT
