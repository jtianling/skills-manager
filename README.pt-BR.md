# skillsmgr

Gerenciador unificado de skills para ferramentas de programação com IA. Instale skills em `~/.skills-manager/` e implante-as em projetos através de um único diretório `.agents/skills/`. Suporte a 44 ferramentas com um único fluxo de trabalho.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Destaques

- **Repositório central, implante em qualquer lugar** — As skills são instaladas uma única vez em `~/.skills-manager/`. Depois disso, `add` permite que você escolha interativamente entre todas as skills instaladas localmente e as implante em qualquer projeto ou globalmente — sem precisar lembrar a URL ou o caminho do repositório original toda vez.
- **Grupos personalizados para gerenciamento em lote** — Organize skills em grupos nomeados (ex.: `--group my-tools`). Implante um grupo inteiro com `skillsmgr add group-name`. Preencha grupos de múltiplas fontes: adicione skills individuais com `group add my-group skill-name`, todas as skills de um repositório com `group add my-group owner/repo`, ou aninhe grupos com `group add my-group another-group`.
- **Suporte a arquivos zip** — Instale skills diretamente de arquivos `.zip` ou pacotes `.skill` da Anthropic, o que simplifica o empacotamento e compartilhamento de conjuntos de skills fora do GitHub.

## Requisitos

- Node.js `>=18`

## Ferramentas Suportadas

Todas as skills são implantadas em `.agents/skills/`. Ferramentas nativas leem esse diretório diretamente. Ferramentas não nativas usam uma ponte de symlink para seu caminho legado de skills. A tabela abaixo lista as 17 ferramentas exibidas no seletor interativo. Outras 27 agentes também são suportados e podem ser direcionados diretamente via flag `-a` em comandos não interativos (ex.: `skillsmgr add code-review -a amp`). Consulte [docs/supported-agents.md](docs/supported-agents.md) para a lista completa.

| Ferramenta | Tipo | Caminho no Projeto |
|------------|------|-------------------|
| Claude Code | Ponte de symlink | `.claude/skills -> .agents/skills` |
| Codex | Nativo | `.agents/skills` |
| Cursor | Nativo | `.agents/skills` |
| OpenClaw | Ponte de symlink | `skills -> .agents/skills` |
| OpenCode | Nativo | `.agents/skills` |
| Antigravity | Nativo | `.agents/skills` |
| Gemini CLI | Nativo | `.agents/skills` |
| GitHub Copilot | Nativo | `.agents/skills` |
| Cline | Nativo | `.agents/skills` |
| Kilo Code | Ponte de symlink | `.kilocode/skills -> .agents/skills` |
| Roo Code | Ponte de symlink | `.roo/skills -> .agents/skills` |
| Kiro CLI | Ponte de symlink | `.kiro/skills -> .agents/skills` |
| Trae | Ponte de symlink | `.trae/skills -> .agents/skills` |
| Trae CN | Ponte de symlink | `.trae/skills -> .agents/skills` |
| CodeBuddy | Ponte de symlink | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Ponte de symlink | `.windsurf/skills -> .agents/skills` |
| Goose | Ponte de symlink | `.goose/skills -> .agents/skills` |

## Início Rápido

```bash
# 1. Instalar skills do repositório oficial da Anthropic
npx skillsmgr install anthropics/skills

# 2. Implantar skills no projeto atual
cd your-project
npx skillsmgr deploy

# 3. Inspecionar skills implantadas
npx skillsmgr list --deployed
```

## Modelo de Implantação

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

- Ferramentas nativas leem `.agents/skills/` diretamente.
- Ferramentas não nativas são configuradas criando uma ponte de symlink durante `deploy` ou `add`.
- A implantação de skills usa symlinks por padrão; use `--copy` se preferir cópias locais no projeto.
- Use `-g` para implantar globalmente nos diretórios de nível de usuário dos agentes (ex.: `~/.claude/skills`).

## Comandos

| Comando | Alias | Descrição |
|---------|-------|-----------|
| `skillsmgr install <source>` | `i` | Instalar skills do GitHub, diretório local ou arquivo zip |
| `skillsmgr uninstall [identifier]` | - | Remover skills de `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Atualizar skills instaladas a partir das fontes rastreadas |
| `skillsmgr list` | - | Listar skills instaladas em `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Listar skills implantadas e ferramentas configuradas no projeto atual |
| `skillsmgr deploy` | - | Implantação interativa no projeto atual |
| `skillsmgr add [name]` | - | Adicionar uma skill ao projeto (nome, `owner/repo` ou nome do grupo) |
| `skillsmgr remove [name]` | - | Remover uma skill implantada do projeto (nome, `owner/repo` ou nome do grupo) |
| `skillsmgr group <subcommand>` | - | Gerenciar grupos virtuais de skills |

### Flags dos Comandos

**install**

| Flag | Descrição |
|------|-----------|
| `--all` | Instalar todas as skills descobertas sem solicitar confirmação |
| `--custom` | Instalar em `custom/` em vez de `community/` |
| `-f, --force` | Sobrescrever skill existente sem confirmação |
| `--group <name>` | Adicionar skills instaladas a um grupo virtual |
| `-s, --skill <name>` | Selecionar skills específicas (repetível) |

