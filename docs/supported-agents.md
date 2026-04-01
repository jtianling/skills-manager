# All Supported Agents

44 agents in total. 17 are shown in the interactive selector; the remaining 27 can be used via `-a` flag in non-interactive commands.

| Agent ID | Display Name | Type | Project Path | Global Path | Interactive |
|----------|-------------|------|--------------|-------------|:-----------:|
| `claude-code` | Claude Code | Symlink bridge | `.claude/skills` | `~/.claude/skills` | Yes |
| `codex` | Codex | Native | `.agents/skills` | `~/.codex/skills` | Yes |
| `cursor` | Cursor | Native | `.agents/skills` | `~/.cursor/skills` | Yes |
| `openclaw` | OpenClaw | Symlink bridge | `skills` | `~/.openclaw/skills` | Yes |
| `opencode` | OpenCode | Native | `.agents/skills` | `~/.config/opencode/skills` | Yes |
| `gemini-cli` | Gemini CLI | Native | `.agents/skills` | `~/.gemini/skills` | Yes |
| `github-copilot` | GitHub Copilot | Native | `.agents/skills` | `~/.copilot/skills` | Yes |
| `cline` | Cline | Native | `.agents/skills` | `~/.agents/skills` | Yes |
| `kilo` | Kilo Code | Symlink bridge | `.kilocode/skills` | `~/.kilocode/skills` | Yes |
| `roo` | Roo Code | Symlink bridge | `.roo/skills` | `~/.roo/skills` | Yes |
| `kiro-cli` | Kiro CLI | Symlink bridge | `.kiro/skills` | `~/.kiro/skills` | Yes |
| `trae` | Trae | Symlink bridge | `.trae/skills` | `~/.trae/skills` | Yes |
| `trae-cn` | Trae CN | Symlink bridge | `.trae/skills` | `~/.trae-cn/skills` | Yes |
| `codebuddy` | CodeBuddy | Symlink bridge | `.codebuddy/skills` | `~/.codebuddy/skills` | Yes |
| `windsurf` | Windsurf | Symlink bridge | `.windsurf/skills` | `~/.codeium/windsurf/skills` | Yes |
| `goose` | Goose | Symlink bridge | `.goose/skills` | `~/.config/goose/skills` | Yes |
| `adal` | AdaL | Symlink bridge | `.adal/skills` | `~/.adal/skills` | - |
| `amp` | Amp | Native | `.agents/skills` | `~/.config/agents/skills` | - |
| `antigravity` | Antigravity | Native | `.agents/skills` | `~/.gemini/antigravity/skills` | Yes |
| `augment` | Augment | Symlink bridge | `.augment/skills` | `~/.augment/skills` | - |
| `command-code` | Command Code | Symlink bridge | `.commandcode/skills` | `~/.commandcode/skills` | - |
| `continue` | Continue | Symlink bridge | `.continue/skills` | `~/.continue/skills` | - |
| `cortex` | Cortex Code | Symlink bridge | `.cortex/skills` | `~/.snowflake/cortex/skills` | - |
| `crush` | Crush | Symlink bridge | `.crush/skills` | `~/.config/crush/skills` | - |
| `deepagents` | Deep Agents | Native | `.agents/skills` | `~/.deepagents/agent/skills` | - |
| `droid` | Droid | Symlink bridge | `.factory/skills` | `~/.factory/skills` | - |
| `firebender` | Firebender | Native | `.agents/skills` | `~/.firebender/skills` | - |
| `iflow-cli` | iFlow CLI | Symlink bridge | `.iflow/skills` | `~/.iflow/skills` | - |
| `junie` | Junie | Symlink bridge | `.junie/skills` | `~/.junie/skills` | - |
| `kimi-cli` | Kimi Code CLI | Native | `.agents/skills` | `~/.config/agents/skills` | - |
| `kode` | Kode | Symlink bridge | `.kode/skills` | `~/.kode/skills` | - |
| `mcpjam` | MCPJam | Symlink bridge | `.mcpjam/skills` | `~/.mcpjam/skills` | - |
| `mistral-vibe` | Mistral Vibe | Symlink bridge | `.vibe/skills` | `~/.vibe/skills` | - |
| `mux` | Mux | Symlink bridge | `.mux/skills` | `~/.mux/skills` | - |
| `neovate` | Neovate | Symlink bridge | `.neovate/skills` | `~/.neovate/skills` | - |
| `openhands` | OpenHands | Symlink bridge | `.openhands/skills` | `~/.openhands/skills` | - |
| `pi` | Pi | Symlink bridge | `.pi/skills` | `~/.pi/agent/skills` | - |
| `pochi` | Pochi | Symlink bridge | `.pochi/skills` | `~/.pochi/skills` | - |
| `qoder` | Qoder | Symlink bridge | `.qoder/skills` | `~/.qoder/skills` | - |
| `qwen-code` | Qwen Code | Symlink bridge | `.qwen/skills` | `~/.qwen/skills` | - |
| `replit` | Replit | Native | `.agents/skills` | `~/.config/agents/skills` | - |
| `universal` | Universal | Native | `.agents/skills` | `~/.config/agents/skills` | - |
| `warp` | Warp | Native | `.agents/skills` | `~/.agents/skills` | - |
| `zencoder` | Zencoder | Symlink bridge | `.zencoder/skills` | `~/.zencoder/skills` | - |

**Type** — *Native* agents read `.agents/skills/` directly. *Symlink bridge* agents use a symlink from their legacy path to `.agents/skills/`.

**Usage example** — deploy a skill to a non-interactive agent:

```bash
npx skillsmgr add code-review -a amp
npx skillsmgr add code-review -a junie -a continue
```
