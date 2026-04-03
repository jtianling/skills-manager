# skillsmgr

Einheitlicher Skills-Manager für KI-Programmiertools. Skills werden in `~/.skills-manager/` installiert und dann über ein einziges `.agents/skills/`-Verzeichnis in Projekte bereitgestellt. Unterstützt 44 Tools mit einem einheitlichen Workflow.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Highlights

- **Zentrales Repository, überall bereitstellen** — Skills werden einmalig in `~/.skills-manager/` installiert. Danach können Sie mit `add` interaktiv aus allen lokal installierten Skills auswählen und diese in beliebige Projekte oder global bereitstellen — ohne sich jedes Mal die ursprüngliche Repo-URL oder den Pfad merken zu müssen.
- **Registry-Integration** — Skills über die [skillsmgr.dev](https://skillsmgr.dev)-Registry suchen, installieren und veröffentlichen. `skillsmgr install code-review` lädt aus der Registry. `skillsmgr publish` teilt Ihre Skills mit der Community.
- **Automatische Abhängigkeitsauflösung** — Skills können Abhängigkeiten von anderen Skills deklarieren. Beim Installieren eines Skills werden seine Abhängigkeiten automatisch rekursiv aufgelöst und installiert.
- **Eigene Gruppen für Batch-Verwaltung** — Organisieren Sie Skills in benannten Gruppen (z. B. `--group my-tools`). Stellen Sie eine gesamte Gruppe mit `skillsmgr add group-name` bereit. Befüllen Sie Gruppen aus mehreren Quellen: Einzelne Skills mit `group add my-group skill-name`, alle Skills eines Repos mit `group add my-group owner/repo`, oder verschachteln Sie Gruppen mit `group add my-group another-group`.
- **Zip-Archiv-Unterstützung** — Installieren Sie Skills direkt aus `.zip`-Dateien oder Anthropics `.skill`-Paketen, was das Verpacken und Teilen von Skill-Paketen außerhalb von GitHub vereinfacht.

## Voraussetzungen

- Node.js `>=18`

## Unterstützte Tools

Alle Skills werden in `.agents/skills/` bereitgestellt. Native Tools lesen dieses Verzeichnis direkt. Nicht-native Tools verwenden eine Symlink-Brücke zu ihrem Legacy-Skill-Pfad. Die folgende Tabelle zeigt die 17 Tools, die im interaktiven Selektor angezeigt werden. Weitere 27 Agents werden ebenfalls unterstützt und können direkt über das `-a`-Flag in nicht-interaktiven Befehlen angesprochen werden (z. B. `skillsmgr add code-review -a amp`). Die vollständige Liste finden Sie unter [docs/supported-agents.md](docs/supported-agents.md).

| Tool | Typ | Projektpfad |
|------|-----|-------------|
| Claude Code | Symlink-Brücke | `.claude/skills -> .agents/skills` |
| Codex | Nativ | `.agents/skills` |
| Cursor | Nativ | `.agents/skills` |
| OpenClaw | Symlink-Brücke | `skills -> .agents/skills` |
| OpenCode | Nativ | `.agents/skills` |
| Antigravity | Nativ | `.agents/skills` |
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
npx skillsmgr install anthropics/skills

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
| `skillsmgr install <source>` | `i` | Skills von GitHub, lokalem Verzeichnis, Zip-Archiv oder Registry installieren |
| `skillsmgr uninstall [identifier]` | - | Skills aus `~/.skills-manager/` entfernen |
| `skillsmgr update [source]` | - | Installierte Skills aus verfolgten Quellen aktualisieren |
| `skillsmgr list` | - | Installierte Skills in `~/.skills-manager/` auflisten |
| `skillsmgr list --deployed` | - | Bereitgestellte Skills und konfigurierte Tools im aktuellen Projekt auflisten |
| `skillsmgr deploy` | - | Interaktive Bereitstellung im aktuellen Projekt |
| `skillsmgr add [name]` | - | Einen Skill zum Projekt hinzufügen (Name, `owner/repo` oder Gruppenname) |
| `skillsmgr remove [name]` | - | Einen bereitgestellten Skill aus dem Projekt entfernen (Name, `owner/repo` oder Gruppenname) |
| `skillsmgr group <subcommand>` | - | Virtuelle Skill-Gruppen verwalten |
| `skillsmgr search [query]` | - | Skills in der skillsmgr.dev-Registry suchen |
| `skillsmgr publish [dir]` | - | Einen Skill in der skillsmgr.dev-Registry veröffentlichen |
| `skillsmgr login` | - | Bei der skillsmgr.dev-Registry anmelden |
| `skillsmgr logout` | - | Von der Registry abmelden |
| `skillsmgr whoami` | - | Den aktuell angemeldeten Benutzer anzeigen |

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
| `group add <group> <identifier>` | Einen Skill, eine `owner/repo`-Quelle oder eine andere Gruppe zu einer Gruppe hinzufügen |
| `group remove <group> <identifier>` | Einen Skill, eine `owner/repo`-Quelle oder eine andere Gruppe aus einer Gruppe entfernen |
| `group rename <old> <new>` | Eine Gruppe umbenennen |

## Skills installieren

### Aus der Registry

```bash
# Installation per Paketname (Abhängigkeiten werden automatisch aufgelöst)
npx skillsmgr install code-review

# Installation einer bestimmten Version
npx skillsmgr install code-review@1.0.0

# Registry zuerst durchsuchen
npx skillsmgr search code
```

### Offizielle Anthropic-Skills

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
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
npx skillsmgr install anthropics/skills --all

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
├── registry/
├── groups.json
├── sources.json
└── auth.json
```

- `official/`: integrierte offizielle Quellen wie `anthropic`
- `community/`: Drittanbieter-Repositories
- `custom/`: lokale Skills und Skills, die explizit als custom installiert wurden
- `registry/`: Skills, die aus der skillsmgr.dev-Registry installiert wurden
- `groups.json`: Virtuelle Gruppendefinitionen, verwaltet durch `group`-Befehle
- `sources.json`: Quell-Metadaten, die von `update` verwendet werden
- `auth.json`: Authentifizierungstoken für die Registry

## Skills veröffentlichen

### skill.json

Jeder veröffentlichbare Skill benötigt eine `skill.json`-Manifestdatei:

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "Eine kurze Beschreibung des Skills",
  "main": "SKILL.md",
  "keywords": ["code", "review"],
  "author": "your-name",
  "license": "MIT",
  "dependencies": ["base-prompts", "owner/repo:helper-skill"]
}
```

**Pflichtfelder**: `name`, `version`, `description`. Alle anderen sind optional.

### Abhängigkeiten

Skills können Abhängigkeiten von anderen Skills deklarieren. Das Feld `dependencies` ist ein String-Array (ohne Versionsangaben):

```json
"dependencies": [
  "base-prompts",
  "anthropics/skills:code-review",
  "owner/repo"
]
```

Unterstützte Formate:
- **Registry-Paket**: `"base-prompts"` — wird von skillsmgr.dev installiert
- **Spezifischer GitHub-Skill**: `"owner/repo:skill-name"` — ein bestimmter Skill aus einem GitHub-Repo
- **Vollständiges GitHub-Repo**: `"owner/repo"` — alle Skills aus einem GitHub-Repo

Wenn ein Benutzer Ihren Skill installiert, werden die Abhängigkeiten automatisch aufgelöst und installiert.

### Veröffentlichungsablauf

```bash
# 1. Anmelden (nur beim ersten Mal)
npx skillsmgr login

# 2. skill.json im Skill-Verzeichnis erstellen
# 3. Veröffentlichen
npx skillsmgr publish

# 4. Überprüfen
npx skillsmgr search my-skill
```

Beim Veröffentlichen prüft skillsmgr, ob alle deklarierten Abhängigkeiten in der Registry verfügbar sind. Falls einige fehlen, werden Sie aufgefordert, diese aufzulösen.

## Danksagungen

Dieses Projekt wurde unabhängig erstellt. Viele spätere Verbesserungen wurden von [vercel-labs/skills](https://github.com/vercel-labs/skills) inspiriert.

## Lizenz

MIT
