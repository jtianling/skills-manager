# skillsmgr

Gestore unificato di skill per strumenti di programmazione AI. Installa le skill in `~/.skills-manager/`, poi distribuiscile ai progetti tramite un'unica directory `.agents/skills/`. Supporta 44 strumenti con un unico flusso di lavoro.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Punti di forza

- **Repository centrale, distribuzione ovunque** — Le skill vengono installate una sola volta in `~/.skills-manager/`. Dopodiché, `add` consente di selezionare interattivamente tra tutte le skill installate localmente e distribuirle a qualsiasi progetto o globalmente — senza dover ricordare ogni volta l'URL o il percorso del repository originale.
- **Integrazione con il registry** — Cerca, installa e pubblica skill tramite il registry [skillsmgr.dev](https://skillsmgr.dev). `skillsmgr install code-review` scarica dal registry. `skillsmgr publish` condivide le tue skill con la comunità.
- **Risoluzione automatica delle dipendenze** — Le skill possono dichiarare dipendenze da altre skill. Quando installi una skill, le sue dipendenze vengono risolte e installate automaticamente in modo ricorsivo.
- **Gruppi personalizzati per la gestione in blocco** — Organizza le skill in gruppi con nome (es. `--group my-tools`). Distribuisci un intero gruppo con `skillsmgr add group-name`. Popola i gruppi da più fonti: aggiungi skill individuali con `group add my-group skill-name`, tutte le skill di un repository con `group add my-group owner/repo`, o annida gruppi con `group add my-group another-group`.
- **Supporto archivi zip** — Installa skill direttamente da file `.zip` o pacchetti `.skill` di Anthropic, il che semplifica la creazione e la condivisione di pacchetti di skill al di fuori di GitHub.

## Requisiti

- Node.js `>=18`

## Strumenti supportati

Tutte le skill vengono distribuite in `.agents/skills/`. Gli strumenti nativi leggono quella directory direttamente. Gli strumenti non nativi utilizzano un ponte symlink verso il loro percorso legacy delle skill. La tabella seguente elenca i 17 strumenti mostrati nel selettore interattivo. Ulteriori 27 agenti sono supportati e possono essere selezionati direttamente tramite il flag `-a` nei comandi non interattivi (es. `skillsmgr add code-review -a amp`). Consulta [docs/supported-agents.md](docs/supported-agents.md) per l'elenco completo.

| Strumento | Tipo | Percorso progetto |
|-----------|------|-------------------|
| Claude Code | Ponte symlink | `.claude/skills -> .agents/skills` |
| Codex | Nativo | `.agents/skills` |
| Cursor | Nativo | `.agents/skills` |
| OpenClaw | Ponte symlink | `skills -> .agents/skills` |
| OpenCode | Nativo | `.agents/skills` |
| Antigravity | Nativo | `.agents/skills` |
| Gemini CLI | Nativo | `.agents/skills` |
| GitHub Copilot | Nativo | `.agents/skills` |
| Cline | Nativo | `.agents/skills` |
| Kilo Code | Ponte symlink | `.kilocode/skills -> .agents/skills` |
| Roo Code | Ponte symlink | `.roo/skills -> .agents/skills` |
| Kiro CLI | Ponte symlink | `.kiro/skills -> .agents/skills` |
| Trae | Ponte symlink | `.trae/skills -> .agents/skills` |
| Trae CN | Ponte symlink | `.trae/skills -> .agents/skills` |
| CodeBuddy | Ponte symlink | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Ponte symlink | `.windsurf/skills -> .agents/skills` |
| Goose | Ponte symlink | `.goose/skills -> .agents/skills` |

## Avvio rapido

```bash
# 1. Installa le skill dal repository ufficiale Anthropic
npx skillsmgr install anthropics/skills

# 2. Distribuisci le skill al progetto corrente
cd your-project
npx skillsmgr deploy

# 3. Ispeziona le skill distribuite
npx skillsmgr list --deployed
```

## Modello di distribuzione

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

- Gli strumenti nativi leggono `.agents/skills/` direttamente.
- Gli strumenti non nativi vengono configurati creando un ponte symlink durante `deploy` o `add`.
- La distribuzione delle skill usa symlink per impostazione predefinita; usa `--copy` se preferisci copie locali al progetto.
- Usa `-g` per distribuire globalmente nelle directory a livello utente degli agenti (es. `~/.claude/skills`).

## Comandi

| Comando | Alias | Descrizione |
|---------|-------|-------------|
| `skillsmgr install <source>` | `i` | Installa skill da GitHub, directory locale, archivio zip o registry |
| `skillsmgr uninstall [identifier]` | - | Rimuove skill da `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Aggiorna le skill installate dalle sorgenti tracciate |
| `skillsmgr list` | - | Elenca le skill installate in `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Elenca le skill distribuite e gli strumenti configurati nel progetto corrente |
| `skillsmgr deploy` | - | Distribuzione interattiva al progetto corrente |
| `skillsmgr add [name]` | - | Aggiunge una skill al progetto (nome, `owner/repo` o nome del gruppo) |
| `skillsmgr remove [name]` | - | Rimuove una skill distribuita dal progetto (nome, `owner/repo` o nome del gruppo) |
| `skillsmgr group <subcommand>` | - | Gestisce i gruppi virtuali di skill |
| `skillsmgr search [query]` | - | Cerca skill nel registry skillsmgr.dev |
| `skillsmgr publish [dir]` | - | Pubblica una skill nel registry skillsmgr.dev |
| `skillsmgr login` | - | Accedi al registry skillsmgr.dev |
| `skillsmgr logout` | - | Disconnettiti dal registry |
| `skillsmgr whoami` | - | Mostra l'utente attualmente connesso |

### Flag dei comandi

**install**

| Flag | Descrizione |
|------|-------------|
| `--all` | Installa tutte le skill trovate senza chiedere conferma |
| `--custom` | Installa in `custom/` invece che in `community/` |
| `-f, --force` | Sovrascrive la skill esistente senza conferma |
| `--group <name>` | Aggiunge le skill installate a un gruppo virtuale |
| `-s, --skill <name>` | Seleziona skill specifiche (ripetibile) |

**add**

| Flag | Descrizione |
|------|-------------|
| `--all` | Aggiunge tutte le skill senza chiedere conferma |
| `--copy` | Copia i file invece di creare symlink |
| `-a, --agent <name>` | Agente di destinazione (ripetibile) |
| `-s, --skill <name>` | Seleziona skill specifiche (ripetibile) |
| `-g, --global` | Distribuisce globalmente nelle directory a livello utente degli agenti |
| `--group <name>` | Distribuisce in blocco tutte le skill di un gruppo |
| `-y, --yes` | Salta tutte le richieste di conferma (equivalente a --all) |
| `--same-agents` | Usa gli agenti attualmente configurati |

**remove**

| Flag | Descrizione |
|------|-------------|
| `--all` | Rimuove tutte le skill corrispondenti senza chiedere conferma |
| `-s, --skill <name>` | Skill specifica da rimuovere (ripetibile) |
| `-a, --agent <name>` | Agente di destinazione (ripetibile) |
| `-g, --global` | Rimuove dalle directory globali degli agenti |
| `--group <name>` | Rimuove in blocco le skill distribuite di un gruppo |
| `-y, --yes` | Salta tutte le richieste di conferma (equivalente a --all) |

**deploy**

| Flag | Descrizione |
|------|-------------|
| `--copy` | Copia i file invece di creare symlink |
| `-g, --global` | Distribuisce le skill globalmente nelle directory a livello utente degli agenti |

**uninstall**

| Flag | Descrizione |
|------|-------------|
| `--all` | Salta la selezione e disinstalla tutte le skill corrispondenti |
| `-f, --force` | Salta la richiesta di conferma |
| `-y, --yes` | Salta tutte le richieste di conferma (equivalente a --all --force) |
| `-s, --skill <name>` | Skill specifica da disinstallare (ripetibile) |

**group**

| Sottocomando | Descrizione |
|--------------|-------------|
| `group list [name]` | Elenca tutti i gruppi o mostra i dettagli di un gruppo |
| `group create <name>` | Crea un nuovo gruppo vuoto |
| `group delete <name>` | Elimina un gruppo (le skill non vengono modificate) |
| `group add <group> <identifier>` | Aggiunge una skill, una fonte `owner/repo` o un altro gruppo a un gruppo |
| `group remove <group> <identifier>` | Rimuove una skill, una fonte `owner/repo` o un altro gruppo da un gruppo |
| `group rename <old> <new>` | Rinomina un gruppo |

## Installazione delle skill

### Dal registry

```bash
# installa tramite nome pacchetto (dipendenze risolte automaticamente)
npx skillsmgr install code-review

# installa una versione specifica
npx skillsmgr install code-review@1.0.0

# cerca prima nel registry
npx skillsmgr search code
```

### Skill ufficiali Anthropic

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
```

### Repository GitHub

```bash
# abbreviazione owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# URL GitHub completo
npx skillsmgr install https://github.com/user/skills-repo

# percorso specifico della skill
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Directory locale o archivio zip

```bash
# installa da una directory locale (deve iniziare con ./ o /)
npx skillsmgr install ./my-skill

# installa da un file zip o un pacchetto .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# installa in un gruppo personalizzato
npx skillsmgr install ./my-skill --group my-tools
```

### Opzioni di installazione utili

```bash
# installa tutte le skill trovate senza chiedere conferma
npx skillsmgr install anthropics/skills --all

# installa solo skill specifiche per nome
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# tratta la sorgente installata come personalizzata invece che comunitaria
npx skillsmgr install https://github.com/user/repo --custom
```

L'installer gestisce i seguenti layout di repository:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` nella radice del repository

## Distribuzione delle skill

### Distribuzione interattiva

```bash
# distribuisci al progetto corrente (selezione interattiva di agenti e skill)
npx skillsmgr deploy

# distribuisci globalmente nelle directory a livello utente degli agenti
npx skillsmgr deploy -g
```

### Distribuzione non interattiva

```bash
# aggiungi una skill specifica a un agente specifico
npx skillsmgr add code-review -a claude-code

# aggiungi più skill a più agenti
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# distribuisci globalmente
npx skillsmgr add code-review -g -a claude-code

# rimuovi una skill
npx skillsmgr remove code-review

# rimuovi dalla distribuzione globale
npx skillsmgr remove code-review -g -a claude-code
```

## Utilizzo interattivo

`install`, `deploy`, `add`, `remove` e `uninstall` utilizzano un selettore interattivo con le seguenti scorciatoie:

| Tasto | Azione |
|-------|--------|
| `j` / `k` o tasti freccia | Sposta il cursore |
| `gg` / `G` | Vai all'inizio o alla fine |
| `h` / `l` | Comprimi / espandi il gruppo corrente |
| `c` | Attiva/disattiva la compressione di tutti i gruppi |
| `/` | Entra in modalità ricerca (su elenchi grandi) |
| `space` | Attiva/disattiva la selezione |
| `ctrl+a` | Attiva/disattiva tutti gli elementi visibili |
| `enter` | Conferma |
| `q` o `ctrl+c` | Annulla |

## Struttura delle directory

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

- `official/`: sorgenti ufficiali integrate come `anthropic`
- `community/`: repository di terze parti
- `custom/`: skill locali e skill installate esplicitamente come personalizzate
- `registry/`: skill installate dal registry skillsmgr.dev
- `groups.json`: definizioni dei gruppi virtuali gestiti dai comandi `group`
- `sources.json`: metadati delle sorgenti utilizzati da `update`
- `auth.json`: token di autenticazione al registry

## Pubblicazione delle skill

### skill.json

Ogni skill pubblicabile richiede un manifest `skill.json`:

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "Una breve descrizione di ciò che fa la skill",
  "main": "SKILL.md",
  "keywords": ["code", "review"],
  "author": "your-name",
  "license": "MIT",
  "dependencies": ["base-prompts", "owner/repo:helper-skill"]
}
```

**Campi obbligatori**: `name`, `version`, `description`. Tutti gli altri sono opzionali.

### Dipendenze

Le skill possono dichiarare dipendenze da altre skill. Il campo `dependencies` è un array di stringhe (senza vincoli di versione):

```json
"dependencies": [
  "base-prompts",
  "anthropics/skills:code-review",
  "owner/repo"
]
```

Formati supportati:
- **Pacchetto del registry**: `"base-prompts"` — installato da skillsmgr.dev
- **Skill specifica da GitHub**: `"owner/repo:skill-name"` — una skill specifica da un repository GitHub
- **Repository GitHub completo**: `"owner/repo"` — tutte le skill di un repository GitHub

Quando un utente installa la tua skill, le dipendenze vengono risolte e installate automaticamente.

### Flusso di pubblicazione

```bash
# 1. Accedi (solo la prima volta)
npx skillsmgr login

# 2. Crea skill.json nella directory della tua skill
# 3. Pubblica
npx skillsmgr publish

# 4. Verifica
npx skillsmgr search my-skill
```

Durante la pubblicazione, skillsmgr verifica che tutte le dipendenze dichiarate siano disponibili nel registry. Se alcune sono mancanti, verrà chiesto di risolverle.

## Ringraziamenti

Questo progetto è stato creato in modo indipendente. Molti miglioramenti successivi sono stati ispirati da [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Licenza

MIT
