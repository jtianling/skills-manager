# skillsmgr

Gestionnaire de skills unifie pour les outils de codage IA.  Installez les skills dans `~/.skills-manager/`, puis deployez-les dans vos projets via un seul repertoire `.agents/skills/`.  Prend en charge 44 outils avec un seul workflow.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Points forts

- **Depot central, deploiement partout** — Les skills sont installes une seule fois dans `~/.skills-manager/`.  Ensuite, `add` vous permet de choisir de maniere interactive parmi tous les skills installes localement et de les deployer dans n'importe quel projet ou globalement — sans avoir a retenir l'URL ou le chemin du depot d'origine a chaque fois.
- **Groupes personnalises pour la gestion par lots** — Organisez vos propres skills en groupes nommes (par ex., `--group my-tools`).  Deployez un groupe entier dans un projet avec une seule commande `add --group`, ce qui facilite la maintenance et le partage de collections de skills personnelles.
- **Prise en charge des archives zip** — Installez des skills directement a partir de fichiers `.zip` ou de paquets `.skill` d'Anthropic, ce qui simplifie l'empaquetage et le partage de lots de skills en dehors de GitHub.

## Prerequis

- Node.js `>=18`

## Outils pris en charge

Tous les skills sont deployes dans `.agents/skills/`.  Les outils natifs lisent ce repertoire directement.  Les outils non natifs utilisent un pont de liens symboliques vers leur ancien chemin de skills.  Le tableau ci-dessous liste les 16 outils affiches dans le selecteur interactif.  28 agents supplementaires sont egalement pris en charge et peuvent etre cibles directement via le flag `-a` dans les commandes non interactives (par ex., `skillsmgr add code-review -a amp`).  Voir [docs/supported-agents.md](docs/supported-agents.md) pour la liste complete.

| Outil | Type | Chemin projet |
|-------|------|---------------|
| Claude Code | Pont de liens symboliques | `.claude/skills -> .agents/skills` |
| Codex | Natif | `.agents/skills` |
| Cursor | Natif | `.agents/skills` |
| OpenClaw | Pont de liens symboliques | `skills -> .agents/skills` |
| OpenCode | Natif | `.agents/skills` |
| Gemini CLI | Natif | `.agents/skills` |
| GitHub Copilot | Natif | `.agents/skills` |
| Cline | Natif | `.agents/skills` |
| Kilo Code | Pont de liens symboliques | `.kilocode/skills -> .agents/skills` |
| Roo Code | Pont de liens symboliques | `.roo/skills -> .agents/skills` |
| Kiro CLI | Pont de liens symboliques | `.kiro/skills -> .agents/skills` |
| Trae | Pont de liens symboliques | `.trae/skills -> .agents/skills` |
| Trae CN | Pont de liens symboliques | `.trae/skills -> .agents/skills` |
| CodeBuddy | Pont de liens symboliques | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Pont de liens symboliques | `.windsurf/skills -> .agents/skills` |
| Goose | Pont de liens symboliques | `.goose/skills -> .agents/skills` |

## Demarrage rapide

```bash
# 1. Initialiser ~/.skills-manager/
npx skillsmgr setup

# 2. Installer les skills depuis le depot officiel Anthropic
npx skillsmgr install anthropic

# 3. Deployer les skills dans le projet courant
cd your-project
npx skillsmgr init

# 4. Inspecter les skills deployes
npx skillsmgr list --deployed
```

## Modele de deploiement

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

- Les outils natifs lisent `.agents/skills/` directement.
- Les outils non natifs sont configures en creant un pont de liens symboliques lors de `init` ou `add`.
- Le deploiement des skills utilise par defaut des liens symboliques ; utilisez `--copy` si vous souhaitez des copies locales au projet.
- Utilisez `-g` pour deployer globalement dans les repertoires utilisateur des agents (par ex., `~/.claude/skills`).

## Commandes

