## ADDED Requirements

### Requirement: 按 group 卸载 — 顶层路由

`skillsmgr uninstall <input>` 经 `SourceResolver` 解析后, 若 `ResolvedTarget.kind === 'group'`, SHALL 按 group 类型分发:

- `groupKind === 'local-batch'` → 走物理 group 卸载算法 (见 `group-as-first-class-unit` capability 的 "物理 group 卸载以物理目录扫描为权威" 需求)
- `groupKind === 'virtual'` → 报错提示用 `group delete`, 不卸载 skill

`<input>` 可为 bareword (group 名), `custom/<name>`, 本地路径任一形态, 经 resolver 后行为一致.

#### Scenario: 顶层 uninstall 命中物理 group (bareword)
- **GIVEN** 物理 group `tdd-spec` 存在
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** 走物理 group 卸载算法
- **THEN** 不再报 `Skill 'tdd-spec' not found`

#### Scenario: 顶层 uninstall 命中物理 group (custom 前缀)
- **GIVEN** 物理 group `tdd-spec` 存在
- **WHEN** 用户执行 `skillsmgr uninstall custom/tdd-spec`
- **THEN** SourceResolver 在 `custom/<name>` 路径下识别为物理 group, 走卸载算法
- **THEN** 不再报 `No installed source found for custom/tdd-spec`

#### Scenario: 顶层 uninstall 命中物理 group (本地路径)
- **GIVEN** 物理 group `tdd-spec`, url `/dev/tdd-spec`
- **WHEN** 用户执行 `skillsmgr uninstall ./tdd-spec` (或 `/dev/tdd-spec`)
- **THEN** 走物理 group 卸载算法 (替代旧的 bundle remove 路径)

#### Scenario: 顶层 uninstall 命中逻辑 group 给提示
- **GIVEN** 逻辑 group `python` 存在
- **WHEN** 用户执行 `skillsmgr uninstall python`
- **THEN** 系统 SHALL 报错 `'python' is a virtual group; use 'group delete python' to remove it (skills are not affected)`
- **AND** 不修改任何 skill 或 sources.json

## REMOVED Requirements

### Requirement: custom skill 卸载

**Reason**: 旧需求把 "直接 `custom/<name>/`" 和 "group 目录下的 skill" 混为一体处理, 只看物理目录是否存在, 没有考虑 group 单元概念.  新模型下:
- 物理 group `<name>` (custom/<name>/ 是 group 目录) 由 group uninstall 路径处理 (见 `group-as-first-class-unit` capability 的 "物理 group 卸载以物理目录扫描为权威" 需求)
- 直接的 `custom/<single-skill>` (没有子目录, custom/<single-skill>/SKILL.md) 仍由 `按 skill 名称卸载` 需求处理

**Migration**: 用户如果之前依赖 `uninstall <skill-name>` 删除 group 目录下的某个子 skill (如 `uninstall helper-skill` 删 `custom/utils/helper-skill/`), 行为不变 — `按 skill 名称卸载` 仍能精确定位单个 skill 并删除.  如果用户希望卸载整个 group, 用 `uninstall <group-name>` 或 `group uninstall <name>`.

## MODIFIED Requirements

### Requirement: sources.json 清理

系统 SHALL 在删除 skills 后检查并清理 `sources.json` 中的无效记录.  对物理 group 卸载路径, 清理范围 SHALL 覆盖 `affectedKeys` (物理目录扫描 ∪ sources.json 中以 `custom/<name>/` 开头的 key) 全部, 不依赖 bundle.members 快照.

#### Scenario: source 下所有 skills 已删除
- **WHEN** 删除 skill 后, 该 source 目录下不再有任何 skill
- **THEN** 系统从 `sources.json` 中移除该 source 的记录

#### Scenario: source 下仍有其他 skills
- **WHEN** 删除 skill 后, 该 source 目录下仍有其他 skills
- **THEN** 系统保留 `sources.json` 中该 source 的记录

#### Scenario: 物理 group 卸载清理范围以 affectedKeys 为准
- **GIVEN** 物理 group `tdd-spec`, 物理目录有 `ts-newname/SKILL.md`, sources.json 含 `custom/tdd-spec/tdd-old1` (物理已不存在), 但旧 bundle.members 仅包含 `tdd-old1`
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** affectedKeys = `{ custom/tdd-spec/ts-newname, custom/tdd-spec/tdd-old1 }`
- **THEN** sources.json 中两条全部清除, 不再因为依赖快照而漏掉 `ts-newname`
