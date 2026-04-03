# skillsmgr

Gestor unificado de skills para herramientas de codificación con IA. Instala skills en `~/.skills-manager/` y luego despliégalos en proyectos a través de un único directorio `.agents/skills/`. Compatible con 44 herramientas en un solo flujo de trabajo.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md)

## Características destacadas

- **Repositorio central, despliegue en cualquier lugar** — Los skills se instalan una sola vez en `~/.skills-manager/`. Después, `add` permite seleccionar interactivamente entre todos los skills instalados localmente y desplegarlos en cualquier proyecto o globalmente, sin necesidad de recordar la URL o ruta del repositorio original cada vez.
- **Integración con el registro** — Busca, instala y publica skills a través del registro [skillsmgr.dev](https://skillsmgr.dev). `skillsmgr install code-review` descarga desde el registro. `skillsmgr publish` comparte tus skills con la comunidad.
- **Resolución automática de dependencias** — Los skills pueden declarar dependencias de otros skills. Al instalar un skill, sus dependencias se resuelven e instalan automáticamente de forma recursiva.
- **Grupos personalizados para gestión por lotes** — Organiza skills en grupos con nombre (por ejemplo, `--group my-tools`). Despliega un grupo entero con `skillsmgr add group-name`. Rellena grupos desde múltiples fuentes: añade skills individuales con `group add my-group skill-name`, todos los skills de un repositorio con `group add my-group owner/repo`, o anida grupos con `group add my-group another-group`.
- **Soporte para archivos zip** — Instala skills directamente desde archivos `.zip` o paquetes `.skill` de Anthropic, lo que simplifica empaquetar y compartir conjuntos de skills fuera de GitHub.

## Requisitos

- Node.js `>=18`

## Herramientas compatibles

Todos los skills se despliegan en `.agents/skills/`. Las herramientas nativas leen ese directorio directamente. Las herramientas no nativas utilizan un puente de enlace simbólico hacia su ruta de skills heredada. La tabla siguiente muestra las 17 herramientas disponibles en el selector interactivo. Otras 27 herramientas adicionales también son compatibles y pueden seleccionarse directamente mediante el flag `-a` en comandos no interactivos (por ejemplo, `skillsmgr add code-review -a amp`). Consulta [docs/supported-agents.md](docs/supported-agents.md) para la lista completa.

| Herramienta | Tipo | Ruta del proyecto |
|-------------|------|-------------------|
| Claude Code | Puente de enlace simbólico | `.claude/skills -> .agents/skills` |
| Codex | Nativo | `.agents/skills` |
| Cursor | Nativo | `.agents/skills` |
| OpenClaw | Puente de enlace simbólico | `skills -> .agents/skills` |
| OpenCode | Nativo | `.agents/skills` |
| Antigravity | Nativo | `.agents/skills` |
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
# 1. Instalar skills del repositorio oficial de Anthropic
npx skillsmgr install anthropics/skills

# 2. Desplegar skills en el proyecto actual
cd your-project
npx skillsmgr deploy

# 3. Inspeccionar los skills desplegados
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
- Las herramientas no nativas se configuran creando un puente de enlace simbólico durante `deploy` o `add`.
- El despliegue de skills usa enlaces simbólicos por defecto; usa `--copy` si prefieres copias locales en el proyecto.
- Usa `-g` para desplegar globalmente en los directorios de usuario de los agentes (por ejemplo, `~/.claude/skills`).

## Comandos

| Comando | Alias | Descripción |
|---------|-------|-------------|
| `skillsmgr install <source>` | `i` | Instalar skills desde GitHub, directorio local, archivo zip o el registro |
| `skillsmgr uninstall [identifier]` | - | Eliminar skills de `~/.skills-manager/` |
| `skillsmgr update [source]` | - | Actualizar skills instalados desde las fuentes registradas |
| `skillsmgr list` | - | Listar skills instalados en `~/.skills-manager/` |
| `skillsmgr list --deployed` | - | Listar skills desplegados y herramientas configuradas en el proyecto actual |
| `skillsmgr deploy` | - | Despliegue interactivo en el proyecto actual |
| `skillsmgr add [name]` | - | Añadir un skill al proyecto (nombre, `owner/repo` o nombre de grupo) |
| `skillsmgr remove [name]` | - | Eliminar un skill desplegado del proyecto (nombre, `owner/repo` o nombre de grupo) |
| `skillsmgr group <subcommand>` | - | Gestionar grupos virtuales de skills |
| `skillsmgr search [query]` | - | Buscar skills en el registro skillsmgr.dev |
| `skillsmgr publish [dir]` | - | Publicar un skill en el registro skillsmgr.dev |
| `skillsmgr login` | - | Iniciar sesión en el registro skillsmgr.dev |
| `skillsmgr logout` | - | Cerrar sesión en el registro |
| `skillsmgr whoami` | - | Mostrar el usuario actualmente conectado |

### Flags de comandos

**install**

| Flag | Descripción |
|------|-------------|
| `--all` | Instalar todos los skills descubiertos sin solicitar confirmación |
| `--custom` | Instalar en `custom/` en lugar de `community/` |
| `-f, --force` | Sobrescribir skill existente sin confirmación |
| `--group <name>` | Añadir los skills instalados a un grupo virtual |
| `-s, --skill <name>` | Seleccionar skills específicos (repetible) |

**add**

| Flag | Descripción |
|------|-------------|
| `--all` | Añadir todos los skills sin solicitar confirmación |
| `--copy` | Copiar archivos en lugar de crear enlaces simbólicos |
| `-a, --agent <name>` | Agente destino (repetible) |
| `-s, --skill <name>` | Seleccionar skills específicos (repetible) |
| `-g, --global` | Desplegar globalmente en los directorios de usuario de los agentes |
| `--group <name>` | Desplegar por lotes todos los skills de un grupo |
| `-y, --yes` | Omitir todas las solicitudes (equivalente a --all) |
| `--same-agents` | Usar los agentes configurados actualmente |

**remove**

| Flag | Descripción |
|------|-------------|
| `--all` | Eliminar todos los skills coincidentes sin solicitar confirmación |
| `-s, --skill <name>` | Skill específico a eliminar (repetible) |
| `-a, --agent <name>` | Agente destino (repetible) |
| `-g, --global` | Eliminar de los directorios globales de los agentes |
| `--group <name>` | Eliminar por lotes los skills desplegados de un grupo |
| `-y, --yes` | Omitir todas las solicitudes (equivalente a --all) |

**deploy**

| Flag | Descripción |
|------|-------------|
| `--copy` | Copiar archivos en lugar de crear enlaces simbólicos |
| `-g, --global` | Desplegar skills globalmente en los directorios de usuario de los agentes |

**uninstall**

| Flag | Descripción |
|------|-------------|
| `--all` | Omitir la selección y desinstalar todos los skills coincidentes |
| `-f, --force` | Omitir solicitud de confirmación |
| `-y, --yes` | Omitir todas las solicitudes (equivalente a --all --force) |
| `-s, --skill <name>` | Skill específico a desinstalar (repetible) |

**group**

| Subcomando | Descripción |
|------------|-------------|
| `group list [name]` | Listar todos los grupos o mostrar detalles de un grupo |
| `group create <name>` | Crear un nuevo grupo vacío |
| `group delete <name>` | Eliminar un grupo (los skills no se ven afectados) |
| `group add <group> <identifier>` | Añadir un skill, fuente `owner/repo` u otro grupo a un grupo |
| `group remove <group> <identifier>` | Eliminar un skill, fuente `owner/repo` u otro grupo de un grupo |
| `group rename <old> <new>` | Renombrar un grupo |

## Instalación de skills

### Desde el registro

```bash
# instalar por nombre de paquete (las dependencias se resuelven automáticamente)
npx skillsmgr install code-review

# instalar una versión específica
npx skillsmgr install code-review@1.0.0

# buscar en el registro primero
npx skillsmgr search code
```

### Skills oficiales de Anthropic

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
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
npx skillsmgr install anthropics/skills --all

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
npx skillsmgr deploy

# desplegar globalmente en los directorios de usuario de los agentes
npx skillsmgr deploy -g
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

`install`, `deploy`, `add`, `remove` y `uninstall` utilizan un selector interactivo con estos atajos:

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
│   └── example-skill/SKILL.md
├── registry/
├── groups.json
├── sources.json
└── auth.json
```

- `official/`: fuentes oficiales integradas como `anthropic`
- `community/`: repositorios de terceros
- `custom/`: skills locales y skills instalados explícitamente como personalizados
- `registry/`: skills instalados desde el registro skillsmgr.dev
- `groups.json`: definiciones de grupos virtuales gestionados por los comandos `group`
- `sources.json`: metadatos de fuentes utilizados por `update`
- `auth.json`: token de autenticación del registro

## Publicación de skills

### skill.json

Todo skill publicable necesita un manifiesto `skill.json`:

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "Una breve descripción de lo que hace el skill",
  "main": "SKILL.md",
  "keywords": ["code", "review"],
  "author": "your-name",
  "license": "MIT",
  "dependencies": ["base-prompts", "owner/repo:helper-skill"]
}
```

**Campos obligatorios**: `name`, `version`, `description`. El resto son opcionales.

### Dependencias

Los skills pueden declarar dependencias de otros skills. El campo `dependencies` es un array de cadenas (sin restricciones de versión):

```json
"dependencies": [
  "base-prompts",
  "anthropics/skills:code-review",
  "owner/repo"
]
```

Formatos compatibles:
- **Paquete del registro**: `"base-prompts"` — se instala desde skillsmgr.dev
- **Skill específico de GitHub**: `"owner/repo:skill-name"` — un skill concreto de un repositorio de GitHub
- **Repositorio completo de GitHub**: `"owner/repo"` — todos los skills de un repositorio de GitHub

Cuando un usuario instala tu skill, las dependencias se resuelven e instalan automáticamente.

### Flujo de publicación

```bash
# 1. Iniciar sesión (solo la primera vez)
npx skillsmgr login

# 2. Crear skill.json en el directorio del skill
# 3. Publicar
npx skillsmgr publish

# 4. Verificar
npx skillsmgr search my-skill
```

Durante la publicación, skillsmgr comprueba que todas las dependencias declaradas estén disponibles en el registro. Si alguna falta, se te pedirá que la resuelvas.

## Agradecimientos

Este proyecto fue creado de forma independiente. Muchas mejoras posteriores fueron inspiradas por [vercel-labs/skills](https://github.com/vercel-labs/skills).

## Licencia

MIT