| Commande | Alias | Description |
|----------|-------|-------------|
| `skillsmgr setup` | - | Initialiser `~/.skills-manager/` et creer `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | Installer des skills depuis GitHub, un repertoire local ou une archive zip |
| `skillsmgr uninstall [identifier]` | - | Supprimer des skills de `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Mettre a jour les skills installes depuis les sources suivies |
| `skillsmgr list` | - | Lister les skills installes dans `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Lister les skills deployes et les outils configures dans le projet courant |
| `skillsmgr init` | - | Deploiement interactif dans le projet courant |
| `skillsmgr add [name]` | - | Ajouter un skill au projet |
| `skillsmgr remove [name]` | - | Supprimer un skill deploye du projet |

### Flags des commandes

**install**

| Flag | Description |
|------|-------------|
| `--all` | Installer tous les skills decouverts sans confirmation |
| `--custom` | Installer dans `custom/` au lieu de `community/` |
| `-f, --force` | Ecraser un skill existant sans confirmation |
| `--group <name>` | Grouper les skills sous `custom/<name>/` |
| `-s, --skill <name>` | Selectionner des skills specifiques (repetable) |

**add**

| Flag | Description |
|------|-------------|
| `--copy` | Copier les fichiers au lieu de creer des liens symboliques |
| `-a, --agent <name>` | Agent cible (repetable) |
| `-s, --skill <name>` | Selectionner des skills specifiques (repetable) |
| `-g, --global` | Deployer globalement dans les repertoires utilisateur des agents |
| `--group <name>` | Deployer par lots tous les skills d'un groupe personnalise |
| `--same-agents` | Utiliser les agents actuellement configures |

**remove**

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Skill specifique a supprimer (repetable) |
| `-a, --agent <name>` | Agent cible (repetable) |
| `-g, --global` | Supprimer des repertoires globaux des agents |

**init**

| Flag | Description |
|------|-------------|
| `--copy` | Copier les fichiers au lieu de creer des liens symboliques |
| `-g, --global` | Deployer les skills globalement dans les repertoires utilisateur des agents |

**uninstall**

| Flag | Description |
|------|-------------|
| `-f, --force` | Ignorer la confirmation |
| `-s, --skill <name>` | Skill specifique a desinstaller (repetable) |

## Installation des skills

### Skills officiels Anthropic

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### Depot GitHub

```bash
# raccourci owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# URL GitHub complete
npx skillsmgr install https://github.com/user/skills-repo

# chemin vers un skill specifique
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Repertoire local ou archive zip

```bash
# installer depuis un repertoire local (doit commencer par ./ ou /)
npx skillsmgr install ./my-skill

# installer depuis un fichier zip ou un paquet .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# installer dans un groupe personnalise
npx skillsmgr install ./my-skill --group my-tools
```

### Options d'installation utiles

```bash
# installer tous les skills decouverts sans confirmation
npx skillsmgr install anthropic --all

# installer uniquement des skills specifiques par nom
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# traiter la source installee comme personnalisee au lieu de communautaire
npx skillsmgr install https://github.com/user/repo --custom
```

L'installateur gere les structures de depot suivantes :

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` a la racine du depot

## Deploiement des skills

### Deploiement interactif

```bash
# deployer dans le projet courant (selection interactive des agents et des skills)
npx skillsmgr init

# deployer globalement dans les repertoires utilisateur des agents
npx skillsmgr init -g
```

### Deploiement non interactif

```bash
# ajouter un skill specifique a un agent specifique
npx skillsmgr add code-review -a claude-code

# ajouter plusieurs skills a plusieurs agents
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# deployer globalement
npx skillsmgr add code-review -g -a claude-code

# supprimer un skill
npx skillsmgr remove code-review

# supprimer du global
npx skillsmgr remove code-review -g -a claude-code
```

## Utilisation interactive

`install`, `init`, `add` et `uninstall` utilisent un selecteur interactif avec les raccourcis suivants :

| Touche | Action |
|--------|--------|
| `j` / `k` ou touches flechees | Deplacer le curseur |
| `gg` / `G` | Aller en haut ou en bas |
| `h` / `l` | Replier / deplier le groupe courant |
| `c` | Basculer tous les groupes replies |
| `/` | Entrer en mode recherche (sur les grandes listes) |
| `space` | Basculer la selection |
| `ctrl+a` | Basculer tous les elements visibles |
| `enter` | Confirmer |
| `q` ou `ctrl+c` | Annuler |

## Structure des repertoires

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

- `official/` : sources officielles integrees telles que `anthropic`
- `community/` : depots tiers
- `custom/` : skills locaux, skills groupes et skills explicitement installes comme personnalises
- `sources.json` : metadonnees des sources utilisees par `update`

## Remerciements

Ce projet a ete cree de maniere independante.  De nombreuses ameliorations ulterieures ont ete inspirees par [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Licence

MIT
