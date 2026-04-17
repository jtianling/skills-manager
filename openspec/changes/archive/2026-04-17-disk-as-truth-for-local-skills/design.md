## Context

skills-manager 对本地 skill 的追踪当前是**双存储**: 磁盘 (`~/.skills-manager/custom/<name>/`) + `sources.json` (条目含 `url`, `installMethod: 'local-copy'`, `repoName` 等).  两份独立存储靠代码纪律保持一致, 一旦任一路径漏写/漏删即漂移.

用户机器实测三路审计 (disk × sources.json × groups.json):
- 200 个磁盘 SKILL.md, 其中 156 个被 git 类型的 parent source 覆盖 (合法嵌套)
- 剩余 12 个是孤儿 local-copy: 磁盘在, sources.json 无条目 (V2 backup 里就已缺失)
- 5 个 `groups.json` 成员引用这 12 个孤儿, 属于次生"悬空引用"
- 2 个 sources.json 条目反向失配 (条目在, 磁盘空), 属于另一种漂移方向

代码层面, `install` 命令按**名字**扫磁盘做存在性检测 (`findInstalledCustomSkill`), `update` 命令按**路径**查 sources.json (`SourceResolver.resolveLocalPath`) — 视野不对称, 症状就是用户报的"install 说存在, update 说不存在".

commit `6b7d364 (2026-03-29)` 曾把 update 改为按名字匹配并修复了类似问题, 但 `215b246 (2026-04-08)` 引入 `SourceResolver` 时又回到按 URL 匹配, 属于回归.  这次变更不是再去"对齐两侧视野", 而是**彻底移除 local-copy 的 sources.json 记录**, 让磁盘成为唯一真相源.

用户的 usage pattern 是本次方案可行的前提: 更新本地 skill 一定是 `cd` 到本地 skill 所在目录, `skillsmgr update ./local-skill`.  既然 origin path 永远由用户在更新时提供, 系统没必要记忆.

## Goals / Non-Goals

**Goals:**

- local-copy skill 的 install / update / uninstall / list 四条路径都只信磁盘, 不读写 sources.json 的 local-copy 条目
- 所有现存孤儿 (12 个) 在本次变更后"天然可用", 无需 doctor 命令
- sources.json 残留的 local-copy 条目被静默忽略并在下次写入时清除, 用户无感
- `install` / `update` / `uninstall` / `list` / `group add` / `group remove` / `deploy` / `remove` 对"本地 skill 是否存在"这个问题给出一致答案
- drift 对 local-copy 结构性消失 (没有第二份存储 = 不存在不一致的可能)

**Non-Goals:**

- 不改 git install (community/official/registry/zip) 的 sources.json 追踪逻辑
- 不引入 `.skillsmgr-origin.json` 或任何 per-skill 元数据文件
- 不引入 `skillsmgr doctor` / 诊断/修复命令
- 不做数据迁移脚本 (通过自然过滤完成清理)
- 不改 `local-batch` 物理组的语义 (其成员本就来自磁盘)
- 不优化 git install 的磁盘 vs sources.json 一致性问题 (后续单独的变更)

## Decisions

### D1: 完全移除 local-copy 的 sources.json 追踪, 而非"先警告再兜底"

**决定**: `installFromLocalDir` 停止调用 `sourcesService.addSource`; 读路径 (resolver, updater) 不再尝试从 sources.json 查找 local-copy 条目.

**备选**: 保留 sources.json 写入但在 update 找不到时 fallback 到磁盘.

**拒绝原因**: fallback 等于给双存储贴创可贴, drift 的可能性保留, 下次重构还会回归.  唯一根治是让**第二份存储物理不存在**.

### D2: 本地 skill 的权威 key 仍是 `custom/<name>` / `custom/<parent>/<name>`

**决定**: groups.json 的成员引用格式不变 (如 `custom/jt-share`); 解析这类 key 时走磁盘存在性检查 (`custom/<name>/SKILL.md` 是否存在).

**备选**: 改用绝对路径或 SKILL.md 内 name 字段作为 key.

**拒绝原因**: groups.json 已有数据结构和多处代码基于 key 形式; 改格式是破坏性重构, 与本变更的最小化精神矛盾.  key 仍由磁盘路径推出, 权威性不变.

### D3: 裸 `skillsmgr update` 跳过本地, 不尝试"记住上次的路径"

**决定**: `update` 无参数时只更新 git 类型 source; 本地 skill 跳过并打印一行提示 "N 个本地 skill 已跳过 (用 skillsmgr update ./path 更新)".

**备选 1**: 裸 update 时对每个本地 skill 尝试若干启发式路径 (如最近目录, 历史记录).
**备选 2**: 要求用户必须显式枚举本地 skill 才能批量更新.
**备选 3**: 存一个 "update history cache" 记录上次用什么路径更新过.

**拒绝原因**: 启发式/cache 本质上都是另一种形式的"记忆", 重新引入漂移风险.  跳过 + 明确提示最诚实, 也最符合用户既有习惯.

### D4: 读路径兼容 legacy sources.json 条目, 写路径自然过滤

**决定**: 加载 `sources.json` 时对所有 `installMethod === 'local-copy'` 条目视为不存在 (读层过滤); 任何对 sources.json 的正常写操作都会重写完整文件, 过滤后的结果不包含 legacy 条目.  不需要显式迁移步骤.

**备选**: 启动时主动清理 sources.json (写回删除 local-copy 条目).

**拒绝原因**: 主动清理是"一次性 doctor 行为", 违背本次变更精神.  自然过滤同等结果, 但语义上只是"新代码不认识老数据", 不承担修复职责.

