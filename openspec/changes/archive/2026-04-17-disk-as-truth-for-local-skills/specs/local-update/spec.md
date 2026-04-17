## MODIFIED Requirements

### Requirement: 从原始路径更新 local-copy skill
update 命令 SHALL 通过 `skillsmgr update <path>` 的显式路径参数更新 local-copy skill — 由用户在调用时提供原始路径, 系统 SHALL NOT 从 `sources.json` 读取记忆的 `url`.

解析流程:
1. 取 `basename(normalizeLocalPath(<path>))` 作为 skillName
2. 调用 `findInstalledCustomSkill(skillName)` 查已安装位置
3. 未找到 → 输出 `Skill '<skillName>' is not installed. Run: skillsmgr install <path>`, 以非 0 退出
4. 找到 → 对比 source 路径与已安装路径的 SKILL.md 内容, 有变化则重新拷贝

本需求不再依赖 `sources.json` 查找 local-copy skill 已安装位置, 也不再在成功后向 sources.json 写入/更新 `url` / `updatedAt` / `installedAt` 字段 (local-copy skill 不再被 sources.json 追踪).

#### Scenario: 原始路径有更新
- **WHEN** 用户执行 `skillsmgr update ./my-lint`, 源 SKILL.md 内容与已安装版本不同
- **THEN** 系统删除已安装目录并从 `./my-lint` 重新拷贝
- **THEN** 输出 "↑ my-lint: updated"
- **THEN** sources.json SHALL NOT 因此次 update 新增或修改任何 `installMethod: 'local-copy'` 的条目

#### Scenario: 原始路径无变化
- **WHEN** 源 SKILL.md 内容与已安装版本相同
- **THEN** 输出 "✓ my-lint: up to date"

#### Scenario: 原始路径不存在
- **WHEN** 用户执行 `skillsmgr update ./missing`, 该路径不存在
- **THEN** 系统 SHALL 报错 `Directory not found: <absPath>`, 以非 0 退出
- **THEN** 不修改任何磁盘/sources.json

