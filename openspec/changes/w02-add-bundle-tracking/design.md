# Design: w02-add-bundle-tracking

## Context

w01 引入 SourceResolver 后, update / uninstall 能对称接收 install 的所有单 skill 范围输入, 但 `update ./spec-tdd` 这种 batch 路径仍然返回 `batch-unsupported`, 因为 sources.json 里没有任何"这些 19 条 custom/spec-tdd/* 是一批的"的记录.

用户明确要求 (参见主 session 讨论): update 一个 batch 应该同步源里新增的 skill.  要实现这个语义需要三个前置信息:
1. **bundle 归属**: 这 19 条 source 属于同一个 bundle
2. **bundle 源**: 这个 bundle 的 url 是 `/Users/.../spec-tdd`
3. **selectionMode**: install 时是全选 (`all`) 还是部分选 (`subset`) — 决定 update 时是否自动装新增

w02 只负责把这些信息沉淀下来, 不改变任何用户可见行为.  行为变化留给 w03.

sources.json 当前 schema v1 (`openspec/specs/source-management/spec.md:37-80`) 已经在很多代码路径被直接读写, 升级要考虑向前向后兼容.

## Goals / Non-Goals

**Goals:**
- 在 sources.json 加入 `bundles` section, 描述一次 install 的聚合成员
- install 命令 (所有子路径: local-batch, git, zip) 写入 bundle 条目
- 交互式选择的"全选 vs 部分选"能被捕获并记录为 selectionMode
- 首次读 v1 sources.json 时自动迁移到 v2, 保留所有原始 source 条目
- 不改变 update / uninstall / list 等命令的用户可见行为

**Non-Goals:**
- update / uninstall 使用 bundles 的逻辑 — w03
- 虚拟 group (`groups.json`) 的改动 — 不动, 和 bundle 是独立概念
- registry 包的 bundle 支持 — registry 一个包对应一个 skill, 不需要 bundle
- sources.json 外的其他配置文件 schema 变化 — 不动

## Decisions

### D1. bundles 与 sources 平级, 而不是嵌套

```jsonc
{
  "version": "2.0",
  "sources": { ... 不变 },
  "bundles": {
    "<bundleId>": {
      "type": "local-batch" | "git" | "zip",
      "url": "<string>",
      "selectionMode": "all" | "subset",
      "members": ["custom/spec-tdd/st-apply", ...],
      "installedAt": "...",
      "updatedAt": "..."
    }
  }
}
```

**备选**: 在每条 source 里加 `bundleId` 字段, 把 bundle 成员关系从 source 侧索引.

**理由**:
- 平级 section 让 bundle 的元数据 (url, selectionMode, timestamps) 只存一份, 不需要在 N 条 source 里重复
- 成员关系单向: bundle → members, 从 bundle 反查源, 从 source key 反查 bundle 在代码里做 (建一个 `Map<SourceKey, BundleId>` 缓存)
- 为 w03 加 `members` 的 diff 操作提供一个明确的操作对象

### D2. bundleId 的命名

`{type}:{normalizedUrl}`

示例:
- `local-batch:/Users/jtianling/workspace/jt-spec-tdd/skills/spec-tdd`
- `git:https://github.com/obra/superpowers`
- `zip:/Users/jtianling/Downloads/pack.zip`

**备选**: UUID / 递增整数

**理由**:
- 人类可读, 直接 grep 调试
- 同一 url 重复 install 总是同一个 bundleId, 幂等
- 规避了要维护递增计数器的复杂度
- URL 归一化规则与 w01 的 SourceResolver 保持一致 (去 `.git`, ssh↔https)

### D3. selectionMode 推断规则

install 时根据以下信号之一定为 `all` 或 `subset`:

| 信号 | selectionMode |
|---|---|
| `--all` flag | `all` |
| `-s/--skill name` 显式 | `subset` |
| 非交互 (install 命令发现只有 1 个可选) | `all` |
| 非交互 (install 命令发现所有可选都被默认选中) | `all` |
| 交互式全选 (用户回车前勾选了全部) | `all` |
| 交互式部分选 | `subset` |

**为什么需要改 prompt 返回类型**:
现在 `promptSkillsToInstall` 返回 `string[]` (被选中的 name 列表).  "用户是否全选了"这个信息丢了 — 即使用户确实全选, 和"install 命令自己填了所有 name" 从结果看是一样的.

