# skillsmgr

AIコーディングツールのための統合スキルマネージャーです. スキルを `~/.skills-manager/` にインストールし, 単一の `.agents/skills/` ディレクトリを通じてプロジェクトにデプロイします.  44のツールを1つのワークフローでサポートします.

[English](./README.md) | [العربية](./README.ar.md) | [中文](./README.zh-CN.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [한국어](./README.ko.md) | [Português](./README.pt-BR.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## 特徴

- **中央リポジトリからどこにでもデプロイ** — スキルは `~/.skills-manager/` に一度だけインストールされます. その後, `add` を使ってインストール済みの全スキルからインタラクティブに選択し, 任意のプロジェクトまたはグローバルにデプロイできます. 毎回元のリポジトリURLやパスを覚えておく必要はありません.
- **カスタムグループによる一括管理** — スキルを名前付きグループ (例: `--group my-tools`) にまとめることができます. `skillsmgr add group-name` でグループ全体をデプロイできます. 複数の方法でグループを構成: `group add my-group skill-name` で個別のスキルを追加, `group add my-group owner/repo` でリポジトリ全体のスキルを追加, `group add my-group another-group` でグループのネストが可能です.
- **Zipアーカイブ対応** — `.zip` ファイルや Anthropic の `.skill` パッケージから直接スキルをインストールできます. GitHub以外でのスキルバンドルのパッケージングと共有が簡単になります.

## 要件

- Node.js `>=18`

## サポートされているツール

すべてのスキルは `.agents/skills/` にデプロイされます. ネイティブツールはそのディレクトリを直接読み取ります. 非ネイティブツールはレガシーのスキルパスへのシンボリックリンクブリッジを使用します. 以下の表はインタラクティブセレクターに表示される17のツールの一覧です. さらに27のエージェントもサポートされており, 非インタラクティブコマンドで `-a` フラグを使って直接指定できます (例: `skillsmgr add code-review -a amp`). 完全なリストは [docs/supported-agents.md](docs/supported-agents.md) を参照してください.

| ツール | タイプ | プロジェクトパス |
|--------|--------|------------------|
| Claude Code | シンボリックリンクブリッジ | `.claude/skills -> .agents/skills` |
| Codex | ネイティブ | `.agents/skills` |
| Cursor | ネイティブ | `.agents/skills` |
| OpenClaw | シンボリックリンクブリッジ | `skills -> .agents/skills` |
| OpenCode | ネイティブ | `.agents/skills` |
| Antigravity | ネイティブ | `.agents/skills` |
| Gemini CLI | ネイティブ | `.agents/skills` |
| GitHub Copilot | ネイティブ | `.agents/skills` |
| Cline | ネイティブ | `.agents/skills` |
| Kilo Code | シンボリックリンクブリッジ | `.kilocode/skills -> .agents/skills` |
| Roo Code | シンボリックリンクブリッジ | `.roo/skills -> .agents/skills` |
| Kiro CLI | シンボリックリンクブリッジ | `.kiro/skills -> .agents/skills` |
| Trae | シンボリックリンクブリッジ | `.trae/skills -> .agents/skills` |
| Trae CN | シンボリックリンクブリッジ | `.trae/skills -> .agents/skills` |
| CodeBuddy | シンボリックリンクブリッジ | `.codebuddy/skills -> .agents/skills` |
| Windsurf | シンボリックリンクブリッジ | `.windsurf/skills -> .agents/skills` |
| Goose | シンボリックリンクブリッジ | `.goose/skills -> .agents/skills` |

## クイックスタート

```bash
# 1. 公式 Anthropic リポジトリからスキルをインストール
npx skillsmgr install anthropics/skills

# 2. 現在のプロジェクトにスキルをデプロイ
cd your-project
npx skillsmgr deploy

# 3. デプロイ済みスキルを確認
npx skillsmgr list --deployed
```

## デプロイモデル

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

- ネイティブツールは `.agents/skills/` を直接読み取ります.
- 非ネイティブツールは `deploy` または `add` の実行時にシンボリックリンクブリッジを作成して設定されます.
- スキルのデプロイはデフォルトでシンボリックリンクを使用します. プロジェクトローカルのコピーが必要な場合は `--copy` を使用してください.
- `-g` を使用すると, エージェントのユーザーレベルディレクトリ (例: `~/.claude/skills`) にグローバルにデプロイできます.

## コマンド

| コマンド | エイリアス | 説明 |
|----------|------------|------|
| `skillsmgr install <source>` | `i` | GitHub, ローカルディレクトリ, またはzipアーカイブからスキルをインストール |
| `skillsmgr uninstall [identifier]` | - | `~/.skills-manager/` からスキルを削除 |
| `skillsmgr update [source]` | - | 追跡されているソースからインストール済みスキルを更新 |
| `skillsmgr list` | - | `~/.skills-manager/` のインストール済みスキルを一覧表示 |
| `skillsmgr list --deployed` | - | 現在のプロジェクトのデプロイ済みスキルと設定済みツールを一覧表示 |
| `skillsmgr deploy` | - | 現在のプロジェクトへのインタラクティブデプロイ |
| `skillsmgr add [name]` | - | プロジェクトにスキルを追加 (名前, `owner/repo`, またはグループ名) |
| `skillsmgr remove [name]` | - | プロジェクトからデプロイ済みスキルを削除 (名前, `owner/repo`, またはグループ名) |
| `skillsmgr group <subcommand>` | - | 仮想スキルグループを管理 |

### コマンドフラグ

**install**

| フラグ | 説明 |
|--------|------|
| `--all` | プロンプトなしで検出された全スキルをインストール |
| `--custom` | `community/` ではなく `custom/` にインストール |
| `-f, --force` | 確認なしで既存のスキルを上書き |
| `--group <name>` | インストールしたスキルを仮想グループに追加 |
| `-s, --skill <name>` | 特定のスキルを選択 (繰り返し指定可能) |

**add**

| フラグ | 説明 |
|--------|------|
| `--all` | プロンプトなしで全スキルを追加 |
| `--copy` | シンボリックリンクの代わりにファイルをコピー |
| `-a, --agent <name>` | 対象エージェント (繰り返し指定可能) |
| `-s, --skill <name>` | 特定のスキルを選択 (繰り返し指定可能) |
| `-g, --global` | エージェントのユーザーレベルディレクトリにグローバルデプロイ |
| `--group <name>` | グループの全スキルを一括デプロイ |
| `-y, --yes` | 全プロンプトをスキップ (--allと同等) |
| `--same-agents` | 現在設定されているエージェントを使用 |

**remove**

| フラグ | 説明 |
|--------|------|
| `--all` | プロンプトなしで一致する全スキルを削除 |
| `-s, --skill <name>` | 削除する特定のスキル (繰り返し指定可能) |
| `-a, --agent <name>` | 対象エージェント (繰り返し指定可能) |
| `-g, --global` | グローバルのエージェントディレクトリから削除 |
| `--group <name>` | グループのデプロイ済みスキルを一括削除 |
| `-y, --yes` | 全プロンプトをスキップ (--allと同等) |

**deploy**

| フラグ | 説明 |
|--------|------|
| `--copy` | シンボリックリンクの代わりにファイルをコピー |
| `-g, --global` | エージェントのユーザーレベルディレクトリにグローバルデプロイ |

**uninstall**

| フラグ | 説明 |
|--------|------|
| `--all` | 選択プロンプトをスキップし一致する全スキルをアンインストール |
| `-f, --force` | 確認プロンプトをスキップ |
| `-y, --yes` | 全プロンプトをスキップ (--all --forceと同等) |
| `-s, --skill <name>` | アンインストールする特定のスキル (繰り返し指定可能) |

**group**

| サブコマンド | 説明 |
|--------------|------|
| `group list [name]` | 全グループの一覧表示またはグループの詳細表示 |
| `group create <name>` | 新しい空のグループを作成 |
| `group delete <name>` | グループを削除 (スキルには影響しない) |
| `group add <group> <identifier>` | グループにスキル, `owner/repo` ソース, または別のグループを追加 |
| `group remove <group> <identifier>` | グループからスキル, `owner/repo` ソース, または別のグループを削除 |
| `group rename <old> <new>` | グループの名前を変更 |

## スキルのインストール

### 公式 Anthropic スキル

```bash
npx skillsmgr install anthropics/skills
npx skillsmgr install anthropics/skills --all
```

### GitHub リポジトリ

```bash
# owner/repo の省略形
npx skillsmgr install Fission-AI/OpenSpec

# 完全な GitHub URL
npx skillsmgr install https://github.com/user/skills-repo

# 特定のスキルパス
npx skillsmgr install https://github.com/anthropics/skills/tree/main/skills/code-review
```

### ローカルディレクトリまたはzipアーカイブ

```bash
# ローカルディレクトリからインストール (./ または / で始める必要があります)
npx skillsmgr install ./my-skill

# zipファイルまたは .skill パッケージからインストール
npx skillsmgr install ./skills-archive.zip
npx skillsmgr install ./my-skill.skill

# カスタムグループにインストール
npx skillsmgr install ./my-skill --group my-tools
```

### 便利なインストールオプション

```bash
# プロンプトなしで検出された全スキルをインストール
npx skillsmgr install anthropics/skills --all

# 名前で特定のスキルのみインストール
npx skillsmgr install anthropics/skills -s code-review -s commit-message

# インストールしたソースをcommunityではなくcustomとして扱う
npx skillsmgr install https://github.com/user/repo --custom
```

インストーラーは以下のリポジトリレイアウトに対応しています:

- `skills/<skill>/SKILL.md`
- `src/skills/<skill>/SKILL.md`
- `skills/<group>/<skill>/SKILL.md`
- リポジトリルートの `SKILL.md`

## スキルのデプロイ

### インタラクティブデプロイ

```bash
# 現在のプロジェクトにデプロイ (エージェントとスキルをインタラクティブに選択)
npx skillsmgr deploy

# エージェントのユーザーレベルディレクトリにグローバルデプロイ
npx skillsmgr deploy -g
```

### 非インタラクティブデプロイ

```bash
# 特定のスキルを特定のエージェントに追加
npx skillsmgr add code-review -a claude-code

# 複数のスキルを複数のエージェントに追加
npx skillsmgr add anthropics/skills -s code-review -s commit-message -a claude-code

# グローバルにデプロイ
npx skillsmgr add code-review -g -a claude-code

# スキルを削除
npx skillsmgr remove code-review

# グローバルから削除
npx skillsmgr remove code-review -g -a claude-code
```

## インタラクティブ操作

`install`, `deploy`, `add`, `remove`, `uninstall` はインタラクティブセレクターを使用し, 以下のショートカットに対応しています:

| キー | アクション |
|------|------------|
| `j` / `k` または矢印キー | カーソル移動 |
| `gg` / `G` | 先頭または末尾にジャンプ |
| `h` / `l` | 現在のグループを折りたたみ / 展開 |
| `c` | 全グループの折りたたみを切り替え |
| `/` | 検索モードに入る (リストが大きい場合) |
| `space` | 選択を切り替え |
| `ctrl+a` | 表示中の全項目の選択を切り替え |
| `enter` | 確定 |
| `q` または `ctrl+c` | キャンセル |

## ディレクトリ構成

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

- `official/`: `anthropic` などの公式ビルトインソース
- `community/`: サードパーティリポジトリ
- `custom/`: ローカルスキルおよびcustomとして明示的にインストールされたスキル
- `groups.json`: `group` コマンドで管理される仮想グループ定義
- `sources.json`: `update` で使用されるソースメタデータ

## 謝辞

このプロジェクトは独自に作成されました. その後の多くの改善は [vercel-labs/skills](https://github.com/vercel-labs/skills) に触発されたものです.

## ライセンス

MIT
