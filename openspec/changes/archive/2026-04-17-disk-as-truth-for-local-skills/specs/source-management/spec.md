## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统 SHALL 从路径中提取 skill name (basename), 通过 `findInstalledCustomSkill(name)` 在磁盘上 `~/.skills-manager/custom/` 中按 name 查找已安装 skill, 找到后对比 SKILL.md 内容, 有变化则重新拷贝.  系统 SHALL NOT 依赖 `sources.json` 的 url 字段做匹配, 也 SHALL NOT 在 update 成功后向 `sources.json` 写入或刷新 local-copy 条目.

#### Scenario: 路径指向已安装的 skill
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统提取 skillName = "my-skill"
- **THEN** 在 `~/.skills-manager/custom/` 中调用 `findInstalledCustomSkill("my-skill")`
- **THEN** 找到后对比 source 路径和已安装路径的 SKILL.md 内容
- **THEN** 内容不同时删除已安装目录并从 source 路径重新拷贝, 输出 "↑ my-skill: updated"
- **THEN** `sources.json` 中 SHALL NOT 新增或刷新 `custom/my-skill` 条目

#### Scenario: 路径指向已安装 skill 且无变化
- **WHEN** source 路径和已安装路径的 SKILL.md 内容相同
- **THEN** 输出 "✓ my-skill: up to date"
- **THEN** `sources.json` SHALL NOT 被修改

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill` 且 "unknown-skill" 未在中央仓库中安装
- **THEN** 输出 `Skill 'unknown-skill' is not installed. Run: skillsmgr install ./unknown-skill`
- **THEN** 以非 0 退出

#### Scenario: source 路径不存在
- **WHEN** 用户执行 `skillsmgr update ./missing-dir` 且该路径不存在
- **THEN** 输出错误信息并退出

#### Scenario: 从不同目录 update 同一 skill
- **WHEN** skill "jt-release" 已安装 (磁盘 `~/.skills-manager/custom/jt-release/SKILL.md` 存在)
- **WHEN** 用户在任意 CWD 执行 `skillsmgr update /abs/path/jt-release` 或 `./skills/jt-release` 等不同路径形式
- **THEN** 系统按 skill name "jt-release" 查找, 不受 CWD 或路径形式影响, 成功执行更新
- **THEN** sources.json 不因此变化

#### Scenario: update 成功后不维护 sources.json
- **WHEN** `skillsmgr update ./my-skill` 成功完成
- **THEN** `sources.json` 中的 `sources` 字段 SHALL NOT 新增 `custom/my-skill` 条目 (即便原本无条目)
- **THEN** `sources.json` 中原有的 `custom/my-skill` legacy local-copy 条目 (若存在) 不会被此次 update 刷新为新值 (会在下次其它写操作时被自然过滤清除, 见 "sources.json 不追踪 local-copy 条目" 需求)

## ADDED Requirements

### Requirement: sources.json 不追踪 local-copy 条目

`SourcesService` SHALL 拒绝向 `sources.json.sources` 写入 `installMethod === 'local-copy'` 的新条目 (开发期断言, 抛出明确错误).

`installFromLocalDir` 的 install 路径 SHALL 移除对 `sourcesService.addSource(...)` 的调用 (对单 skill 本地安装场景).  `custom/<name>/` 磁盘目录本身就是本地 skill 已安装的权威证据.

物理 group (local-batch) 成员的 sources.json 条目仍然保留 — 因为物理 group 的 rebind 流程需要批量改写成员 url, 在单一"磁盘即真相"的语义下物理 group 是豁免对象 (由 groups.json 中的 `url` 字段承担权威角色).

#### Scenario: install 单 skill 不写 sources.json
- **WHEN** 用户执行 `skillsmgr install ./my-skill` (源路径根含 SKILL.md)
- **THEN** 安装完成后, `~/.skills-manager/sources.json` 的 `sources` 字段 SHALL NOT 包含 `custom/my-skill` 条目

#### Scenario: update 单 skill 不写 sources.json
- **WHEN** 用户执行 `skillsmgr update ./my-skill` 成功
- **THEN** `sources.json` SHALL NOT 因此次 update 新增 `custom/my-skill` 条目

#### Scenario: SourcesService 拒绝写入 local-copy 条目
- **WHEN** 代码直接调用 `sourcesService.addSource('custom/abc', { installMethod: 'local-copy', ... })`
- **THEN** SHALL 抛出错误 `Refusing to persist local-copy source: custom/abc. Local skills are tracked by disk presence under custom/.`

#### Scenario: 物理 group 成员的 sources 条目不受影响
- **WHEN** 物理 group `tdd-spec` 被安装或 rebind, 成员 `custom/tdd-spec/ts-apply` 等条目按现有流程写入/更新 sources.json
- **THEN** 本 requirement 不阻止物理 group 成员的 sources 追踪 (它们由 group 生命周期管理, 与单 skill local-copy 语义不同)

### Requirement: sources.json 读路径过滤 legacy local-copy 条目

`SourcesService.load` 在读取磁盘上的 `sources.json` 后, SHALL 在内存数据中过滤掉所有满足下列条件的条目:

- key 形如 `custom/<name>` (两段, 非物理 group 成员的三段 `custom/<group>/<name>`)
- `installMethod === 'local-copy'`

过滤 SHALL 只影响内存视图, 不改动磁盘文件.  下次因其他原因 (例如 addSource/removeSource/timestamp 更新某个 git source) 触发的 `save()` 将写回过滤后的数据, 完成自然清理.

过滤 SHALL 静默执行, 不打印 warning, 不写 migration.log.

#### Scenario: load 过滤 legacy local-copy 条目
- **GIVEN** `sources.json` 含 `custom/jt-share`: `{ url: "/old/path", installMethod: "local-copy", ... }` 和 `community/obra/superpowers`: `{ installMethod: "git", ... }`
- **WHEN** `SourcesService.load()` 被调用
- **THEN** 返回的内存数据中 `sources` 只含 `community/obra/superpowers`, 不含 `custom/jt-share`
- **THEN** 磁盘 `sources.json` 文件内容保持不变 (不立即重写)

#### Scenario: 物理 group 成员的 custom 条目保留
- **GIVEN** `sources.json` 含 `custom/tdd-spec/ts-apply`: `{ installMethod: "local-copy", ... }` (key 三段, 属于物理 group `tdd-spec` 的成员)
- **WHEN** `SourcesService.load()` 被调用
- **THEN** `custom/tdd-spec/ts-apply` SHALL 保留在内存数据中, 不被过滤

#### Scenario: 下次写入自然清理
- **GIVEN** 同 "load 过滤 legacy local-copy 条目" 的前置条件
- **WHEN** 用户执行某条 git source 的 update, 触发 `sourcesService.updateTimestamp('community/obra/superpowers')`
- **THEN** 写回后的磁盘 `sources.json` SHALL NOT 再包含 `custom/jt-share` 条目

### Requirement: 全量更新不再遍历 local-copy source

裸 `skillsmgr update` (无参数) SHALL 只遍历 `sources.json.sources` 中 `installMethod` 为 `git` 或 `registry` 的条目.  不再对 `installMethod === 'local-copy'` 的条目执行路径对比更新.

由于 "sources.json 不追踪 local-copy 条目" 需求已经从 sources.json 移除了单 skill local-copy, 本需求是其自然推论; 额外列出以明确表达 "裸 update 对本地 skill 整体跳过, 不在 sources 遍历阶段尝试更新"的语义.

物理 group 成员的 `custom/<group>/<name>` 条目仍由 group-level update 路径处理 (通过 `skillsmgr update <group-name>` 或顶层 update 命中 group target), 不受本需求影响.

#### Scenario: 裸 update 只跑 git/registry
- **GIVEN** `sources.json` 含 1 个 git source 和 5 个物理 group 成员 (三段 key)
- **WHEN** 用户执行 `skillsmgr update`
- **THEN** git source 走其 update 路径
- **THEN** 物理 group 成员不被单独遍历 (它们的更新通过 `skillsmgr update <group-name>` 触发)
- **THEN** 不尝试更新任何磁盘上的单 skill local-copy (见 "裸 update 跳过 local-copy skill" 需求)

## REMOVED Requirements

### Requirement: 全量更新包含 local-copy source
**Reason**: 本次变更移除了 sources.json 对 local-copy 的追踪, 全量 update 自然不再遍历 local-copy 条目.  用户更新本地 skill 的路径统一为 `skillsmgr update ./path`.
**Migration**: 用户原本依赖 `skillsmgr update` 更新所有本地 skill 的场景, 现需改为对每个本地 skill 显式执行 `skillsmgr update ./path`.  release notes 中明确说明此 BREAKING 变化.

### Requirement: 按名称更新 local-copy source
**Reason**: 按 source key 名称更新 local-copy (如 `skillsmgr update my-skill`) 的路径在"磁盘为真"模型下不再适用 — 没有记忆的 url, 系统无法定位原始源目录.  用户更新单 skill 本地 skill 必须通过显式路径 `./my-skill`.
**Migration**: 改用 `skillsmgr update ./my-skill` (从 skill 所在目录的父目录执行, 或提供任何合法相对/绝对路径).  bareword 形式保留对 git source 和物理 group 的支持.