#### Scenario: 原始路径中无 SKILL.md
- **WHEN** 用户执行 `skillsmgr update ./broken`, 路径存在但无 SKILL.md
- **THEN** 系统 SHALL 报错 `No SKILL.md found at <absPath>`, 以非 0 退出

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr update ./new-skill`, `findInstalledCustomSkill("new-skill")` 返回 null
- **THEN** 系统 SHALL 输出 `Skill 'new-skill' is not installed. Run: skillsmgr install ./new-skill`
- **THEN** 以非 0 退出

### Requirement: 通过本地路径参数指定更新

update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统经 `SourceResolver.resolveLocalPath` 解析后:

- 命中物理 group → 走 "物理 group update 默认源为真同步" 流程 (不变)
- 路径指向单 skill 目录 (根含 SKILL.md) → 走 "从原始路径更新 local-copy skill" 流程, 解析时以 basename 扫磁盘的 `findInstalledCustomSkill` 为准, 不依赖 sources.json 中的 local-copy url
- 路径指向非单 skill 非物理 group 的目录 → 按 "basename fallback 与 rebind" 处理物理 group rebind (仅对物理 group 保留 rebind 语义, 单 skill 不再有 rebind 概念 — 用 install 覆盖即可)
- 精确匹配失败且 basename fallback 未命中 → 报错

`resolveLocalPath` 对 single-skill 情形 SHALL 按 `findInstalledCustomSkill(basename)` 结果决定返回 kind: 'source' (已安装) 或 kind: 'not-found' (未安装), 不再查 sources.json 做 URL 匹配, 也不再为 single-skill 返回 `rebind-candidate` kind.

#### Scenario: 路径精确匹配物理 group
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 解析为绝对路径后在 `groups.json` 中找到 `kind === 'local-batch'` 且 `url` 相等的物理 group
- **THEN** 走 "物理 group update 默认源为真同步" 流程 (行为不变)

#### Scenario: 路径指向已安装单 skill (有 sources 条目亦同)
- **WHEN** 用户执行 `skillsmgr update ./my-lint`, `findInstalledCustomSkill("my-lint")` 返回非 null
- **THEN** 走 "从原始路径更新 local-copy skill" 流程
- **THEN** 无论 sources.json 里有没有对应条目, 行为一致 (都按磁盘为准)

#### Scenario: 路径指向磁盘有 skill 但 sources.json 无条目
- **WHEN** 用户 `/Users/me/workspace/skills/abc/SKILL.md` 存在, `~/.skills-manager/custom/abc/SKILL.md` 也存在, 但 sources.json 无 `custom/abc` 条目 (legacy 孤儿)
- **WHEN** 用户执行 `skillsmgr update /Users/me/workspace/skills/abc`
- **THEN** 系统 SHALL 成功找到已安装 skill 并执行 update (不再报 "not found")

#### Scenario: 路径未匹配任何 + fallback 未命中
- **WHEN** 用户执行 `skillsmgr update ./unknown`, 精确路径匹配失败, basename fallback 也未找到候选
- **THEN** 系统 SHALL 报错 `No installed skill found from path: <absPath>`

### Requirement: basename fallback 与 rebind

update 命令在 `resolveLocalPath` 精确路径匹配失败时, SHALL 按 basename 在已安装的**物理 group** 中查找候选, 并根据旧路径状态和类型匹配决定是否进入 rebind 流程.

单 skill (`installMethod === 'local-copy'`) 不再参与 basename fallback 与 rebind — 原因: local-copy skill 不再被 sources.json 追踪, 没有"旧 URL"概念, 用户对同名 skill 换路径重装的唯一正确路径是 `skillsmgr install <new-path>` (系统会提示 overwrite).

basename 匹配规则 (仅物理 group):
- 候选为 `groups.json` 中 `kind === 'local-batch'` 且 `basename(normalizeLocalPath(group.url)) === basename(absolutePath)` 的 group

找到唯一候选后 SHALL 依次检查 (不变):
1. 候选的旧 URL 是否仍 `fileExists`: 仍存在 → 不触发 rebind, 返回 not-found, 错误文案 SHALL 提示旧路径仍存在
2. 新路径结构类型是否与候选类型一致 (batch 结构: 根不含 SKILL.md 且至少一个子目录含 SKILL.md)
3. 全部通过后 SHALL prompt 用户确认 rebind, 默认选项 No; `--force` 或 `-y` SHALL 跳过 prompt
4. 用户确认后 SHALL 原子重写 `groups.json[<name>].url` 为新路径; 同时把 sources.json 中所有 `custom/<name>/*` 的 `url` 字段刷新为新路径 (物理 group 的 skill 成员仍由 sources.json 追踪, 本需求不变它们)
5. Rebind 完成后 SHALL 继续执行正常 update 流程

类型匹配规则:
- 物理 group 候选: 新路径的根目录必须**不**含 `SKILL.md` 且必须有至少一个含 `SKILL.md` 的子目录

多候选处理不变: basename 匹配返回 > 1 个候选时 SHALL 报错列出所有候选.

#### Scenario: 物理 group 搬家后 rebind 成功
- **GIVEN** 物理 group `tdd-spec`, `groups.json` 中 `url = /old/path/tdd-spec`
- **AND** `/old/path/tdd-spec` 已不存在
- **AND** `/new/path/tdd-spec/` 存在, 无根 SKILL.md, 但有 `ts-apply/SKILL.md` 等子目录
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`, 精确匹配失败
- **THEN** 系统进入 basename fallback, 找到唯一候选物理 group
- **AND** prompt 用户确认 rebind
- **WHEN** 用户确认
- **THEN** 系统原子更新 `groups.json[tdd-spec].url` 为新路径, sources.json 中 `custom/tdd-spec/*` 的 `url` 也同步更新
- **AND** 系统继续执行物理 group update 同步

#### Scenario: 单 skill 换路径不再走 rebind
- **GIVEN** `custom/my-lint/SKILL.md` 存在 (磁盘有该 skill)
- **WHEN** 用户执行 `skillsmgr update /new/path/my-lint`, 该新路径也存在且含 SKILL.md
- **THEN** `resolveLocalPath` 通过 `findInstalledCustomSkill("my-lint")` 直接返回 kind: 'source'
- **THEN** 走 "从原始路径更新 local-copy skill" 流程, 从 `/new/path/my-lint` 复制覆盖
- **AND** 系统 SHALL NOT prompt "rebind" (不再适用)

#### Scenario: 用户拒绝 rebind (物理 group)
- **GIVEN** 物理 group 场景同 "物理 group 搬家后 rebind 成功"
- **WHEN** prompt rebind 时用户拒绝
- **THEN** 系统 SHALL 输出 `Cancelled.` 并以退出码 0 结束

#### Scenario: --force 跳过 rebind prompt (物理 group)
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec --force`
- **THEN** 系统 SHALL 跳过 rebind prompt 直接 rebind 并继续 update

#### Scenario: 旧路径仍存在时不触发 rebind (物理 group)
- **GIVEN** 物理 group `tdd-spec`, 旧路径仍存在, 用户在其它路径创建了同名目录结构
- **WHEN** 用户执行 `skillsmgr update /other/path/tdd-spec`
- **THEN** 系统精确匹配失败, basename fallback 找到候选, 但旧路径仍存在, 不触发 rebind
- **THEN** 系统 SHALL 报错说明旧路径仍存在

#### Scenario: 类型不匹配拒绝 rebind (物理 group)
- **GIVEN** 物理 group `tdd-spec`, 旧路径已不存在
- **AND** `/new/path/tdd-spec/SKILL.md` 存在 (新路径是单 skill 结构)
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统 SHALL 报错 `Path type mismatch: existing local-batch group 'tdd-spec' is a batch, but <abs> looks like a single skill.`

#### Scenario: basename 多候选报错列出
- **GIVEN** `groups.json` 脏数据: 两个物理 group basename 都等于 `tdd-spec` 且旧路径都不存在
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统 SHALL 报错列出所有候选, 提示手动清理

#### Scenario: bareword update 不走 basename fallback
- **WHEN** 用户执行 `skillsmgr update tdd-spec`
- **THEN** 按 bareword 解析: 优先匹配 group 名 → 命中物理 group `tdd-spec` → 直接走物理 group update
- **AND** 不进入 basename fallback / rebind 流程

### Requirement: 逻辑 group update 遍历 member

`update` 对逻辑 group SHALL 遍历每个 member, 调用对应源类型的 update 路径:

- member source 为 git → 走 git source update
- member source 为 registry → 走 registry update
- member 对应 local-copy skill (key 形如 `custom/<name>`, 磁盘有 `custom/<name>/SKILL.md`) → SHALL 跳过并输出 `⚠ <key>: local skill, run \`skillsmgr update ./path\` to update` (因为原始路径未知)
- member source 已不存在 (磁盘无对应目录, sources.json 也无条目) → 输出 warning `⚠ <key>: dangling reference, skipped`, 不计入 failed

#### Scenario: 逻辑 group 含混合源类型, local-copy 跳过
- **GIVEN** 逻辑 group `python` 含 `custom/foo` (磁盘 `custom/foo/SKILL.md` 存在), `official/anthropic/skills/commit` (git)
- **WHEN** 用户执行 `skillsmgr update python`
- **THEN** `custom/foo` 输出 `⚠ custom/foo: local skill, run \`skillsmgr update ./path\` to update`, 不计入 failed
- **THEN** `official/anthropic/skills/commit` 走 git update
- **THEN** 输出汇总不把 `custom/foo` 统计进 failed

#### Scenario: 逻辑 group 含悬空引用 (磁盘无)
- **GIVEN** 逻辑 group `python` 含 `custom/bar`, 磁盘无 `custom/bar/SKILL.md`
- **WHEN** 用户执行 `skillsmgr update python`
- **THEN** 输出 `⚠ custom/bar: dangling reference, skipped`
- **THEN** 不计入 failed

## ADDED Requirements

### Requirement: 裸 update 跳过 local-copy skill

裸 `skillsmgr update` (无参数, 全量更新) SHALL 只更新有 sources.json 条目的 source (git 类型).  磁盘上存在的 local-copy skill (`custom/<name>/SKILL.md` 存在) SHALL 被跳过.

执行结束时, 系统 SHALL 在常规输出之后打印一行汇总:
```
N local skill(s) skipped. Use `skillsmgr update ./path` to update a local skill.
```

其中 N 为跳过的 local-copy skill 数量; 若 N == 0, 本行 SHALL 被省略.

#### Scenario: 无参数 update 跳过本地 skill 并提示
- **GIVEN** 系统中有 3 个 git source (community/...) 和 2 个磁盘 local-copy skill (custom/jt-share, custom/jt-release, 均无 sources.json 条目)
- **WHEN** 用户执行 `skillsmgr update`
- **THEN** 系统 SHALL 对 3 个 git source 执行远程更新
- **THEN** 系统 SHALL NOT 尝试更新 2 个 local-copy skill
- **THEN** 末尾 SHALL 打印 `2 local skill(s) skipped. Use \`skillsmgr update ./path\` to update a local skill.`

#### Scenario: 无本地 skill 时不打印跳过行
- **GIVEN** 系统中仅有 git source, 无任何磁盘 local-copy skill
- **WHEN** 用户执行 `skillsmgr update`
- **THEN** 末尾 SHALL NOT 打印跳过行
