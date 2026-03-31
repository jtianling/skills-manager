# skillsmgr

Einheitlicher Skills-Manager für KI-Programmiertools. Skills werden in `~/.skills-manager/` installiert und dann über ein einziges `.agents/skills/`-Verzeichnis in Projekte bereitgestellt. Unterstützt 44 Tools mit einem einheitlichen Workflow.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Highlights

- **Zentrales Repository, überall bereitstellen** — Skills werden einmalig in `~/.skills-manager/` installiert. Danach können Sie mit `add` interaktiv aus allen lokal installierten Skills auswählen und diese in beliebige Projekte oder global bereitstellen — ohne sich jedes Mal die ursprüngliche Repo-URL oder den Pfad merken zu müssen.
- **Eigene Gruppen für Batch-Verwaltung** — Organisieren Sie Ihre Skills in benannten Gruppen (z. B. `--group my-tools`). Stellen Sie eine gesamte Gruppe mit einem einzigen `add --group`-Befehl in einem Projekt bereit, um persönliche Skill-Sammlungen einfach zu verwalten und zu teilen.
- **Zip-Archiv-Unterstützung** — Installieren Sie Skills direkt aus `.zip`-Dateien oder Anthropics `.skill`-Paketen, was das Verpacken und Teilen von Skill-Paketen außerhalb von GitHub vereinfacht.

## Voraussetzungen

- Node.js `>=18`

## Unterstützte Tools

Alle Skills werden in `.agents/skills/` bereitgestellt. Native Tools lesen dieses Verzeichnis direkt. Nicht-native Tools verwenden eine Symlink-Brücke zu ihrem Legacy-Skill-Pfad. Die folgende Tabelle zeigt die 16 Tools, die im interaktiven Selektor angezeigt werden. Weitere 28 Agents werden ebenfalls unterstützt und können direkt über das `-a`-Flag in nicht-interaktiven Befehlen angesprochen werden (z. B. `skillsmgr add code-review -a amp`). Die vollständige Liste finden Sie unter [docs/supported-agents.md](docs/supported-agents.md).

| Tool | Typ | Projektpfad |
|------|-----|-------------|
| Claude Code | Symlink-Brücke | `.claude/skills -> .agents/skills` |
| Codex | Nativ | `.agents/skills` |
| Cursor | Nativ | `.agents/skills` |
| OpenClaw | Symlink-Brücke | `skills -> .agents/skills` |
| OpenCode | Nativ | `.agents/skills` |
| Gemini CLI | Nativ | `.agents/skills` |
| GitHub Copilot | Nativ | `.agents/skills` |
| Cline | Nativ | `.agents/skills` |
| Kilo Code | Symlink-Brücke | `.kilocode/skills -> .agents/skills` |
| Roo Code | Symlink-Brücke | `.roo/skills -> .agents/skills` |
| Kiro CLI | Symlink-Brücke | `.kiro/skills -> .agents/skills` |
| Trae | Symlink-Brücke | `.trae/skills -> .agents/skills` |
| Trae CN | Symlink-Brücke | `.trae/skills -> .agents/skills` |
| CodeBuddy | Symlink-Brücke | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Symlink-Brücke | `.windsurf/skills -> .agents/skills` |
| Goose | Symlink-Brücke | `.goose/skills -> .agents/skills` |

## Schnellstart

```bash
# 1. Skills aus dem offiziellen Anthropic-Repository installieren
npx skillsmgr install anthropic

# 2. Skills im aktuellen Projekt bereitstellen
cd your-project
npx skillsmgr deploy

# 3. Bereitgestellte Skills anzeigen
npx skillsmgr list --deployed
```

## Bereitstellungsmodell

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

- Native Tools lesen `.agents/skills/` direkt.
- Nicht-native Tools werden konfiguriert, indem während `deploy` oder `add` eine Symlink-Brücke erstellt wird.
- Die Skill-Bereitstellung erfolgt standardmäßig über Symlinks; verwenden Sie `--copy`, wenn Sie stattdessen projektlokale Kopien wünschen.
- Verwenden Sie `-g`, um Skills global in den Benutzerverzeichnissen der Agents bereitzustellen (z. B. `~/.claude/skills`).

## Befehle

| Befehl | Alias | Beschreibung |
|--------|-------|--------------|
| `skillsmgr install <source>` | `i` | Skills von GitHub, lokalem Verzeichnis oder Zip-Archiv installieren |
| `skillsmgr uninstall [identifier]` | - | Skills aus `~/.skills-manager/` entfernen |
| `skillsmgr update [source]` | - | Installierte Skills aus verfolgten Quellen aktualisieren |
| `skillsmgr list` | - | Installierte Skills in `~/.skills-manager/` auflisten |
| `skillsmgr list --deployed` | - | Bereitgestellte Skills und konfigurierte Tools im aktuellen Projekt auflisten |
| `skillsmgr deploy` | - | Interaktive Bereitstellung im aktuellen Projekt |
| `skillsmgr add [name]` | - | Einen Skill zum Projekt hinzufügen |
| `skillsmgr remove [name]` | - | Einen bereitgestellten Skill aus dem Projekt entfernen |
| `skillsmgr group <subcommand>` | - | Virtuelle Skill-Gruppen verwalten |

### Befehlsflags

**install**

| Flag | Beschreibung |
|------|--------------|
| `--all` | Alle erkannten Skills ohne Rückfrage installieren |
| `--custom` | In `custom/` statt `community/` installieren |
| `-f, --force` | Vorhandenen Skill ohne Bestätigung überschreiben |
| `--group <name>` | Installierte Skills einer virtuellen Gruppe hinzufügen |
| `-s, --skill <name>` | Bestimmte Skills auswählen (wiederholbar) |

**add**

