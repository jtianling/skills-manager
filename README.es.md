# skillsmgr

Gestor unificado de skills para herramientas de codificación con IA. Instala skills en `~/.skills-manager/` y luego despliégalos en proyectos a través de un único directorio `.agents/skills/`. Compatible con 44 herramientas en un solo flujo de trabajo.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md)

## Características destacadas

- **Repositorio central, despliegue en cualquier lugar** — Los skills se instalan una sola vez en `~/.skills-manager/`. Después, `add` permite seleccionar interactivamente entre todos los skills instalados localmente y desplegarlos en cualquier proyecto o globalmente, sin necesidad de recordar la URL o ruta del repositorio original cada vez.
- **Grupos personalizados para gestión por lotes** — Organiza tus propios skills en grupos con nombre (por ejemplo, `--group my-tools`). Despliega un grupo entero en un proyecto con un solo comando `add --group`, lo que facilita mantener y compartir colecciones personales de skills.
- **Soporte para archivos zip** — Instala skills directamente desde archivos `.zip` o paquetes `.skill` de Anthropic, lo que simplifica empaquetar y compartir conjuntos de skills fuera de GitHub.

## Requisitos

- Node.js `>=18`

## Herramientas compatibles

Todos los skills se despliegan en `.agents/skills/`. Las herramientas nativas leen ese directorio directamente. Las herramientas no nativas utilizan un puente de enlace simbólico hacia su ruta de skills heredada. La tabla siguiente muestra las 16 herramientas disponibles en el selector interactivo. Otras 28 herramientas adicionales también son compatibles y pueden seleccionarse directamente mediante el flag `-a` en comandos no interactivos (por ejemplo, `skillsmgr add code-review -a amp`). Consulta [docs/supported-agents.md](docs/supported-agents.md) para la lista completa.

| Herramienta | Tipo | Ruta del proyecto |
|-------------|------|-------------------|
| Claude Code | Puente de enlace simbólico | `.claude/skills -> .agents/skills` |
| Codex | Nativo | `.agents/skills` |
| Cursor | Nativo | `.agents/skills` |
| OpenClaw | Puente de enlace simbólico | `skills -> .agents/skills` |
| OpenCode | Nativo | `.agents/skills` |
| Gemini CLI | Nativo | `.agents/skills` |
| GitHub Copilot | Nativo | `.agents/skills` |
| Cline | Nativo | `.agents/skills` |
| Kilo Code | Puente de enlace simbólico | `.kilocode/skills -> .agents/skills` |
| Roo Code | Puente de enlace simbólico | `.roo/skills -> .agents/skills` |
| Kiro CLI | Puente de enlace simbólico | `.kiro/skills -> .agents/skills` |
| Trae | Puente de enlace simbólico | `.trae/skills -> .agents/skills` |
| Trae CN | Puente de enlace simbólico | `.trae/skills -> .agents/skills` |
| CodeBuddy | Puente de enlace simbólico | `.codebuddy/skills -> .agents/skills` |
| Windsurf | Puente de enlace simbólico | `.windsurf/skills -> .agents/skills` |
| Goose | Puente de enlace simbólico | `.goose/skills -> .agents/skills` |

## Inicio rápido

```bash
# 1. Inicializar ~/.skills-manager/
npx skillsmgr setup

# 2. Instalar skills del repositorio oficial de Anthropic
npx skillsmgr install anthropic

# 3. Desplegar skills en el proyecto actual
cd your-project
npx skillsmgr init

# 4. Inspeccionar los skills desplegados
npx skillsmgr list --deployed
```

## Modelo de despliegue

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

- Las herramientas nativas leen `.agents/skills/` directamente.
- Las herramientas no nativas se configuran creando un puente de enlace simbólico durante `init` o `add`.
- El despliegue de skills usa enlaces simbólicos por defecto; usa `--copy` si prefieres copias locales en el proyecto.
- Usa `-g` para desplegar globalmente en los directorios de usuario de los agentes (por ejemplo, `~/.claude/skills`).

## Comandos

| Comando | Alias | Descripción |
|---------|-------|-------------|
| `skillsmgr setup` | - | Inicializar `~/.skills-manager/` y crear `custom/example-skill/` |
| `skillsmgr install <source>` | `i` | Instalar skills desde GitHub, directorio local o archivo zip |
| `skillsmgr uninstall [identifier]` | - | Eliminar skills de `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Actualizar skills instalados desde las fuentes registradas |
| `skillsmgr list` | - | Listar skills instalados en `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Listar skills desplegados y herramientas configuradas en el proyecto actual |
| `skillsmgr init` | - | Despliegue interactivo en el proyecto actual |
| `skillsmgr add [name]` | - | Añadir un skill al proyecto |
| `skillsmgr remove [name]` | - | Eliminar un skill desplegado del proyecto |

