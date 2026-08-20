## Context

`InstallResult.sourceKeys` 这个字段名被两拨调用者赋予了互相冲突的含义:

- **真·source key 消费者**: `rollback.ts:23` 拿它逐个调 `sourcesService.removeSource(key)` —— 必须是 source key, 否则失败回滚会清不掉 `sources.json` 条目
- **误当 skill key 的消费者**: `install.ts:131` (`--group` 入组)、`install.ts:142` (`--json` 输出的 `skills` 字段)、`install-collection.ts:227/235`

四条 install 分支填的全是 source key, 所以第一拨对、第二拨错.  `install-registry.ts:125` 的 `selectedSkills.map(() => sourceKey)` 和 `install-wellknown.ts:150` 的 `installedPaths.map(() => sourceKey)` 甚至把同一个 source key 重复 N 遍 —— 数组长度对得上 skill 数量, 内容却全是同一个值, 这正是"看起来像 skill key 列表"的伪装, 也是缺陷能存活至今的原因.

卸载侧反而是对的: `bundle-manager.ts:222` 用 `${sourceKey}/${skillName}` 显式拼出 skill key 再 `removeSkillFromAll`.  正向写入与反向清理用的不是同一种 key —— 这本身就是项目"命令对称性"硬规则的破口.

## Goals / Non-Goals

**Goals:**
- `install --group` 与 `install --from` 写入的 group 成员能被 `add --group` 正确解析并部署
- 四条 install 分支行为一致, 不再靠 source 是否单段来"碰巧正确"
- 保住 `rollback` 的 source key 语义, 不因改字段而引入回滚缺陷
- 把"members 恒为 skill key"固化成 spec 不变量, 堵住下次新增 source 类型时重犯

**Non-Goals:**
- **自动迁移已存在的错误 group 成员**: 见 Migration Plan
- **重构 group 成员解析逻辑**: `add.ts:652` 的 `` `${s.source}/${s.name}` === key `` 匹配是正确的一侧, 不动
- **给 `sourceKeys` 改名**: 它在 `uninstall` / `update` / `add` / `source-resolver` 有大量正确用法, 改名是纯噪音

## Decisions

### Decision 1: 新增 `skillKeys` 字段, 不改 `sourceKeys` 语义

`InstallResult` 新增 `skillKeys?: string[]`, 与 `installedPaths` 一一对应, 每项是该 skill 的完整 skill key (`{source}/{name}`).  `sourceKeys` 原样保留为 source key 列表.

- 备选 A (把 `sourceKeys` 语义改成 skill key): 一行就能改, 但 `rollback.ts:23` 会拿 skill key 去 `removeSource()`, 失败回滚静默清不掉 sources.json —— 而且这条路径只在安装失败时才走, 单测不容易覆盖到, 属于"改完看着绿、真出事才发现"的那类 —— 否决
- 备选 B (在 `install.ts` 里由 source key + installedPaths 反推 skill key): 反推要靠路径 basename, 对 `official/{provider}/{repo}/{skill}` 这种带 `skills/` 子目录的形态不可靠 —— 否决

### Decision 2: skill key 由各分支在**已知 skill 名的位置**构造, 不做集中推导

每条分支在遍历选中 skill 时本就手里有 `skill.name` 与 `sourceKey`, 直接 `${sourceKey}/${skill.name}` 即可.  不引入集中式 helper 去猜.

唯一例外是 `install-local.ts:69` 的单 skill 路径与 `install-git.ts:158` 的单 skill 路径, 它们的 sourceKey 已是 `custom/{name}` 形态 (source key == skill key), 此时 `skillKeys` 与 `sourceKeys` 取值相同, 属正常而非特例代码.

### Decision 3: `--json` 输出的 `skills` 字段一并修正

`install.ts:142` 当前输出 `skills: result.sourceKeys` —— 字段名叫 skills 内容却是 source key.  改为 `result.skillKeys`.

这是**面向脚本消费者的输出变更**, 但当前值本就是错的 (对多段 source 而言是死引用), 修正它不构成兼容性损失; 对 custom 源两者取值相同, 无感知.

### Decision 4: 不自动迁移存量错误 group 成员

见 Migration Plan.

## Risks / Trade-offs

- **`skillKeys` 设为可选字段, 调用点漏填会静默退化成"不入组"** → `install.ts` 的入组逻辑在 `options.group` 存在而 `skillKeys` 为空时 SHALL 报错而非静默跳过; 四条分支各自有回归测试兜底
- **存量错误 group 成员继续存在** → `add --group` 已经会对每个匹配不上的成员打印 `Skill '<key>' not found, skipping.`, 用户可见; Migration Plan 给出手工修复方式
- **`install-local.ts:141` 的 bundle `members: sourceKeys`** 是另一处同名字段的消费点, 语义是 bundle 成员而非 group 成员 → 实现时需确认它要的是哪种 key, 不能顺手一起改

## Migration Plan

**不做自动迁移.**  理由: 迁移需要把 `well-known/docs.stripe.com` 这样的 source key 展开成它当前对应的全部 skill key, 但"安装时选了哪几个 skill"这一信息没有被记录 —— 展开只能按当前磁盘上的全部 skill 来猜, 会把用户当初没选的 skill 也塞进 group, 属于静默改变用户数据.  宁可留错也不猜.

用户侧修复方式 (二选一):
1. 重新执行 `skillsmgr install <source> --group <name>` —— 修好后会写入正确成员
2. `skillsmgr group remove <group> <bad-key>` 后用 `skillsmgr group add <group> <skill>` 逐个补

CHANGELOG SHALL 说明: 修复前用多段 source 建的 group 需要重建一次.

## Open Questions

1. `install-local.ts:141` 的 `createGitBundleInfo` / bundle `members` 字段消费的到底是 source key 还是 skill key?  实现时需查 `bundle-manager.ts` 的读取侧确认, 若也是 skill key 则一并修正并补测; 若是 source key 则保持不动并加一行意图注释说明两者区别
