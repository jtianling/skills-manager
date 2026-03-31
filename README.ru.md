# skillsmgr

Единый менеджер навыков для инструментов AI-программирования. Устанавливает навыки в `~/.skills-manager/`, затем развёртывает их в проекты через единый каталог `.agents/skills/`. Поддерживает 44 инструмента в одном рабочем процессе.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Español](./README.es.md)

## Основные возможности

- **Центральный репозиторий, развёртывание куда угодно** — Навыки устанавливаются один раз в `~/.skills-manager/`. После этого команда `add` позволяет интерактивно выбирать из всех локально установленных навыков и развёртывать их в любой проект или глобально — без необходимости каждый раз вспоминать URL или путь к исходному репозиторию.
- **Пользовательские группы для пакетного управления** — Организуйте собственные навыки в именованные группы (например, `--group my-tools`). Развёртывайте целую группу в проект одной командой `add --group`, что упрощает поддержку и распространение персональных коллекций навыков.
- **Поддержка zip-архивов** — Устанавливайте навыки напрямую из `.zip`-файлов или пакетов `.skill` от Anthropic, что упрощает упаковку и обмен наборами навыков за пределами GitHub.

## Требования

- Node.js `>=18`

## Поддерживаемые инструменты

Все навыки развёртываются в `.agents/skills/`. Нативные инструменты читают этот каталог напрямую. Ненативные инструменты используют мост через символические ссылки к их прежнему пути навыков. В таблице ниже перечислены 16 инструментов, отображаемых в интерактивном селекторе. Дополнительно поддерживаются ещё 28 агентов, которые можно указать напрямую через флаг `-a` в неинтерактивных командах (например, `skillsmgr add code-review -a amp`). Полный список см. в [docs/supported-agents.md](docs/supported-agents.md).

| Инструмент | Тип | Путь в проекте |
|------------|-----|----------------|
| Claude Code | Мост через симлинк | `.claude/skills -> .agents/skills` |
| Codex | Нативный | `.agents/skills` |
| Cursor | Нативный | `.agents/skills` |
| OpenClaw | Мост через симлинк | `skills -> .agents/skills` |
| OpenCode | Нативный | `.agents/skills` |
| Gemini CLI | Нативный | `.agents/skills` |
| GitHub Copilot | Нативный | `.agents/skills` |
| Cline | Нативный | `.agents/skills` |
| Kilo Code | Мост через симлинк | `.kilocode/skills -> .agents/skills` |
| Roo Code | Мост через симлинк | `.roo/skills -> .agents/skills` |
| Kiro CLI | Мост через симлинк | `.kiro/skills -> .agents/skills` |
| Trae | Мост через симлинк | `.trae/skills -> .agents/skills` |
| Trae CN | Мост через симлинк | `.trae/skills -> .agents/skills` |
| CodeBuddy | Мост через симлинк | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Мост через симлинк | `.windsurf/skills -> .agents/skills` |
| Goose | Мост через симлинк | `.goose/skills -> .agents/skills` |

## Быстрый старт

```bash
# 1. Установка навыков из официального репозитория Anthropic
npx skillsmgr install anthropic

# 2. Развёртывание навыков в текущий проект
cd your-project
npx skillsmgr deploy

# 3. Просмотр развёрнутых навыков
npx skillsmgr list --deployed
```

## Модель развёртывания

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

- Нативные инструменты читают `.agents/skills/` напрямую.
- Ненативные инструменты настраиваются путём создания моста через символические ссылки при выполнении `deploy` или `add`.
- По умолчанию навыки развёртываются через символические ссылки; используйте `--copy`, если хотите локальные копии в проекте.
- Используйте `-g` для глобального развёртывания в пользовательские каталоги агентов (например, `~/.claude/skills`).

## Команды

| Команда | Псевдоним | Описание |
|---------|-----------|----------|
| `skillsmgr install <source>` | `i` | Установка навыков из GitHub, локального каталога или zip-архива |
| `skillsmgr uninstall [identifier]` | - | Удаление навыков из `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Обновление установленных навыков из отслеживаемых источников |
| `skillsmgr list` | - | Список установленных навыков в `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Список развёрнутых навыков и настроенных инструментов в текущем проекте |
| `skillsmgr deploy` | - | Интерактивное развёртывание в текущий проект |
| `skillsmgr add [name]` | - | Добавление навыка в проект |
| `skillsmgr remove [name]` | - | Удаление развёрнутого навыка из проекта |
| `skillsmgr group <subcommand>` | - | Управление виртуальными группами навыков |

### Флаги команд

**install**

| Флаг | Описание |
|------|----------|
| `--all` | Установить все обнаруженные навыки без запроса подтверждения |
| `--custom` | Установить в `custom/` вместо `community/` |
| `-f, --force` | Перезаписать существующий навык без подтверждения |
| `--group <name>` | Добавить установленные навыки в виртуальную группу |
| `-s, --skill <name>` | Выбрать конкретные навыки (повторяемый) |

