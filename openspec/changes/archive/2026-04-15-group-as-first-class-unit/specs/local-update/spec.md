## ADDED Requirements

### Requirement: 物理 group update 默认源为真同步

`update` 命令对物理 group (顶层 `update <input>` 命中 group target 或 `group update <name>`) SHALL 默认以源目录为权威, 自动 diff 并同步:

- `existing` (源 ∩ 目标): SKILL.md 内容比较, 不同则覆盖, 输出 `↑`; 相同则输出 `✓`
- `added` (源 - 目标): 安装新 skill, 写入 sources.json, 输出 `+`
- `orphaned` (目标 - 源): 默认删除物理目录 + sources entry + 清理逻辑 group 引用, 输出 `-`

新增 `--keep-local` 选项: 保留 orphaned 的物理目录和 sources entry, 输出 `- (kept locally)`.

旧 `--sync` 选项 SHALL 保留为 no-op 兼容标记 (默认行为已等同 sync).

#### Scenario: 默认 sync 删除孤儿
- **GIVEN** 物理 group `tdd-spec`, 源目录新增 `ts-renamed/`, 已有 `tdd-old/` 在源中已删除, 物理目录仍有
- **WHEN** 用户执行 `skillsmgr update tdd-spec`
- **THEN** `ts-renamed` 被 install 并加 sources entry, 输出 `+ ts-renamed`
- **THEN** `tdd-old` 物理目录删除, sources entry 清理, 逻辑 group 引用清理, 输出 `- tdd-old`

#### Scenario: --keep-local 保留孤儿
- **GIVEN** 同上场景
- **WHEN** 用户执行 `skillsmgr update tdd-spec --keep-local`
- **THEN** `tdd-old` 物理目录和 sources entry 都保留, 输出 `- tdd-old (kept locally)`

#### Scenario: --sync 兼容标记 no-op
- **WHEN** 用户执行 `skillsmgr update tdd-spec --sync`
- **THEN** 行为与不带 `--sync` 完全一致 (默认即 sync)
- **THEN** 系统 SHALL 不报错, 视为兼容性 no-op

### Requirement: 逻辑 group update 遍历 member

`update` 对逻辑 group SHALL 遍历每个 member, 调用对应源类型的 update 路径:

- member source 为 git → 走 git source update
- member source 为 local-copy → 走当前 "从原始路径更新 local-copy skill" 流程
- member source 为 registry → 走 registry update
- member source 已不存在 → 输出 warning `⚠ <key>: dangling reference, skipped`, 不计入 failed

#### Scenario: 逻辑 group 含多种源类型
- **GIVEN** 逻辑 group `python` 含 `custom/foo` (local-copy, 源路径有更新), `official/anthropic/skills/commit` (git, 远程有新版本)
- **WHEN** 用户执行 `skillsmgr update python`
- **THEN** `custom/foo` 走 local-copy update 流程, 报 `↑ foo`
- **THEN** `official/anthropic/skills/commit` 走 git update, 报 `↑ commit`
- **THEN** 输出汇总 `2 updated`

#### Scenario: 逻辑 group 含悬空引用
- **GIVEN** 逻辑 group `python` 含 `custom/bar`, 但 sources.json 已无 `custom/bar`
- **WHEN** 用户执行 `skillsmgr update python`
- **THEN** 输出 `⚠ custom/bar: dangling reference, skipped`
- **THEN** 不计入 failed 计数

## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新

update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统经 `SourceResolver.resolveLocalPath` 解析后:

- 命中物理 group → 走 "物理 group update 默认源为真同步" 流程
- 命中单 skill local-copy source → 走 "从原始路径更新 local-copy skill" 流程
- 精确匹配失败 → 进入 basename fallback 流程 (见 "basename fallback 与 rebind" 需求); fallback 也未命中则报错

物理 group 不再走旧的 bundle sync 路径 (该路径在新模型下被废弃, 仅 git bundle 保留).

#### Scenario: 路径精确匹配物理 group
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 系统将 `./tdd-spec` resolve 为绝对路径
- **THEN** 在 `groups.json` 中查找 `kind === 'local-batch'` 且 `url` 等于该绝对路径的物理 group
- **THEN** 找到后执行 "物理 group update 默认源为真同步" 流程

#### Scenario: 路径精确匹配单 skill
- **WHEN** 用户执行 `skillsmgr update ./my-lint`, 该路径下有根 `SKILL.md`, sources.json 含 `custom/my-lint` 单 skill (`installMethod === 'local-copy'`)
- **THEN** 走 "从原始路径更新 local-copy skill" 流程

#### Scenario: 路径未匹配任何 + fallback 未命中
- **WHEN** 用户执行 `skillsmgr update ./unknown`, 精确路径匹配失败, basename fallback 也未找到候选
- **THEN** 系统 SHALL 报错 `No installed skill found from path: {absPath}`

### Requirement: basename fallback 与 rebind

update 命令在 `resolveLocalPath` 精确路径匹配失败时, SHALL 按 basename 在已安装的 local-copy source 和**物理 group** 中查找候选, 并根据旧路径状态和类型匹配决定是否进入 rebind 流程.

basename 匹配规则:
- local-copy source: 候选为 `installMethod === 'local-copy'` 且 `repoName === basename(absolutePath)` 的 source
- 物理 group: 候选为 `groups.json` 中 `kind === 'local-batch'` 且 `basename(normalizeLocalPath(group.url)) === basename(absolutePath)` 的 group

