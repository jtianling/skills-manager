## Why

当前 custom local-batch 的"单元"在代码里有三份真相 (物理目录、bundle.members 快照、同名 auto-group), 彼此可能漂移.  用户在源目录里改 skill 名后, `uninstall ./path` 依赖 bundle.members ∩ 当前文件系统的交集, 改名前后共同存在的 skill 被列出, 改过名的既不列出也不清理, 导致卸载不完整、数据泄漏.  同时, group 在当前模型里只是"skill 的中间产品", 用户期望 group(物理 local-batch 单元 + 逻辑引用集合)成为一等公民, 可以直接按 group 名做 install/uninstall/update, 不必先转换到 skill 列表.

## What Changes

- 引入 "group 作为一等公民" 的统一概念: group 有两种 kind:
  - **物理 group** (`kind: 'local-batch'`): 有源路径 url, 有物理目录 `~/.skills-manager/custom/<name>/`, members 从物理目录**派生**不再持久化
  - **逻辑 group** (`kind: 'virtual'`): 无源无物理目录, members 显式维护于 groups.json, 跨源 (custom/official/community)
- **BREAKING**: local-batch 的 bundle entry 从 sources.json 的 `bundles` 迁到 groups.json, `bundles` 字段仅保留 git bundle.  下次 load 时自动一次性迁移
- **BREAKING**: 迁移时如果用户手工建的逻辑 group 和物理 group 同名, 逻辑 group 自动重命名为 `<name>-legacy` 并在迁移日志中提示
- **BREAKING**: 物理/逻辑 group 禁止同名.  `group create <name>` 如果和现存物理 group 同名 → 报错.  `install ./<path>` 如果 basename 和现存逻辑 group 同名 → 报错并引导用户先 `group rename`
- auto-group (install 时系统自建的同名 group) 概念废弃, 物理 group 本身即承载该语义
- uninstall 重写物理 group 卸载路径: 按 **物理目录扫描** 清单为准, 删整棵 `custom/<name>/`, 清 sources.json 里所有 `custom/<name>/*` key, 清 groups.json 里同名 group, 清其他逻辑 group 里对这些 key 的引用
- update 对物理 group: 扫源目录为权威, 自动 diff + 同步 (旧 `--sync` 行为成为默认).  保留 `--keep-local` 作为"保留本地孤儿"的 opt-in
- SourceResolver 扩展识别: bareword `<name>` 和 `custom/<name>` 均可解析到 group, 支持物理和逻辑两种
- `group` 子命令扩展一等公民 API: `group install <path|url>`, `group uninstall <name>`, `group update <name>`, `group rename <old> <new>`.  `install` / `uninstall` / `update` 顶层命令保留, 对 local-batch 语义等价于 `group install/uninstall/update`
- `install --group <name>` 明确限定为"加到**逻辑** group", 文档中点明
- `group update <name>` 对逻辑 group: 遍历每个 member, 调用对应源的 update 路径
- 新增 `SKILLS_MANAGER_DIR/custom/<name>/` 的 "只有该物理 group 拥有该目录" 边界: 目录内所有 skill 被视为单元内成员, uninstall 会整体清除 (即使某 skill 手动放入且未在 sources.json 登记)

## Capabilities

### New Capabilities

- `group-as-first-class-unit`: 物理/逻辑 group 的统一模型、存储格式、命名冲突规则、迁移策略、SourceResolver 识别扩展, 以及 `group install/uninstall/update/rename` 一等公民 API.

### Modified Capabilities

- `virtual-group`: groups.json 存储格式扩展, 每个 group 增加 `kind` 字段 ('virtual' | 'local-batch'), 物理 group 增加 `url`、`installedAt`、`updatedAt` 字段.  GroupsService 新增 `kind` 查询、物理 group 生命周期 API
- `uninstall`: 按 group 卸载的物理目录为权威扫描策略, 替代当前 bundle.members 交集.  顶层命令识别 group 名 (bareword / `custom/<name>`) 作为卸载目标.  bundleManager.remove 对 local-batch 路径废弃, 由新的 group-uninstall 路径替代
- `local-update`: local-batch 更新以源目录为权威, 自动增删 members, 默认行为等同原 `--sync`.  `--keep-local` 保留本地孤儿的 opt-in.  逻辑 group update 遍历 member 源的 update 路径
- `source-management`: sources.json 的 `bundles` 字段仅保留 git bundle, local-batch bundle 迁移到 groups.json.  sources.json 的 local-batch migration 流程 (V2→V3)
- `install-directory-batch`: 批量安装路径语义上等价于"创建物理 group", 与 group install 对齐.  冲突检测扩展: 除同 basename 不同 URL 外, 新增"basename 与现存逻辑 group 冲突"的检测

## Impact

### 代码
- `src/services/sources.ts`: sources.json schema 升级到 V3, 迁移逻辑 (V2→V3) 把 local-batch bundle 移出 bundles 字段
- `src/services/groups.ts`: groups.json schema 扩展, 区分 kind, 新增物理 group 生命周期方法.  迁移逻辑处理"手工逻辑 group 撞名物理 group" 重命名为 `<name>-legacy`
- `src/services/source-resolver.ts`: `resolveBareword` 与 `resolveOwnerRepo` (对 `custom/<name>`) 扩展识别 group.  新增 `group` kind 的 ResolvedTarget
- `src/services/bundle-manager.ts`: local-batch 路径在 uninstall/update 中不再走 `bundles` 表, 由新的 group-manager 路径接管 (git bundle 继续)
- `src/services/group-manager.ts` (新): 物理 group 的 install/uninstall/update/rename, 以物理目录为真
- `src/commands/uninstall.ts`: bundle 分支对 local-batch 走 group 路径, 物理目录扫描为准
- `src/commands/update.ts`: local-batch 分支改默认 sync 语义, 新增 `--keep-local` 开关
- `src/commands/install.ts` / `install-local.ts`: 批量安装路径走 group create; 冲突检测扩展
- `src/commands/group.ts`: 新增 `group install/uninstall/update/rename` 子命令
- `src/utils/source-detection.ts`: 不需改动 (`custom/<name>` 仍走 owner-repo 模式, 由 resolver 内部分流)

### 数据 / 存储
- `~/.skills-manager/sources.json`: `version` 升到 `'3.0'`.  `bundles` 字段仅包含 `git` 和 `zip` 类型, `local-batch` 条目被移除
- `~/.skills-manager/groups.json`: 格式扩展, 每项从 `string[]` 升级为 `{ kind, members?, url?, installedAt?, updatedAt? }`.  向后读取旧格式兼容

### 用户可见行为
- `skillsmgr uninstall tdd-spec` 现在能识别物理 group 名, 卸载更完整 (基于物理目录扫描)
- `skillsmgr uninstall custom/tdd-spec` 不再报 "No installed source found"
- `skillsmgr update ./tdd-spec` 默认以源目录为真自动同步 (改名的 skill 自动被 add/remove)
- 用户现有的 `groups.json` 在下次命令运行时被迁移, 如有命名冲突, 冲突的逻辑 group 被重命名为 `<name>-legacy`, 终端打印迁移摘要

### 测试
- 新增 `group-manager.test.ts`, 覆盖物理 group install/uninstall/update/rename
- 扩展 `uninstall.test.ts` / `update.test.ts` 覆盖改名场景
- 新增迁移测试, 验证 V2→V3、旧 groups.json → 新格式、命名冲突处理
- E2E: 用户场景完整复现 (install → 改名 skill → uninstall → 验证零残留)