**add**

| Flag | Descrição |
|------|-----------|
| `--all` | Adicionar todas as skills sem solicitar confirmação |
| `--copy` | Copiar arquivos em vez de criar symlinks |
| `-a, --agent <name>` | Agente alvo (repetível) |
| `-s, --skill <name>` | Selecionar skills específicas (repetível) |
| `-g, --global` | Implantar globalmente nos diretórios de nível de usuário dos agentes |
| `--group <name>` | Implantar em lote todas as skills de um grupo |
| `-y, --yes` | Pular todas as confirmações (equivalente a --all) |
| `--same-agents` | Usar os agentes atualmente configurados |

**remove**

| Flag | Descrição |
|------|-----------|
| `--all` | Remover todas as skills correspondentes sem solicitar confirmação |
| `-s, --skill <name>` | Skill específica para remover (repetível) |
| `-a, --agent <name>` | Agente alvo (repetível) |
| `-g, --global` | Remover dos diretórios globais dos agentes |
| `--group <name>` | Remover em lote as skills implantadas de um grupo |
| `-y, --yes` | Pular todas as confirmações (equivalente a --all) |

**deploy**

| Flag | Descrição |
|------|-----------|
| `--copy` | Copiar arquivos em vez de criar symlinks |
| `-g, --global` | Implantar skills globalmente nos diretórios de nível de usuário dos agentes |

**uninstall**

| Flag | Descrição |
|------|-----------|
| `--all` | Pular seleção e desinstalar todas as skills correspondentes |
| `-f, --force` | Pular confirmação |
| `-y, --yes` | Pular todas as confirmações (equivalente a --all --force) |
| `-s, --skill <name>` | Skill específica para desinstalar (repetível) |

**group**

| Subcomando | Descrição |
|------------|-----------|
| `group list [name]` | Listar todos os grupos ou mostrar detalhes de um grupo |
| `group create <name>` | Criar um novo grupo vazio |
| `group delete <name>` | Excluir um grupo (as skills não são afetadas) |
| `group add <group> <identifier>` | Adicionar uma skill, fonte `owner/repo` ou outro grupo a um grupo |
| `group remove <group> <identifier>` | Remover uma skill, fonte `owner/repo` ou outro grupo de um grupo |
| `group rename <old> <new>` | Renomear um grupo |

## Instalando Skills

### Skills oficiais da Anthropic

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
```

### Repositório GitHub

```bash
# atalho owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# URL completa do GitHub
npx skillsmgr install https://github.com/user/skills-repo

# caminho específico de uma skill
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Diretório local ou arquivo zip

```bash
# instalar de um diretório local (deve começar com ./ ou /)
npx skillsmgr install ./my-skill

# instalar de um arquivo zip ou pacote .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# instalar em um grupo personalizado
npx skillsmgr install ./my-skill --group my-tools
```

### Opções úteis de instalação

```bash
# instalar todas as skills descobertas sem solicitar confirmação
npx skillsmgr install anthropics/skills --all

# instalar apenas skills específicas pelo nome
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# tratar a fonte instalada como custom em vez de community
npx skillsmgr install https://github.com/user/repo --custom
```

O instalador lida com os seguintes layouts de repositório:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` na raiz do repositório

## Implantando Skills

### Implantação interativa

```bash
# implantar no projeto atual (seleção interativa de agentes e skills)
npx skillsmgr deploy

# implantar globalmente nos diretórios de nível de usuário dos agentes
npx skillsmgr deploy -g
```

### Implantação não interativa

```bash
# adicionar uma skill específica a um agente específico
npx skillsmgr add code-review -a claude-code

# adicionar múltiplas skills a múltiplos agentes
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# implantar globalmente
npx skillsmgr add code-review -g -a claude-code

# remover uma skill
npx skillsmgr remove code-review

# remover do global
npx skillsmgr remove code-review -g -a claude-code
```

## Uso Interativo

`install`, `deploy`, `add`, `remove` e `uninstall` usam um seletor interativo com os seguintes atalhos:

| Tecla | Ação |
|-------|------|
| `j` / `k` ou teclas de seta | Mover cursor |
| `gg` / `G` | Ir para o topo ou final |
| `h` / `l` | Recolher / expandir grupo atual |
| `c` | Alternar todos os grupos recolhidos |
| `/` | Entrar no modo de busca (em listas grandes) |
| `space` | Alternar seleção |
| `ctrl+a` | Alternar todos os itens visíveis |
| `enter` | Confirmar |
| `q` ou `ctrl+c` | Cancelar |

## Estrutura de Diretórios

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

- `official/`: fontes oficiais integradas, como `anthropic`
- `community/`: repositórios de terceiros
- `custom/`: skills locais e skills instaladas explicitamente como custom
- `groups.json`: definições de grupos virtuais gerenciados pelos comandos `group`
- `sources.json`: metadados de fontes usados pelo `update`

## Agradecimentos

Este projeto foi criado de forma independente. Muitas melhorias posteriores foram inspiradas por [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Licença

MIT
