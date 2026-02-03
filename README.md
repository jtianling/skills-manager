# skillsmgr

Unified skills manager for AI coding tools. Manage skills in `~/.skills-manager/` and deploy them to multiple AI tools.

## Supported Tools

| Tool | Skills Directory | Mode-Specific |
|------|-----------------|---------------|
| Claude Code | `.claude/skills/` | No |
| Cursor | `.cursor/skills/` | No |
| Windsurf | `.windsurf/skills/` | No |
| Cline | `.cline/skills/` | No |
| Roo Code | `.roo/skills/` | Yes |
| Kilo Code | `.kilocode/skills/` | Yes |
| Antigravity | `.agent/skills/` | No |

## Installation

```bash
npm install -g skillsmgr
```

## Quick Start

```bash
# Initialize skills manager
skillsmgr setup

# Install official Anthropic skills
skillsmgr install anthropic

# Deploy skills to your project
cd your-project
skillsmgr init
```

## Commands

### `skillsmgr setup`

Initialize `~/.skills-manager/` directory structure with example skill.

```bash
skillsmgr setup
```

### `skillsmgr install <source>`

Download skills from a repository.

```bash
# Install official Anthropic skills
skillsmgr install anthropic

# Install from any GitHub repository
skillsmgr install https://github.com/user/skills-repo

# Install specific skill
skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review

# Install all skills without prompting
skillsmgr install anthropic --all

# Install to custom/ instead of community/
skillsmgr install https://github.com/user/repo --custom
```

### `skillsmgr list`

List available skills.

```bash
# List all available skills
skillsmgr list

# List deployed skills in current project
skillsmgr list --deployed
```

### `skillsmgr init`

Interactive deployment of skills to current project.

```bash
skillsmgr init
```

Features:
- Select target tools (Claude Code, Cursor, etc.)
- Select mode for Roo Code / Kilo Code
- Choose skills to deploy with search filter
- Incremental updates (add/remove skills)

### `skillsmgr add <skill>`

Quick add a skill to project.

```bash
# Add to all configured tools
skillsmgr add code-review

# Add to specific tool
skillsmgr add code-review --tool claude-code

# Use copy mode instead of symlink
skillsmgr add code-review --copy
```

### `skillsmgr remove <skill>`

Remove a skill from project.

```bash
# Remove from all tools
skillsmgr remove code-review

# Remove from specific tool
skillsmgr remove code-review --tool claude-code
```

### `skillsmgr sync`

Sync and verify deployed skills.

```bash
skillsmgr sync
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
- **Multi-tool Support**: Deploy to 7 different AI tools
- **Symlink by Default**: Changes sync automatically
- **Search Filter**: Quick search for large skill repositories
- **Progress Indicators**: Visual feedback during downloads
- **Incremental Updates**: Add/remove skills without full redeploy

## License

MIT