### D5: install 的 overwrite 提示行为保留, 移除 URL-mismatch 分支

**决定**: `install ./path` 时如果 `custom/<basename>/` 已存在, 走今天的 overwrite 提示 (y/n).  不再有"URL 不同则报冲突"的第三种分支 — 因为没有记录的 URL 可供对比.

**影响**: 用户从两个不同 path 安装同名 skill 时, 第二次会直接覆盖第一次.  这和用户的习惯 (`update ./new-path` rebind) 一致, 没有歧义.

**备选**: 保留冲突检查, 但改为"读取已安装 SKILL.md 内容与新 path 内容 diff 后提示".

**拒绝原因**: 多出磁盘读 + diff 成本, 且 overwrite 提示本来就是让用户决定的关卡.

### D6: uninstall/remove 对 local skill 通过 `findInstalledCustomSkill(name)` 解析

**决定**: `skillsmgr uninstall jt-share` 走现有的 `findInstalledCustomSkill` (名字扫磁盘 `custom/<name>` 和 `custom/*/name`), 直接 rmdir.  不查 sources.json.  groups.json 中对该 key 的引用在 rmdir 后也一并清理 (现有 `removeSkillFromAll` 逻辑保留).

**理由**: `findInstalledCustomSkill` 就是为磁盘扫描设计的, 它不依赖 sources.json, 是本次设计的天然承载点.

### D7: `list` 命令输出: 本地 skill 不显示 url 字段

**决定**: list 对本地 skill 仅显示 `name` + `path`; git skill 保持 `url` 字段输出.

**理由**: url 对本地 skill 本来就不存在意义 (总是当前 skill 所在的磁盘路径).  简化输出.

### D8: SourceResolver 的 local-path 分支: 按磁盘 key 直接构造 ResolvedTarget

**决定**: `resolveLocalPath(input)` 在 SKILL.md 存在于 `custom/<basename>/` 时, 直接返回 kind: 'source', sourceKeys: ['custom/<basename>'] (或嵌套形式).  不再查 `sources.json` 做 URL 匹配, 不再走 `resolveLocalRebindCandidate` 的孤儿分支 (因为"孤儿"在新模型下就是普通本地 skill).

**影响**: `rebind-candidate` 语义对 local-copy 不再适用.  对 physical group (local-batch) 继续适用 (因为物理组 url 本身就有意义 — 指向用户工作目录).

## Risks / Trade-offs

**[风险] 裸 `update` 行为变化 (BREAKING)**
用户若依赖 `skillsmgr update` 一次性更新所有内容 (含本地), 会发现本地不再被更新.
→ **缓解**: 跳过时打印明确提示 "N 个本地 skill 已跳过"; release notes 明确标注 BREAKING; 在变更合并后的 1 个版本内保留兼容提示文案.

**[风险] 同名不同路径安装**
新路径会直接覆盖旧安装 (没有冲突检测).
→ **缓解**: overwrite 提示本来就是用户决定点, 不盲目覆盖; 文档说明如需同名共存, 应改 skill 的 `name` 字段.

**[风险] legacy local-copy 条目残留导致第三方工具混淆**
如果有别的脚本/工具直接读 sources.json, 可能看到过时数据.
→ **缓解**: 读层过滤让新代码看不到它们; 正常写入后会被自然清理; 用户若在意可手动删 sources.json 任何 `installMethod: 'local-copy'` 条目 (幂等).

**[风险] 物理组 (local-batch) 的成员可能被误判为独立 local skill**
`custom/my-tools/tool-a/` 既可能是物理组 `my-tools` 的成员, 也可能被误解为嵌套 local skill.
→ **缓解**: 保留现有 `findInstalledCustomSkill` 的两层查找策略 + 物理组在 groups.json 有明确 `kind: 'local-batch'` 标记; 解析时优先查 groups.json 判物理组归属.

**[权衡] 本地 skill 不再支持"从历史原始路径无参数更新"**
用户必须在更新时显式提供 `./path`.
→ 这是本次设计明确接受的权衡 (基于用户习惯).

**[权衡] 移除 URL-mismatch 冲突检测削弱了防呆**
同名不同路径的第二次 install 会覆盖前一次.
→ overwrite 提示作为人工关卡, 足够.

## Migration Plan

**部署步骤:**

1. 代码实现: 按 `tasks.md` 推进
2. 测试: 更新现有测试 (移除 URL-mismatch 断言, 移除 sources.json 写入断言), 新增"零 sources 条目"场景覆盖
3. 文档: 更新 `docs/` 里本地 skill 生命周期描述
4. 合并与 release: BREAKING 变化在 MINOR release notes 中明确列出

**回滚策略:**

- git revert 本变更的 commit 即可回到双存储状态
- 用户数据层面无需回滚操作 (legacy sources.json 条目被过滤而非删除, 回滚后它们重新可见)

**用户行动:**

- 无需任何操作
- 升级后 `skillsmgr update ./path` 开始对孤儿本地 skill 生效
- 裸 `skillsmgr update` 的本地跳过是预期行为, 提示文字会解释

## Open Questions

- **Q1 (resolved)**: `list --json` 对本地 skill 保留 `url: null`, 同时输出 `installMethod: "local-copy"`.  这样不破坏已有消费者对字段存在性的假设, 又保留语义。
- **Q2**: 是否在 `skillsmgr status` 或启动自检阶段报告过滤掉了多少 legacy local-copy 条目? 提议: 不报告 (与"无感"原则一致).  后续决定.
