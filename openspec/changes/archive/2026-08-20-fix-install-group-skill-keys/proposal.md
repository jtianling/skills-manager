## Why

`skillsmgr install <source> --group <name>` 往 `groups.json` 里写的是 **source key** 而不是 **skill key**, 导致产生的 group 完全不可用.  实测:

```
$ skillsmgr install https://docs.stripe.com --group stripe     # 装上 8 个 skill
$ cat ~/.skills-manager/groups.json
  "stripe": { "kind": "virtual", "members": ["well-known/docs.stripe.com"] }
$ skillsmgr add --group stripe --json
  {"error":"No valid skills found in group 'stripe'.","code":"GROUP_EMPTY"}
```

这不是新引入的缺陷, 而是一直存在但被 custom skill 的目录结构掩盖: custom skill 平铺在 `custom/{name}`, 其 source key 恰好等于 skill key, 所以本地安装路径一直是对的.  只要 source key 是多段的就断:

| 安装方式 | source key | 正确 skill key | 现状 |
|---|---|---|---|
| `install ./x --group g` | `custom/x` | `custom/x` | ✅ 巧合正确 |
| `install owner/repo --group g` | `community/{owner}/{repo}` | `community/{owner}/{repo}/{skill}` | ❌ 死引用 |
| `install pkg --group g` | `registry/{pkg}` | `registry/{pkg}/{skill}` | ❌ 死引用 |
| `install https://host --group g` | `well-known/{host}` | `well-known/{host}/{skill}` | ❌ 死引用 |
| `install --from @a/kit` | `registry/{pkg}` | 同上 | ❌ 死引用 (两处) |

spec 层面早已写对 —— `group-as-first-class-unit` 的 "install --group 限定为加到逻辑 group" 明确要求"把安装的 **skill key** 添加到该逻辑 group", `custom-install` 的 scenario 也写 "每个安装的 skill key 被添加到 python group".  但 `custom-install` 同一需求的**正文**写成了 "将已安装 skill 的 **source key** 添加到指定虚拟 group", 与自己的 scenario 矛盾 —— 实现照着错的那句写了.  本变更同时修正实现与该处 spec 自相矛盾.

## What Changes

- `InstallResult` 新增一个承载**每个已安装 skill 的 skill key** 的字段; 现有 `sourceKeys` 语义保持不变 (`rollback.ts` 依赖它调用 `removeSource()`, 必须仍是 source key)
- 四条 install 分支 (`install-git` / `install-registry` / `install-wellknown` / `install-local`) 全部填充新字段
- `install.ts` 的 `--group` 入组改用新字段; `--json` 输出的 `skills` 字段同步改为真正的 skill key (当前输出的是 source key, 字段名与内容不符)
- `install-collection.ts` 的两处 (`--group` 入组、`upsertCollectionGroup`) 同步改用新字段
- 修正 `custom-install` 中"source key"与自身 scenario 矛盾的需求正文
- 新增不变量需求: 虚拟 group 与 collection group 的 `members` 恒为 skill key, 任何写入路径都不得写入 source key
- **非 BREAKING**: 已存在的错误 group 成员不会被自动迁移 (见 design 的 Migration Plan), 用户重新执行 `install --group` 即可得到正确成员

## Capabilities

### New Capabilities
<!-- 无新增能力, 本变更是缺陷修复 + 既有需求的不变量强化 -->

### Modified Capabilities
- `custom-install`: "install --group 自动入组"需求正文由 "source key" 修正为 "skill key", 并补齐多段 source (community / registry / well-known) 的 scenario
- `virtual-group`: "groups.json 存储"需求补充成员格式不变量 —— members 恒为 skill key; 并新增 `install --from <collection>` 生成 collection group 时的成员格式约束

## Impact

**修改代码**
- `src/commands/install-utils.ts` — `InstallResult` 类型与 `createInstallResult` 签名
- `src/commands/install-git.ts` (:158, :267) / `install-registry.ts` (:125) / `install-wellknown.ts` (:150) / `install-local.ts` (:69, :134) — 填充 skill key
- `src/commands/install.ts` (:131 入组, :142 json 输出)
- `src/commands/install-collection.ts` (:227 入组, :235 collection group)

**不受影响 (需在实现时确认)**
- `src/services/rollback.ts` — 继续消费 `sourceKeys` 作为 source key
- `src/commands/uninstall.ts` / `update.ts` / `add.ts` / `source-resolver.ts` — 现有 `sourceKeys` 消费点语义不变
- `src/services/bundle-manager.ts:222` — 卸载侧本就用 `${sourceKey}/${skillName}` 构造 skill key, 已是正确形态, 正好印证正反向不对称

**测试**: 需覆盖 community / registry / well-known 三种多段 source 的 `install --group` → `add --group` 全链路, 以及 custom 平铺路径不回归
