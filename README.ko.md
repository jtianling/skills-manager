# skillsmgr

AI 코딩 도구를 위한 통합 스킬 매니저입니다. 스킬을 `~/.skills-manager/`에 설치한 후, 단일 `.agents/skills/` 디렉토리를 통해 프로젝트에 배포합니다. 하나의 워크플로우로 44개 도구를 지원합니다.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [日本語](./README.ja.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## 주요 특징

- **중앙 저장소, 어디서나 배포** — 스킬은 `~/.skills-manager/`에 한 번만 설치됩니다. 이후 `add` 명령으로 로컬에 설치된 모든 스킬을 대화형으로 선택하여 프로젝트 또는 전역에 배포할 수 있습니다. 매번 원본 저장소 URL이나 경로를 기억할 필요가 없습니다.
- **사용자 정의 그룹으로 일괄 관리** — 스킬을 명명된 그룹으로 구성합니다(예: `--group my-tools`). `skillsmgr add group-name`으로 전체 그룹을 배포할 수 있습니다. 다양한 방법으로 그룹을 구성: `group add my-group skill-name`으로 개별 스킬 추가, `group add my-group owner/repo`로 저장소 전체 스킬 추가, `group add my-group another-group`으로 그룹 중첩이 가능합니다.
- **Zip 아카이브 지원** — `.zip` 파일이나 Anthropic의 `.skill` 패키지에서 직접 스킬을 설치할 수 있어, GitHub 외부에서도 스킬 번들을 패키징하고 공유하기 간편합니다.

## 요구 사항

- Node.js `>=18`

## 지원 도구

모든 스킬은 `.agents/skills/`에 배포됩니다. 네이티브 도구는 해당 디렉토리를 직접 읽습니다. 비네이티브 도구는 레거시 스킬 경로에 대한 심볼릭 링크 브리지를 사용합니다. 아래 표는 대화형 선택기에 표시되는 17개 도구 목록입니다. 추가로 27개의 에이전트도 지원되며, 비대화형 명령에서 `-a` 플래그를 통해 직접 지정할 수 있습니다(예: `skillsmgr add code-review -a amp`). 전체 목록은 [docs/supported-agents.md](docs/supported-agents.md)를 참조하세요.

| 도구 | 유형 | 프로젝트 경로 |
|------|------|---------------|
| Claude Code | 심볼릭 링크 브리지 | `.claude/skills -> .agents/skills` |
| Codex | 네이티브 | `.agents/skills` |
| Cursor | 네이티브 | `.agents/skills` |
| OpenClaw | 심볼릭 링크 브리지 | `skills -> .agents/skills` |
| OpenCode | 네이티브 | `.agents/skills` |
| Antigravity | 네이티브 | `.agents/skills` |
| Gemini CLI | 네이티브 | `.agents/skills` |
| GitHub Copilot | 네이티브 | `.agents/skills` |
| Cline | 네이티브 | `.agents/skills` |
| Kilo Code | 심볼릭 링크 브리지 | `.kilocode/skills -> .agents/skills` |
| Roo Code | 심볼릭 링크 브리지 | `.roo/skills -> .agents/skills` |
| Kiro CLI | 심볼릭 링크 브리지 | `.kiro/skills -> .agents/skills` |
| Trae | 심볼릭 링크 브리지 | `.trae/skills -> .agents/skills` |
| Trae CN | 심볼릭 링크 브리지 | `.trae/skills -> .agents/skills` |
| CodeBuddy | 심볼릭 링크 브리지 | `.codebuddy/skills -> .agents/skills` |
| Windsurf | 심볼릭 링크 브리지 | `.windsurf/skills -> .agents/skills` |
| Goose | 심볼릭 링크 브리지 | `.goose/skills -> .agents/skills` |

## 빠른 시작

```bash
# 1. Anthropic 공식 저장소에서 스킬 설치
npx skillsmgr install anthropics/skills

# 2. 현재 프로젝트에 스킬 배포
cd your-project
npx skillsmgr deploy

# 3. 배포된 스킬 확인
npx skillsmgr list --deployed
```

## 배포 모델

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

- 네이티브 도구는 `.agents/skills/`를 직접 읽습니다.
- 비네이티브 도구는 `deploy` 또는 `add` 실행 시 심볼릭 링크 브리지를 생성하여 설정됩니다.
- 스킬 배포는 기본적으로 심볼릭 링크를 사용합니다. 프로젝트 로컬 복사본이 필요하면 `--copy`를 사용하세요.
- `-g`를 사용하면 에이전트 사용자 수준 디렉토리(예: `~/.claude/skills`)에 전역으로 배포합니다.

## 명령어

| 명령어 | 별칭 | 설명 |
|--------|------|------|
| `skillsmgr install <source>` | `i` | GitHub, 로컬 디렉토리 또는 zip 아카이브에서 스킬 설치 |
| `skillsmgr uninstall [identifier]` | - | `~/.skills-manager/`에서 스킬 제거 |
| `skillsmgr update [source]` | - | 추적된 소스에서 설치된 스킬 업데이트 |
| `skillsmgr list` | - | `~/.skills-manager/`에 설치된 스킬 목록 조회 |
| `skillsmgr list --deployed` | - | 현재 프로젝트의 배포된 스킬 및 설정된 도구 목록 조회 |
| `skillsmgr deploy` | - | 현재 프로젝트에 대화형 배포 |
| `skillsmgr add [name]` | - | 프로젝트에 스킬 추가 (이름, `owner/repo` 또는 그룹 이름) |
| `skillsmgr remove [name]` | - | 프로젝트에서 배포된 스킬 제거 (이름, `owner/repo` 또는 그룹 이름) |
| `skillsmgr group <subcommand>` | - | 가상 스킬 그룹 관리 |

### 명령어 플래그

**install**

| 플래그 | 설명 |
|--------|------|
| `--all` | 프롬프트 없이 발견된 모든 스킬 설치 |
| `--custom` | `community/` 대신 `custom/`에 설치 |
| `-f, --force` | 확인 없이 기존 스킬 덮어쓰기 |
| `--group <name>` | 설치된 스킬을 가상 그룹에 추가 |
| `-s, --skill <name>` | 특정 스킬 선택 (반복 가능) |

**add**

| 플래그 | 설명 |
|--------|------|
| `--all` | 프롬프트 없이 모든 스킬 추가 |
| `--copy` | 심볼릭 링크 대신 파일 복사 |
| `-a, --agent <name>` | 대상 에이전트 (반복 가능) |
| `-s, --skill <name>` | 특정 스킬 선택 (반복 가능) |
| `-g, --global` | 에이전트 사용자 수준 디렉토리에 전역 배포 |
| `--group <name>` | 그룹의 모든 스킬 일괄 배포 |
| `-y, --yes` | 모든 프롬프트 건너뛰기 (--all과 동일) |
| `--same-agents` | 현재 설정된 에이전트 사용 |

**remove**

| 플래그 | 설명 |
|--------|------|
| `--all` | 프롬프트 없이 일치하는 모든 스킬 제거 |
| `-s, --skill <name>` | 제거할 특정 스킬 (반복 가능) |
| `-a, --agent <name>` | 대상 에이전트 (반복 가능) |
| `-g, --global` | 전역 에이전트 디렉토리에서 제거 |
| `--group <name>` | 그룹의 배포된 스킬 일괄 제거 |
| `-y, --yes` | 모든 프롬프트 건너뛰기 (--all과 동일) |

**deploy**

| 플래그 | 설명 |
|--------|------|
| `--copy` | 심볼릭 링크 대신 파일 복사 |
| `-g, --global` | 에이전트 사용자 수준 디렉토리에 전역으로 스킬 배포 |

**uninstall**

| 플래그 | 설명 |
|--------|------|
| `--all` | 선택 프롬프트 건너뛰고 일치하는 모든 스킬 제거 |
| `-f, --force` | 확인 프롬프트 건너뛰기 |
| `-y, --yes` | 모든 프롬프트 건너뛰기 (--all --force와 동일) |
| `-s, --skill <name>` | 제거할 특정 스킬 (반복 가능) |

**group**

| 하위 명령어 | 설명 |
|-------------|------|
| `group list [name]` | 모든 그룹 목록 조회 또는 그룹 상세 조회 |
| `group create <name>` | 새 빈 그룹 생성 |
| `group delete <name>` | 그룹 삭제 (스킬에는 영향 없음) |
| `group add <group> <identifier>` | 그룹에 스킬, `owner/repo` 소스 또는 다른 그룹 추가 |
| `group remove <group> <identifier>` | 그룹에서 스킬, `owner/repo` 소스 또는 다른 그룹 제거 |
| `group rename <old> <new>` | 그룹 이름 변경 |

## 스킬 설치

### Anthropic 공식 스킬

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
```

### GitHub 저장소

```bash
# owner/repo 축약형
npx skillsmgr install Fission-AI/OpenSpec

# 전체 GitHub URL
npx skillsmgr install https://github.com/user/skills-repo

# 특정 스킬 경로
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### 로컬 디렉토리 또는 zip 아카이브

```bash
# 로컬 디렉토리에서 설치 (./ 또는 /로 시작해야 함)
npx skillsmgr install ./my-skill

# zip 파일 또는 .skill 패키지에서 설치
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# 사용자 정의 그룹에 설치
npx skillsmgr install ./my-skill --group my-tools
```

### 유용한 설치 옵션

```bash
# 프롬프트 없이 발견된 모든 스킬 설치
npx skillsmgr install anthropics/skills --all

# 이름으로 특정 스킬만 설치
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# 설치된 소스를 community 대신 custom으로 처리
npx skillsmgr install https://github.com/user/repo --custom
```

설치 프로그램은 다음 저장소 레이아웃을 처리합니다:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- 저장소 루트의 `SKILL.md`

## 스킬 배포

### 대화형 배포

```bash
# 현재 프로젝트에 배포 (대화형 에이전트 및 스킬 선택)
npx skillsmgr deploy

# 에이전트 사용자 수준 디렉토리에 전역 배포
npx skillsmgr deploy -g
```

### 비대화형 배포

```bash
# 특정 에이전트에 특정 스킬 추가
npx skillsmgr add code-review -a claude-code

# 여러 에이전트에 여러 스킬 추가
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# 전역 배포
npx skillsmgr add code-review -g -a claude-code

# 스킬 제거
npx skillsmgr remove code-review

# 전역에서 제거
npx skillsmgr remove code-review -g -a claude-code
```

## 대화형 사용법

`install`, `deploy`, `add`, `remove`, `uninstall`은 다음 단축키를 사용하는 대화형 선택기를 제공합니다:

| 키 | 동작 |
|----|------|
| `j` / `k` 또는 방향키 | 커서 이동 |
| `gg` / `G` | 맨 위 또는 맨 아래로 이동 |
| `h` / `l` | 현재 그룹 접기 / 펼치기 |
| `c` | 모든 그룹 접기 전환 |
| `/` | 검색 모드 진입 (큰 목록에서) |
| `space` | 선택 전환 |
| `ctrl+a` | 표시된 모든 항목 전환 |
| `enter` | 확인 |
| `q` 또는 `ctrl+c` | 취소 |

## 디렉토리 구조

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

- `official/`: `anthropic` 등 내장 공식 소스
- `community/`: 서드파티 저장소
- `custom/`: 로컬 스킬 및 custom으로 명시적으로 설치된 스킬
- `groups.json`: `group` 명령으로 관리되는 가상 그룹 정의
- `sources.json`: `update`에서 사용하는 소스 메타데이터

## 감사의 글

이 프로젝트는 독립적으로 만들어졌습니다. 이후 많은 개선 사항은 [vercel-labs/skills](https://github.com/vercel-labs/skills)에서 영감을 받았습니다.

## 라이선스

MIT