**add**

| Флаг | Описание |
|------|----------|
| `--all` | Добавить все навыки без запроса подтверждения |
| `--copy` | Копировать файлы вместо создания символических ссылок |
| `-a, --agent <name>` | Целевой агент (повторяемый) |
| `-s, --skill <name>` | Выбрать конкретные навыки (повторяемый) |
| `-g, --global` | Глобальное развёртывание в пользовательские каталоги агентов |
| `--group <name>` | Пакетное развёртывание всех навыков из группы |
| `-y, --yes` | Пропустить все подтверждения (эквивалент --all) |
| `--same-agents` | Использовать текущие настроенные агенты |

**remove**

| Флаг | Описание |
|------|----------|
| `--all` | Удалить все совпадающие навыки без запроса подтверждения |
| `-s, --skill <name>` | Конкретный навык для удаления (повторяемый) |
| `-a, --agent <name>` | Целевой агент (повторяемый) |
| `-g, --global` | Удалить из глобальных каталогов агентов |
| `--group <name>` | Пакетное удаление развёрнутых навыков из группы |
| `-y, --yes` | Пропустить все подтверждения (эквивалент --all) |

**deploy**

| Флаг | Описание |
|------|----------|
| `--copy` | Копировать файлы вместо создания символических ссылок |
| `-g, --global` | Глобальное развёртывание навыков в пользовательские каталоги агентов |

**uninstall**

| Флаг | Описание |
|------|----------|
| `--all` | Пропустить выбор и удалить все совпадающие навыки |
| `-f, --force` | Пропустить запрос подтверждения |
| `-y, --yes` | Пропустить все подтверждения (эквивалент --all --force) |
| `-s, --skill <name>` | Конкретный навык для удаления (повторяемый) |

**group**

| Подкоманда | Описание |
|------------|----------|
| `group list [name]` | Список всех групп или детали группы |
| `group create <name>` | Создать новую пустую группу |
| `group delete <name>` | Удалить группу (навыки не затрагиваются) |
| `group add <group> <skill>` | Добавить навык в группу |
| `group remove <group> <skill>` | Удалить навык из группы |
| `group rename <old> <new>` | Переименовать группу |

## Установка навыков

### Официальные навыки Anthropic

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### Репозиторий GitHub

```bash
# сокращённая форма owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# полный URL GitHub
npx skillsmgr install https://github.com/user/skills-repo

# путь к конкретному навыку
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Локальный каталог или zip-архив

```bash
# установка из локального каталога (должен начинаться с ./ или /)
npx skillsmgr install ./my-skill

# установка из zip-файла или пакета .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# установка в пользовательскую группу
npx skillsmgr install ./my-skill --group my-tools
```

### Полезные параметры установки

```bash
# установить все обнаруженные навыки без запроса подтверждения
npx skillsmgr install anthropic --all

# установить только конкретные навыки по имени
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# считать установленный источник пользовательским вместо сообщества
npx skillsmgr install https://github.com/user/repo --custom
```

Установщик поддерживает следующие структуры репозиториев:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` в корне репозитория

## Развёртывание навыков

### Интерактивное развёртывание

```bash
# развёртывание в текущий проект (интерактивный выбор агентов и навыков)
npx skillsmgr deploy

# глобальное развёртывание в пользовательские каталоги агентов
npx skillsmgr deploy -g
```

### Неинтерактивное развёртывание

```bash
# добавить конкретный навык для конкретного агента
npx skillsmgr add code-review -a claude-code

# добавить несколько навыков для нескольких агентов
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# глобальное развёртывание
npx skillsmgr add code-review -g -a claude-code

# удалить навык
npx skillsmgr remove code-review

# удалить из глобального развёртывания
npx skillsmgr remove code-review -g -a claude-code
```

## Интерактивное использование

`install`, `deploy`, `add`, `remove` и `uninstall` используют интерактивный селектор со следующими клавишами:

| Клавиша | Действие |
|---------|----------|
| `j` / `k` или клавиши со стрелками | Перемещение курсора |
| `gg` / `G` | Перейти к началу или концу |
| `h` / `l` | Свернуть / развернуть текущую группу |
| `c` | Свернуть/развернуть все группы |
| `/` | Режим поиска (для больших списков) |
| `space` | Переключить выделение |
| `ctrl+a` | Переключить все видимые элементы |
| `enter` | Подтвердить |
| `q` или `ctrl+c` | Отмена |

## Структура каталогов

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

- `official/`: встроенные официальные источники, такие как `anthropic`
- `community/`: сторонние репозитории
- `custom/`: локальные навыки и навыки, явно установленные как пользовательские
- `groups.json`: определения виртуальных групп, управляемые командами `group`
- `sources.json`: метаданные источников, используемые командой `update`

## Благодарности

Этот проект создан независимо. Многие последующие улучшения были вдохновлены [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Лицензия

MIT