方案: `promptSkillsToInstall` 返回 `{ names: string[], isAll: boolean }`. `isAll` 表示用户主动选择了所有可选项 (即使未来新增 skill, 用户的"全选"意图依然有效).

**备选**: 不记 selectionMode, update 时总是询问用户是否 sync 新成员.

**理由**: 询问模式对自动化场景 (CI 里运行 update) 不友好.  让用户一次 install 决定意图, 后续 update 静默按意图执行, 更符合 Unix 哲学.

### D4. Migration: v1 → v2 自动, 不需要用户手动干预

migration 时机: `SourcesService.load()` 读到 `version === '1.0'` (或缺失 version 字段) 时触发.

migration 逻辑:
1. 读取所有现有 sources 条目
2. 按 `(type, url, installMethod)` 聚合, 同一组的 source 视为同一个 bundle 的成员
3. 单成员组不建 bundle (单 skill install 不需要 bundle)
4. 多成员组建一个 bundle, selectionMode 一律设为 `all` (无历史信息, 保守假设用户装了全部)
5. bundleId 按 D2 规则生成
6. 写回 sources.json 为 v2 格式
7. 写入前做原子写 (写临时文件 + rename) 避免半写

**备选**: 留 v1 一直工作, 只有新 install 才生成 bundle.

**理由**:
- 如果旧数据不迁移, w03 的 update 行为就无法对旧 source 生效 — 用户装好的 19 个 spec-tdd 永远享受不到 group sync
- 迁移只加字段, 不动原有数据, 风险低
- `selectionMode: 'all'` 的默认对于旧的 batch install 几乎肯定是对的 (因为旧版本的 batch install 没有子选项, 总是装全部)

### D5. 向前兼容: 旧版本读 v2 会如何?

旧版本的 `SourcesService.load()` 按 v1 schema 解析, 会:
- 忽略 `bundles` 字段 (JSON parser 不报错)
- 读 sources 字段正常
- 如果旧版本写回 sources.json, 会以 v1 schema 写, **丢失 bundles 字段**

**缓解**:
1. 把 version bump 为 `'2.0'`, 旧版本读到更高 version 时可以显示友好错误 — 但旧版本不知道这个约定, 改不了旧版本
2. 在 README 和 CHANGELOG 强调: 升级后不要回退到旧版本
3. `SourcesService.load()` 在 v2 → v1 降级 (旧版本读 v2) 时无能为力, 但至少保证"同时运行新旧版本"不会崩
4. **决定**: 接受 bundles 可能被旧版本意外清空的风险.  一旦发生, 重新运行 install 就会重建 bundle 条目 (因为 install 是幂等的).

### D6. 不新增独立的 BundlesService

Bundle 的 CRUD 方法加到 `SourcesService` 上, 因为:
- Bundle 和 source 存储在同一文件, 分两个服务会有并发写问题
- Bundle 操作总是伴随 source 操作 (install 写 source 也写 bundle), 一个服务更方便原子化

**方法签名**:
```ts
class SourcesService {
  // 现有
  getAllSources(), addSource(key, info), removeSource(key), ...

  // 新增
  getAllBundles(): Record<string, Bundle>;
  getBundle(id: string): Bundle | undefined;
  addBundle(id: string, bundle: BundleInfo): void;
  updateBundleMembers(id: string, members: string[]): void;
  updateBundleTimestamp(id: string): void;
  removeBundle(id: string): void;
  findBundleByUrl(normalizedUrl: string, type: BundleType): Bundle | undefined;
}
```

### D7. install 命令的 bundle 写入时机

install 完成所有 skill 的拷贝和 source 记录后, 再写 bundle:
1. `installFromLocalDirBatch` 返回后, install.ts 拿到 `sourceKeys[]` + `batchGroupName`
2. 计算 bundleId
3. 调用 `sourcesService.addBundle(bundleId, { type, url, selectionMode, members: sourceKeys, ... })`

对 git 路径同理.  zip 路径暂不支持 update (现有行为), 但仍写 bundle (方便未来 uninstall batch).

**备选**: 在 install-local / install-git 内部直接写 bundle.

