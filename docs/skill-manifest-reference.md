# skill.json Manifest Reference

This document describes every field of the `skill.json` manifest a skill package may declare.  All fields except `name`, `version`, `description` are optional.

## Required fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Package name. Must follow npm package naming (lowercase, dots, hyphens, optional `@scope/`). |
| `version` | string | Semver, e.g. `1.0.0` or `1.0.0-beta.1`. |
| `description` | string | One-line summary of what the skill does. |

## Common optional fields

| Field | Type | Description |
|-------|------|-------------|
| `main` | string | Entry document, defaults to `SKILL.md`. |
| `keywords` | string[] | Free-form tags for search. |
| `author` | string | Maintainer name / handle. |
| `license` | string | SPDX identifier (`MIT`, `Apache-2.0`, etc.). |
| `engines` | Record<string,string> | Optional engine constraints. |
| `dependencies` | string[] | Other skills this one depends on; see "Dependencies" below. |

## Dependencies

`dependencies` is a string array of skill identifiers.  Three formats are supported:

- `package-name` — installed from the registry (skillsmgr.dev)
- `owner/repo:skill-name` — a specific skill from a GitHub repo
- `owner/repo` — every skill from a GitHub repo

Old-style `Record<string, string>` (with version constraints) is rejected with a migration hint.

## Target Agents

```json
"targetAgents": ["claude-code"]
```

Declares which agents this skill applies to.

- Empty array or omitted → "all agents" (universal); skill always shows up in `add` / `deploy` candidates regardless of selected agent set.
- Non-empty → skill only appears in candidates when the user's selected agent set has a non-empty intersection with `targetAgents`.
- Each entry MUST be one of `SUPPORTED_TOOLS` from `src/constants.ts`.

## Companions

`companions` declares additional single files that must be deployed outside the skill directory (for example, a Claude Code subagent file at the project's `.claude/agents/<name>.md`).

```json
"companions": [
  {
    "source": "agents/jt-codex-runner.md",
    "agentTargets": {
      "claude-code": ".claude/agents/jt-codex-runner.md"
    }
  }
]
```

Per-companion fields:

- `source` (required, string): path inside the skill (relative to skill root). MUST NOT contain `..` segments and MUST resolve inside the skill directory.
- `agentTargets` (required, object): per-agent target path inside the project.
  - Keys MUST be agent names from `SUPPORTED_TOOLS`.
  - Values are project-relative paths; MUST NOT contain `..` and MUST resolve inside the project root.
  - At least one `(agent, path)` entry is required.

When `targetAgents` is set on the skill, every `agentTargets` key MUST be a subset of `targetAgents`.  When `targetAgents` is unset (universal), no subset constraint applies.

### Deploy semantics

For each companion, the deployer:

1. Computes the intersection of the user's selected agent set with `agentTargets` keys.
2. For each matching agent, resolves the absolute target path from `<projectDir>/<agentTargets[agent]>`.
3. Writes the file using the same mode (link / copy) as the skill body — link in default mode, copy under `--copy`.
4. Records the absolute target path in `~/.skills-manager/deployments.json` under that project's `skillCompanions[<skill>].deployedCompanions`.

### Conflict detection

Before any companion is written, the deployer pre-checks:

- If two companions in the same skill resolve to the same target path, an error is thrown.
- If a companion's target path is already recorded for a different skill in this project, an error is thrown naming both skills and the path.

Either case aborts the deployment transactionally — the skill body and any partially-written companion are rolled back.

### Reverse cleanup

`uninstall`, `remove`, and `group remove` consult the registry's recorded `deployedCompanions` and remove each path:

- Removal is idempotent (file already gone is fine).
- Symlinks are removed via `unlinkSync` (the symlink target is left alone).
- The skill's `skillCompanions` record and `pinnedSkills` entry are then cleared.

## Full jt-codex example

```json
{
  "name": "jt-codex",
  "version": "0.4.0",
  "description": "Run Codex CLI from inside Claude Code via a subagent.",
  "author": "jtianling",
  "license": "MIT",
  "targetAgents": ["claude-code"],
  "companions": [
    {
      "source": "agents/jt-codex-runner.md",
      "agentTargets": {
        "claude-code": ".claude/agents/jt-codex-runner.md"
      }
    }
  ]
}
```

This skill only appears as a candidate when the user has Claude Code selected, and on deploy the file `agents/jt-codex-runner.md` from the skill is link/copied to `<projectDir>/.claude/agents/jt-codex-runner.md`.