找到唯一候选后 SHALL 依次检查:
1. 候选的旧 URL 是否仍 `fileExists`: 仍存在则**不**触发 rebind, 返回 not-found, 错误文案 SHALL 提示旧路径仍存在并引导用户先处理旧路径
2. 新路径结构类型是否与候选类型一致: 类型不一致则拒绝 rebind, 错误文案 SHALL 明确指出 "path type mismatch"
3. 全部通过后 SHALL prompt 用户确认 rebind, 默认选项 No; `--force` 或 `-y` SHALL 跳过 prompt 直接 rebind
4. 用户确认后 SHALL 原子重写:
   - 物理 group rebind: 更新 `groups.json[<name>].url` 为新路径; 同时把 sources.json 中所有 `custom/<name>/*` 的 `url` 字段刷新为新路径
   - 单 skill rebind: 更新 sources.json 中 `source.url`
5. Rebind 完成后 SHALL 继续执行正常 update 流程

类型匹配规则:
- 单 skill 候选: 新路径的根目录必须直接含 `SKILL.md`
- 物理 group 候选: 新路径的根目录必须**不**含 `SKILL.md` 且必须有至少一个含 `SKILL.md` 的子目录

多候选处理: basename 匹配返回 > 1 个候选时, SHALL 报错列出所有候选的 key/groupName 和 URL, 提示用户手动清理后重试, 不进入交互式选择.

#### Scenario: 物理 group 搬家后 rebind 成功
- **GIVEN** 物理 group `tdd-spec`, `groups.json` 中 `url = /old/path/tdd-spec`, sources 含 `custom/tdd-spec/ts-apply` 等 8 条 (url 字段也指 `/old/path/tdd-spec`)
- **AND** `/old/path/tdd-spec` 已不存在
- **AND** `/new/path/tdd-spec/` 存在, 无根 SKILL.md, 但有 `ts-apply/SKILL.md` 等子目录
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`, 精确匹配失败
- **THEN** 系统进入 basename fallback, 找到唯一候选物理 group
- **AND** 确认旧路径不存在
- **AND** 确认新路径为 batch 结构
- **AND** prompt 用户确认 rebind
- **WHEN** 用户确认
- **THEN** 系统原子更新: `groups.json[tdd-spec].url` 为新路径; `sources.json` 中所有 `custom/tdd-spec/*` 的 `url` 也更新为新路径
- **AND** 系统继续执行物理 group update 同步

#### Scenario: 单 skill 搬家后 rebind 成功
- **GIVEN** `sources.json` 中有 source key `custom/my-lint`, `installMethod = 'local-copy'`, `url = /old/path/my-lint`, `repoName = 'my-lint'`
- **AND** `/old/path/my-lint` 已不存在
- **AND** `/new/path/my-lint/SKILL.md` 存在
- **WHEN** 用户执行 `skillsmgr update /new/path/my-lint`
- **THEN** 系统进入 basename fallback, 找到唯一候选 source, 走 rebind 流程

#### Scenario: 用户拒绝 rebind
- **GIVEN** 同 "物理 group 搬家后 rebind 成功" 的前置条件
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`, 系统 prompt rebind, 用户拒绝
- **THEN** 系统 SHALL 输出 `Cancelled.` 并以退出码 0 结束
- **AND** `groups.json` 和 `sources.json` 保持不变, 不执行 update

#### Scenario: --force 跳过 rebind prompt
- **GIVEN** 同 "物理 group 搬家后 rebind 成功" 的前置条件
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec --force`
- **THEN** 系统 SHALL 跳过 rebind prompt 直接 rebind 并继续 update

#### Scenario: 旧路径仍存在时不触发 rebind
- **GIVEN** 物理 group `tdd-spec`, `url = /old/path/tdd-spec`, 旧路径仍存在
- **AND** 用户在不同路径 `/other/path/tdd-spec` 下也创建了同名目录结构
- **WHEN** 用户执行 `skillsmgr update /other/path/tdd-spec`
- **THEN** 系统精确匹配失败, basename fallback 找到候选, 但旧路径仍存在, 不触发 rebind
- **AND** 系统 SHALL 报错, 错误文案形如 `No installed skill found from path: /other/path/tdd-spec. A local-batch group with the same name is installed from /old/path/tdd-spec (still exists). Remove or rename the old path first to rebind.`

#### Scenario: 类型不匹配拒绝 rebind
- **GIVEN** 物理 group `tdd-spec`, 旧路径已不存在
- **AND** `/new/path/tdd-spec/SKILL.md` 存在 (新路径是单 skill 结构)
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统 SHALL 报错, 含 `Path type mismatch: existing local-batch group 'tdd-spec' is a batch, but /new/path/tdd-spec looks like a single skill.`

#### Scenario: basename 多候选报错列出
- **GIVEN** `groups.json` 历史脏数据, 存在两个物理 group 基名都等于 `tdd-spec` 但 URL 不同 (理论上禁止, 但脏数据保护), 两者旧路径都不存在
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统进入 basename fallback, 发现多个候选
- **AND** 系统 SHALL 报错列出所有候选的 group 名和 URL, 提示用户手动清理后重试

#### Scenario: bareword update 不走 basename fallback
- **WHEN** 用户执行 `skillsmgr update tdd-spec` (无 `./` 前缀, 无绝对路径)
- **THEN** 系统按 bareword 解析: 优先匹配 group 名 → 命中物理 group `tdd-spec` → 直接走物理 group update
- **AND** 不进入 basename fallback / rebind 流程