**理由**: install.ts 是总入口, 知道 `--all` / `-s` flag 和选择结果, 最适合决定 selectionMode.  内部函数只返回数据, 由总入口统一写元数据, 职责更清晰.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `promptSkillsToInstall` 返回类型变化会波及所有调用方 | 搜索所有调用点 (uninstall 交互, deploy 交互都用类似 prompt, 但分别是独立函数), 本 change 只改 install 路径的 prompt, uninstall 的 `promptSkillsToUninstall` 不动 |
| migration 执行失败导致 sources.json 损坏 | 原子写 (temp + rename); 失败时抛异常保留原 v1 文件; 测试覆盖 migration 的各种边界 |
| 单元测试里 sources.json 的 fixture 需要升级 | 保留一批 v1 fixtures 用于 migration 测试, 新测试用 v2 fixtures |
| 旧版本读 v2 会清空 bundles 字段 | 文档明确; install 幂等性让恢复成本低; 不阻塞本 change |
| bundleId 依赖 URL 归一化, w01 的归一化逻辑必须先落地 | w02 明确依赖 w01; w02 实现时复用 w01 的归一化函数 (不复制) |
| 同一路径被 install 两次 (一次 custom, 一次 community) 会造成 bundleId 冲突 | bundleId 包含 `type`, 不同 type 的 bundle 不冲突; 同 type 同 url 的二次 install 是 update, 合并到同一 bundle |
| `selectionMode: 'subset'` 的 bundle 在成员列表意外为空时如何处理 | 定义: 若 members 数组为空, w03 的 sync 跳过 |

## Migration Plan

1. **阶段 1: 类型定义 + SourcesService 扩展**
   - `src/types.ts` 新增 `Bundle`, `BundleInfo`, `BundleType`, `SelectionMode`
   - `SourcesService` 增加 bundles CRUD 方法
   - 不改 load/save 逻辑, 不动 version
   - 单元测试: 只测 CRUD, migration 阶段 2 再测

2. **阶段 2: Migration 逻辑**
   - `SourcesService.load()` 检测 version, 走 migration
   - 写回 v2 格式 (version 字段改为 `"2.0"`)
   - 单元测试: 给一批 v1 fixtures (单 skill, 多 skill batch, 混合), 验证迁移后 bundle 条目正确

3. **阶段 3: `promptSkillsToInstall` 签名变化**
   - 函数返回 `{ names: string[], isAll: boolean }`
   - 所有 install 路径的调用更新
   - 非 install 场景 (比如 uninstall 的 prompt) 不动 — 本 change 不碰

4. **阶段 4: install 写 bundle**
   - `install.ts` 在 skill 拷贝完成后写 bundle
   - selectionMode 从 `{ names, isAll }` + flag 推断
   - 测试: 给 mock 交互, 验证 bundle 被正确写入
   - 实机测试: 跑一次 `install ./spec-tdd`, 检查 sources.json 里有 bundle 条目

5. **阶段 5: 回归**
   - `pnpm test` 全部通过
   - `skillsmgr list` 等命令输出无变化
   - update / uninstall 行为无变化

**回退**: 如果 migration 出问题, 用户手动把 sources.json 的 version 字段改回 `"1.0"`, 删掉 bundles section 即可.  因为新版本的代码会再次触发 migration, 所以需要回退代码版本.

## Open Questions

1. **bundleId 里 URL 归一化要不要 lowercasing host?**
   `GitHub.com` vs `github.com` — 主流 git 托管 host 都是大小写不敏感, 建议归一化时全小写 host 部分.  影响 matching 精度, 不影响存储.

2. **migration 时遇到 source 条目 url 字段缺失 (旧 bug 写的坏数据) 怎么办?**
   现象: 一条 source 没有 url. 按 D4 的聚合逻辑, 它会单独成组 (url undefined), 单成员不建 bundle. 不影响其他条目.  建议: 记录 warning 但不阻塞 migration.

3. **zip bundle 的 update 语义到底是什么?**
   w02 写 zip bundle 主要为 w03 的 uninstall 批量删除用.  update zip 仍然是"manual reinstall" (现状).  w03 再议要不要支持"重新解压 zip".  本 change 只写 bundle, 不定义语义.

4. **Bundle 要不要有 `description` 或 `displayName` 字段?**
   未来 `skillsmgr bundle list` 命令需要展示给用户.  本 change 不加 — YAGNI. 等 w03 或后续 change 需要时再补.

5. **selectionMode 从 `all` 改为 `subset` 或反向的路径?**
   用户可能先 install 全选, 后来想改为 subset. 本 change 不支持修改 selectionMode. 如果需要, 用户可以 uninstall + reinstall. w03 或后续 change 可考虑加 `skillsmgr bundle set-mode` 命令.
