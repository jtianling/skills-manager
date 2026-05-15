# skillsmgr

Unified skills manager for AI coding tools. Install skills into `~/.skills-manager/`, then deploy them to projects through a single `.agents/skills/` directory. Supports 44 tools with one workflow.

[العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Highlights

- **Central repository, deploy anywhere** — Skills are installed once into `~/.skills-manager/`. After that, `add` lets you interactively pick from all locally installed skills and deploy them to any project or globally — no need to remember the original repo URL or path every time.
- **Registry integration** — Search, install, and publish skills via the [skillsmgr.dev](https://skillsmgr.dev) registry. `skillsmgr install code-review` fetches from the registry. `skillsmgr publish` shares your skills with the community.
- **Automatic dependency resolution** — Skills can declare dependencies on other skills. When you install a skill, its dependencies are automatically resolved and installed recursively.
- **First-class physical and virtual groups** — Organize skills into named virtual groups, or install a local directory as a physical group. Deploy an entire group with `skillsmgr add group-name`. Populate virtual groups from multiple sources with `group add`, and manage physical groups with `group install`, `group update`, `group uninstall`, and `group rename`.
- **Zip archive support** — Install skills directly from `.zip` files or Anthropic's `.skill` packages, which makes it simple to package and share skill bundles outside of GitHub.

## Requirements

- Node.js `>=18`

## Supported Tools

All skills deploy to `.agents/skills/`. Native tools read that directory directly. Non-native tools use a symlink bridge to their legacy skill path. The table below lists the 17 tools shown in the interactive selector. An additional 27 agents are also supported and can be targeted directly via the `-a` flag in non-interactive commands (e.g., `skillsmgr add code-review -a amp`). See [docs/supported-agents.md](docs/supported-agents.md) for the full list.

| Tool | Type | Project Path |
|------|------|--------------|
| Claude Code | Symlink bridge | `.claude/skills -> .agents/skills` |
| Codex | Native | `.agents/skills` |
| Cursor | Native | `.agents/skills` |
| OpenClaw | Symlink bridge | `skills -> .agents/skills` |
| OpenCode | Native | `.agents/skills` |
| Antigravity | Native | `.agents/skills` |
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

Three steps to go from zero to a deployed skill:

```bash
# 1. Install a skill into the central repository at ~/.skills-manager/
npx skillsmgr install code-review

# 2. Deploy installed skills into the current project (interactive picker)
cd your-project
npx skillsmgr deploy

# 3. Verify what is deployed
npx skillsmgr list --deployed
```

### Other install sources

```bash
# all skills from a GitHub repo (shorthand or full URL)
npx skillsmgr install anthropics/skills
npx skillsmgr install https://github.com/user/skills-repo

# a single skill from a repo
npx skillsmgr install obra/superpowers:my-skill

# a local directory or zip / .skill archive
npx skillsmgr install ./my-skill
npx skillsmgr install ./skills-archive.zip
```

### Non-interactive deploy

```bash
# deploy a specific skill to a specific agent
npx skillsmgr add code-review -a claude-code

# deploy globally to the agent's user-level skill directory
npx skillsmgr add code-review -g -a claude-code

# remove a deployed skill
npx skillsmgr remove code-review
```

That's it.  Sections below cover the full command set, command flags, group management, the registry publishing flow, and the underlying deployment model.

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
- Non-native tools are configured by creating a symlink bridge during `deploy` or `add`.
- Skill deployment defaults to symlinks; use `--copy` if you want project-local copies instead.
- Use `-g` to deploy globally to agent user-level directories (e.g., `~/.claude/skills`).

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `skillsmgr install <source>` | `i` | Install skills from GitHub, local directory, zip archive, or registry |
| `skillsmgr uninstall [identifier]` | - | Remove skills from `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Update installed skills from tracked sources |
| `skillsmgr list` | - | List installed skills in `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | List deployed skills and configured tools in the current project |
| `skillsmgr deploy` | - | Interactive deployment to the current project |
| `skillsmgr add [name]` | - | Add a skill to the project (name, `owner/repo`, or group name) |
| `skillsmgr remove [name]` | - | Remove a deployed skill from the project (name, `owner/repo`, or group name) |
| `skillsmgr group <subcommand>` | - | Manage physical and virtual skill groups |
| `skillsmgr search [query]` | - | Search for skills on the skillsmgr.dev registry |
| `skillsmgr publish [dir]` | - | Publish a skill to the skillsmgr.dev registry |
| `skillsmgr login` | - | Log in to the skillsmgr.dev registry |
| `skillsmgr logout` | - | Log out from the registry |
| `skillsmgr whoami` | - | Show the currently logged-in user |

### Command Flags

**install**

| Flag | Description |
|------|-------------|
| `--all` | Install all discovered skills without prompting |
| `--custom` | Install to `custom/` instead of `community/` |
| `-f, --force` | Overwrite existing skill without confirmation |
| `--group <name>` | Add installed skills to a virtual group |
| `-s, --skill <name>` | Select specific skills (repeatable) |

**add**

| Flag | Description |
|------|-------------|
| `--all` | Add all skills without prompting |
| `--copy` | Copy files instead of creating symlinks |
| `-a, --agent <name>` | Target agent (repeatable) |
| `-s, --skill <name>` | Select specific skills (repeatable) |
| `-g, --global` | Deploy globally to agent user-level directories |
| `--group <name>` | Batch deploy all skills from a group |
| `-y, --yes` | Skip all prompts (equivalent to --all) |
| `--same-agents` | Use currently configured agents |

**remove**

| Flag | Description |
|------|-------------|
| `--all` | Remove all matching skills without prompting |
| `-s, --skill <name>` | Specific skill to remove (repeatable) |
| `-a, --agent <name>` | Target agent (repeatable) |
| `-g, --global` | Remove from global agent directories |
| `--group <name>` | Batch remove deployed skills from a group |
| `-y, --yes` | Skip all prompts (equivalent to --all) |

**deploy**

| Flag | Description |
|------|-------------|
| `--copy` | Copy files instead of creating symlinks |
| `-g, --global` | Deploy skills globally to agent user-level directories |

**uninstall**

| Flag | Description |
|------|-------------|
| `--all` | Skip selection prompt and uninstall all matching skills |
| `-f, --force` | Skip confirmation prompt |
| `-y, --yes` | Skip all prompts (equivalent to --all --force) |
| `-s, --skill <name>` | Specific skill to uninstall (repeatable) |

**update**

| Flag | Description |
|------|-------------|
| `--sync` | For bundle updates, hard-remove members that no longer exist in the source |
| `--keep-local` | Keep orphaned members when updating a physical group |
| `-v, --verbose` | Show per-skill status for physical group updates instead of collapsing up-to-date items |

### Update / Uninstall input formats

`update` and `uninstall` share a single source resolution ruleset and accept the following inputs:

- `owner/repo`: e.g. `anthropics/skills`, `obra/superpowers`
- `owner/repo:skill`: a single skill, e.g. `obra/superpowers:my-skill`
- Git URL: HTTPS, SSH, or `.git` suffix, e.g. `https://github.com/obra/superpowers`, `git@github.com:obra/superpowers.git`
- Registry package: e.g. `code-review`, `code-review@1.2.0`, `@acme/skill-x`
- Local single-skill path: e.g. `./my-skill`, `/abs/path/to/my-skill`, `~/skills/my-skill`
- Bareword fallback: tried in order `registry -> source key suffix -> repoName -> skill name`

Limitations:

- Zip sources still require a manual reinstall; `update` / `uninstall` do not handle them directly
- A local batch directory resolves to a physical group: `update ./batch-dir` syncs the whole group, `uninstall ./batch-dir` removes the whole group
- Physical group `update` removes local members that no longer exist in the source by default. Pass `--keep-local` to preserve those orphaned members
- `-v` / `--verbose` expands per-member status for physical group updates; the default collapses up-to-date items and only shows changes
- `update code-review@1.2.0` switches to the specified version — it is not a "check for latest" command

**group**

| Subcommand | Description |
|------------|-------------|
| `group list [name]` | List all groups or show group details, including kind |
| `group install <path>` | Install a local directory as a physical group |
| `group create <name>` | Create a new empty virtual group |
| `group delete <name>` | Delete a virtual group (skills are not affected) |
| `group uninstall <name>` | Uninstall a physical group |
| `group update <name>` | Update a physical or virtual group |
| `group add <group> <identifier>` | Add a skill, `owner/repo` source, or another group to a group |
| `group remove <group> <identifier>` | Remove a skill, `owner/repo` source, or another group from a group |
| `group rename <old> <new>` | Rename a group |

## Installing Skills

### From the registry

```bash
# install by package name (dependencies auto-resolved)
npx skillsmgr install code-review

# install a specific version
npx skillsmgr install code-review@1.0.0

# search the registry first
npx skillsmgr search code
```

### Official Anthropic skills

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
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

# install from a zip file or .skill package
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# install into a custom group
npx skillsmgr install ./my-skill --group my-tools
```

### Useful install options

```bash
# install every discovered skill without prompting
npx skillsmgr install anthropics/skills --all

# install only specific skills by name
npx skillsmgr install anthropics/skillss/skills -s code-review -s commit-message

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
npx skillsmgr deploy

# deploy globally to agent user-level directories
npx skillsmgr deploy -g
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

`install`, `deploy`, `add`, `remove`, and `uninstall` use an interactive selector with these shortcuts:

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
│   └── example-skill/SKILL.md
├── groups.json
└── sources.json
```

- `official/`: built-in official sources such as `anthropic`
- `community/`: third-party repositories
- `custom/`: local skills and skills explicitly installed as custom
- `registry/`: skills installed from skillsmgr.dev registry
- `groups.json`: physical and virtual group definitions managed by `group` commands
- `sources.json`: git/registry/zip source metadata, plus git/zip bundle metadata used by `update`.  Single local installs under `custom/<name>/` are tracked by disk presence only, not by `sources.json`
- `auth.json`: registry authentication token

See [docs/group-first-class-unit.md](docs/group-first-class-unit.md) for the physical vs virtual group model, migration behavior, and the ownership boundary of `~/.skills-manager/custom/<name>/`.

## Publishing Skills

### skill.json

Every publishable skill needs a `skill.json` manifest:

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "A short description of what the skill does",
  "main": "SKILL.md",
  "keywords": ["code", "review"],
  "author": "your-name",
  "license": "MIT",
  "dependencies": ["base-prompts", "owner/repo:helper-skill"],
  "targetAgents": ["claude-code"],
  "companions": [
    {
      "source": "agents/my-runner.md",
      "agentTargets": {
        "claude-code": ".claude/agents/my-runner.md"
      }
    }
  ]
}
```

**Required fields**: `name`, `version`, `description`. All others are optional.

### Target Agents

`targetAgents` declares which agents the skill applies to.  Empty / unset means "all agents" (universal).  When set, `add` / `deploy` filter the candidate list so the skill only appears when the user's selected agent set intersects with `targetAgents`.

### Companions

`companions[]` declares additional single files that must be deployed outside the skill directory (for example, a Claude Code subagent at `.claude/agents/<name>.md`):

- `source`: path inside the skill (relative to skill root, no `..`)
- `agentTargets`: per-agent target path inside the project (relative, no `..`)
- The keys of `agentTargets` MUST be a subset of `targetAgents` when `targetAgents` is set

Companions follow the deploy mode (link / copy) of the skill body and are tracked in `~/.skills-manager/deployments.json` so uninstall / remove cleans them up exactly.  Two skills writing to the same companion target path is detected at deploy time and reported as a conflict.

### Dependencies

Skills can declare dependencies on other skills. The `dependencies` field is a string array (no version constraints):

```json
"dependencies": [
  "base-prompts",
  "anthropics/skills:code-review",
  "owner/repo"
]
```

Supported formats:
- **Registry package**: `"base-prompts"` — installed from skillsmgr.dev
- **GitHub specific skill**: `"owner/repo:skill-name"` — a specific skill from a GitHub repo
- **GitHub full repo**: `"owner/repo"` — all skills from a GitHub repo

When a user installs your skill, dependencies are automatically resolved and installed.

### Publish workflow

```bash
# 1. Log in (first time only)
npx skillsmgr login

# 2. Create skill.json in your skill directory
# 3. Publish
npx skillsmgr publish

# 4. Verify
npx skillsmgr search my-skill
```

During publishing, skillsmgr checks that all declared dependencies are available on the registry. If any are missing, you'll be prompted to resolve them.

## Acknowledgements

This project was independently created. Many subsequent improvements were inspired by [vercel-labs/skills](https://github.com/vercel-labs/skills).

## License

MIT
