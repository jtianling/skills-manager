# skillsmgr

Unified skills manager for AI coding tools. Manage skills in `~/.skills-manager/` and deploy them to multiple AI tools.

[中文文档](./README.zh-CN.md)

## Supported Tools

| Tool | Skills Directory | Mode-Specific |
|------|-----------------|---------------|
| Claude Code | `.claude/skills/` | No |
| Cursor | `.cursor/skills/` | No |
| Windsurf | `.windsurf/skills/` | No |
| Cline | `.cline/skills/` | No |
| Roo Code | `.roo/skills/` | Yes |
| Kilo Code | `.kilocode/skills/` | Yes |
| OpenCode | `.opencode/skills/` | No |
| Trae | `.trae/skills/` | No |
| Antigravity | `.agent/skills/` | No |

## Quick Start

```bash
# Initialize skills manager
npx skillsmgr setup

# Install official Anthropic skills
npx skillsmgr install anthropic

# Deploy skills to your project
cd your-project
npx skillsmgr init
```

## Commands

### `npx skillsmgr setup`

Initialize `~/.skills-manager/` directory structure with example skill.

```bash
npx skillsmgr setup
```

### `npx skillsmgr install <source>`

Download skills from a repository.

```bash
# Install official Anthropic skills
npx skillsmgr install anthropic

# Install from any GitHub repository
npx skillsmgr install https://github.com/user/skills-repo

# Install specific skill
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review

# Install all skills without prompting
npx skillsmgr install anthropic --all

# Install to custom/ instead of community/
npx skillsmgr install https://github.com/user/repo --custom
```

### `npx skillsmgr list`

List available skills.

```bash
# List all available skills
npx skillsmgr list

# List deployed skills in current project
npx skillsmgr list --deployed
```

### `npx skillsmgr init`

Interactive deployment of skills to current project.

```bash
npx skillsmgr init
```

Features:
- Select target tools (Claude Code, Cursor, etc.)
- Select mode for Roo Code / Kilo Code
- Choose skills to deploy with search filter
- Incremental updates (add/remove skills)

### `npx skillsmgr add <skill>`

Quick add a skill to project.

```bash
# Add to all configured tools
npx skillsmgr add code-review

# Add to specific tool
npx skillsmgr add code-review --tool claude-code

# Use copy mode instead of symlink
npx skillsmgr add code-review --copy
```

### `npx skillsmgr remove <skill>`

Remove a skill from project.

```bash
# Remove from all tools
npx skillsmgr remove code-review

# Remove from specific tool
npx skillsmgr remove code-review --tool claude-code
```

### `npx skillsmgr sync`

Sync and verify deployed skills.

```bash
npx skillsmgr sync
```

## Directory Structure

```
~/.skills-manager/
├── official/           # Official skills (anthropic/skills)
│   └── anthropic/
│       ├── code-review/
│       └── tdd/
├── community/          # Community skills (other repos)
│   └── awesome-skills/
│       └── react-patterns/
└── custom/             # Local custom skills
    └── my-skill/
```

## Features

- **Unified Management**: Manage all skills in one place
- **Multi-tool Support**: Deploy to 9 different AI tools
- **Symlink by Default**: Changes sync automatically
- **Search Filter**: Quick search for large skill repositories
- **Progress Indicators**: Visual feedback during downloads
- **Incremental Updates**: Add/remove skills without full redeploy

## License

MIT