| Flag | Beschreibung |
|------|--------------|
| `--all` | Alle Skills ohne Rückfrage hinzufügen |
| `--copy` | Dateien kopieren statt Symlinks zu erstellen |
| `-a, --agent <name>` | Ziel-Agent (wiederholbar) |
| `-s, --skill <name>` | Bestimmte Skills auswählen (wiederholbar) |
| `-g, --global` | Global in den Benutzerverzeichnissen der Agents bereitstellen |
| `--group <name>` | Alle Skills einer Gruppe auf einmal bereitstellen |
| `-y, --yes` | Alle Rückfragen überspringen (entspricht --all) |
| `--same-agents` | Aktuell konfigurierte Agents verwenden |

**remove**

| Flag | Beschreibung |
|------|--------------|
| `--all` | Alle passenden Skills ohne Rückfrage entfernen |
| `-s, --skill <name>` | Bestimmter Skill zum Entfernen (wiederholbar) |
| `-a, --agent <name>` | Ziel-Agent (wiederholbar) |
| `-g, --global` | Aus globalen Agent-Verzeichnissen entfernen |
| `--group <name>` | Alle bereitgestellten Skills einer Gruppe entfernen |
| `-y, --yes` | Alle Rückfragen überspringen (entspricht --all) |

**deploy**

| Flag | Beschreibung |
|------|--------------|
| `--copy` | Dateien kopieren statt Symlinks zu erstellen |
| `-g, --global` | Skills global in den Benutzerverzeichnissen der Agents bereitstellen |

**uninstall**

| Flag | Beschreibung |
|------|--------------|
| `--all` | Auswahlabfrage überspringen und alle passenden Skills deinstallieren |
| `-f, --force` | Bestätigungsabfrage überspringen |
| `-y, --yes` | Alle Rückfragen überspringen (entspricht --all --force) |
| `-s, --skill <name>` | Bestimmter Skill zum Deinstallieren (wiederholbar) |

**group**

| Unterbefehl | Beschreibung |
|-------------|--------------|
| `group list [name]` | Alle Gruppen auflisten oder Gruppendetails anzeigen |
| `group create <name>` | Eine neue leere Gruppe erstellen |
| `group delete <name>` | Eine Gruppe löschen (Skills bleiben unberührt) |
| `group add <group> <skill>` | Einen Skill zu einer Gruppe hinzufügen |
| `group remove <group> <skill>` | Einen Skill aus einer Gruppe entfernen |
| `group rename <old> <new>` | Eine Gruppe umbenennen |

## Skills installieren

### Offizielle Anthropic-Skills

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### GitHub-Repository

```bash
# owner/repo-Kurzform
npx skillsmgr install Fission-AI/OpenSpec

# vollständige GitHub-URL
npx skillsmgr install https://github.com/user/skills-repo

# spezifischer Skill-Pfad
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Lokales Verzeichnis oder Zip-Archiv

```bash
# aus einem lokalen Verzeichnis installieren (muss mit ./ oder / beginnen)
npx skillsmgr install ./my-skill

# aus einer Zip-Datei oder einem .skill-Paket installieren
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# in eine benutzerdefinierte Gruppe installieren
npx skillsmgr install ./my-skill --group my-tools
```

### Nützliche Installationsoptionen

```bash
# alle erkannten Skills ohne Rückfrage installieren
npx skillsmgr install anthropic --all

# nur bestimmte Skills nach Name installieren
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# installierte Quelle als custom statt community behandeln
npx skillsmgr install https://github.com/user/repo --custom
```

Der Installer verarbeitet folgende Repository-Layouts:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` im Repository-Stammverzeichnis

## Skills bereitstellen

### Interaktive Bereitstellung

```bash
# im aktuellen Projekt bereitstellen (interaktive Agent- und Skill-Auswahl)
npx skillsmgr deploy

# global in den Benutzerverzeichnissen der Agents bereitstellen
npx skillsmgr deploy -g
```

### Nicht-interaktive Bereitstellung

```bash
# einen bestimmten Skill zu einem bestimmten Agent hinzufügen
npx skillsmgr add code-review -a claude-code

# mehrere Skills zu mehreren Agents hinzufügen
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# global bereitstellen
npx skillsmgr add code-review -g -a claude-code

# einen Skill entfernen
npx skillsmgr remove code-review

# aus globaler Bereitstellung entfernen
npx skillsmgr remove code-review -g -a claude-code
```

## Interaktive Nutzung

`install`, `deploy`, `add`, `remove` und `uninstall` verwenden einen interaktiven Selektor mit diesen Tastenkombinationen:

| Taste | Aktion |
|-------|--------|
| `j` / `k` oder Pfeiltasten | Cursor bewegen |
| `gg` / `G` | Zum Anfang oder Ende springen |
| `h` / `l` | Aktuelle Gruppe ein-/ausklappen |
| `c` | Alle Gruppen ein-/ausklappen |
| `/` | Suchmodus starten (bei großen Listen) |
| `space` | Auswahl umschalten |
| `ctrl+a` | Alle sichtbaren Elemente umschalten |
| `enter` | Bestätigen |
| `q` oder `ctrl+c` | Abbrechen |

## Verzeichnisstruktur

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

- `official/`: integrierte offizielle Quellen wie `anthropic`
- `community/`: Drittanbieter-Repositories
- `custom/`: lokale Skills und Skills, die explizit als custom installiert wurden
- `groups.json`: Virtuelle Gruppendefinitionen, verwaltet durch `group`-Befehle
- `sources.json`: Quell-Metadaten, die von `update` verwendet werden

## Danksagungen

Dieses Projekt wurde unabhängig erstellt. Viele spätere Verbesserungen wurden von [vercel-labs/skills](https://github.com/vercel-labs/skills) inspiriert.

## Lizenz

MIT
