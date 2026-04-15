## ADDED Requirements

### Requirement: local-batch bundle update 同步同名自动 group
`update` 命令对 `local-batch` bundle 执行 sync 时, 若源目录相对 `sources.json` 出现**新增** skill 并已物理安装, 系统 SHALL 同步将该 skill 追加到名为 `basename(bundle.url)` 的虚拟 group (若该 group 存在).  group 不存在时 SHALL 跳过同步, 不自动创建 group.

`applyRemoved` 分支通过 `removeSkillFromAll` 清理所有 group 引用, 保持现有行为.

约束:
- group 名取值规则与 `install-directory-batch` 的"批量安装自动创建虚拟 group"需求一致, 即 `basename(normalizeLocalPath(bundle.url))`
- 一个 sync 批次中, 每个新增 skill 的 group 同步 SHALL 独立判定, 任一写入失败不影响其他 skill
- 本需求仅作用于 `bundle.type === 'local-batch'`; git / registry / zip bundle 不受影响

#### Scenario: 源目录新增 skill 被加入同名 group
- **GIVEN** 用户通过 `skillsmgr install ./tdd-spec` 初次安装, 自动创建 `tdd-spec` group 并加入已有 11 个 skill
- **AND** 源目录 `./tdd-spec/` 下新增 `ts-new-one/SKILL.md`
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`
- **THEN** 系统扫描发现 `ts-new-one` 属于 `diff.added`, 物理安装到 `~/.skills-manager/custom/tdd-spec/ts-new-one/`
- **AND** 系统 SHALL 把 `custom/tdd-spec/ts-new-one` 追加到 `groups.json` 的 `tdd-spec` group
- **AND** bundle members 同步更新

#### Scenario: 同名 group 已被用户删除时跳过同步
- **GIVEN** 同"源目录新增 skill 被加入同名 group"的前置, 但用户事先执行 `skillsmgr group delete tdd-spec`
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 源目录有新增
- **THEN** 系统 SHALL 正常安装新 skill 并更新 sources.json / bundle members
- **AND** 系统 SHALL **不**重建 `tdd-spec` group
- **AND** 系统 SHALL **不**报错, 视为用户意图

#### Scenario: 多个新增 skill 同批加入
- **GIVEN** 源目录 `./tdd-spec/` 一次性新增 3 个 skill
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`
- **THEN** 3 个 skill 均 SHALL 追加到 `tdd-spec` group
- **AND** group 中的顺序保持追加顺序 (按源目录扫描顺序)

#### Scenario: group 已包含该 skill key 时幂等
- **GIVEN** 用户手动执行 `skillsmgr group add tdd-spec custom/tdd-spec/ts-new-one` 之后, 下次运行 update 时该 skill 的内容仍在源目录里
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`
- **THEN** 若该 skill 被识别为 `existing` (不是 `added`), 走 `applyExisting` 分支, 本需求不触发
- **AND** 若识别为 `added` (例如之前 sources 记录丢失而 group 里有 key), 再次 `addSkill` 依赖 `GroupsService.addSkill` 的幂等性, 不重复写入

#### Scenario: --sync 移除的 skill 继续沿用现有清理
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec --sync`, 源目录里某 skill 已被删除
- **THEN** 系统 SHALL 按现有 `applyRemoved` 逻辑通过 `groupsService.removeSkillFromAll` 清理 group 引用
- **AND** 本需求不改动该流程

#### Scenario: git / registry bundle update 不触发本需求
- **GIVEN** 一个 git bundle (例如 `community/obra/superpowers`) 源仓库新增 skill
- **WHEN** 用户执行 `skillsmgr update community/obra/superpowers`
- **THEN** 系统 SHALL 按现有 `applyAdded` 的 git 分支逻辑处理, 不做 group 同步
- **AND** 本需求只影响 local-batch