### Flags de comandos

**install**

| Flag | Descripción |
|------|-------------|
| `--all` | Instalar todos los skills descubiertos sin solicitar confirmación |
| `--custom` | Instalar en `custom/` en lugar de `community/` |
| `-f, --force` | Sobrescribir skill existente sin confirmación |
| `--group <name>` | Agrupar skills bajo `custom/<name>/` |
| `-s, --skill <name>` | Seleccionar skills específicos (repetible) |

**add**

| Flag | Descripción |
|------|-------------|
| `--copy` | Copiar archivos en lugar de crear enlaces simbólicos |
| `-a, --agent <name>` | Agente destino (repetible) |
| `-s, --skill <name>` | Seleccionar skills específicos (repetible) |
| `-g, --global` | Desplegar globalmente en los directorios de usuario de los agentes |
| `--group <name>` | Desplegar por lotes todos los skills de un grupo personalizado |
| `--same-agents` | Usar los agentes configurados actualmente |

**remove**

| Flag | Descripción |
|------|-------------|
| `-s, --skill <name>` | Skill específico a eliminar (repetible) |
| `-a, --agent <name>` | Agente destino (repetible) |
| `-g, --global` | Eliminar de los directorios globales de los agentes |

**init**

| Flag | Descripción |
|------|-------------|
| `--copy` | Copiar archivos en lugar de crear enlaces simbólicos |
| `-g, --global` | Desplegar skills globalmente en los directorios de usuario de los agentes |

**uninstall**

| Flag | Descripción |
|------|-------------|
| `-f, --force` | Omitir solicitud de confirmación |
| `-s, --skill <name>` | Skill específico a desinstalar (repetible) |

## Instalación de skills

### Skills oficiales de Anthropic

```bash
npx skillsmgr install anthropic
npx skillsmgr install anthropic --all
```

### Repositorio de GitHub

```bash
# abreviatura owner/repo
npx skillsmgr install Fission-AI/OpenSpec

# URL completa de GitHub
npx skillsmgr install https://github.com/user/skills-repo

# ruta específica de un skill
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### Directorio local o archivo zip

```bash
# instalar desde un directorio local (debe comenzar con ./ o /)
npx skillsmgr install ./my-skill

# instalar desde un archivo zip o paquete .skill
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# instalar en un grupo personalizado
npx skillsmgr install ./my-skill --group my-tools
```

### Opciones útiles de instalación

```bash
# instalar todos los skills descubiertos sin solicitar confirmación
npx skillsmgr install anthropic --all

# instalar solo skills específicos por nombre
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# tratar la fuente instalada como personalizada en lugar de comunitaria
npx skillsmgr install https://github.com/user/repo --custom
```

El instalador maneja estas estructuras de repositorio:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- `SKILL.md` en la raíz del repositorio

## Despliegue de skills

### Despliegue interactivo

```bash
# desplegar en el proyecto actual (selección interactiva de agentes y skills)
npx skillsmgr init

# desplegar globalmente en los directorios de usuario de los agentes
npx skillsmgr init -g
```

### Despliegue no interactivo

```bash
# añadir un skill específico a un agente específico
npx skillsmgr add code-review -a claude-code

# añadir múltiples skills a múltiples agentes
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# desplegar globalmente
npx skillsmgr add code-review -g -a claude-code

# eliminar un skill
npx skillsmgr remove code-review

# eliminar del ámbito global
npx skillsmgr remove code-review -g -a claude-code
```

## Uso interactivo

`install`, `init`, `add` y `uninstall` utilizan un selector interactivo con estos atajos:

| Tecla | Acción |
|-------|--------|
| `j` / `k` o teclas de flecha | Mover cursor |
| `gg` / `G` | Ir al inicio o al final |
| `h` / `l` | Contraer / expandir grupo actual |
| `c` | Alternar todos los grupos contraídos |
| `/` | Entrar en modo búsqueda (en listas grandes) |
| `space` | Alternar selección |
| `ctrl+a` | Alternar todos los elementos visibles |
| `enter` | Confirmar |
| `q` o `ctrl+c` | Cancelar |

## Estructura de directorios

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

- `official/`: fuentes oficiales integradas como `anthropic`
- `community/`: repositorios de terceros
- `custom/`: skills locales, skills agrupados y skills instalados explícitamente como personalizados
- `sources.json`: metadatos de fuentes utilizados por `update`

## Agradecimientos

Este proyecto fue creado de forma independiente. Muchas mejoras posteriores fueron inspiradas por [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Licencia

MIT
