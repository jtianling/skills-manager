## Why

local-copy skill 当前同时被记录在磁盘 (`~/.skills-manager/custom/<name>/`) 和 `sources.json` 两处, 两份真相会漂移.  用户机器上实测已有 12 个孤儿: 磁盘有 SKILL.md 但 sources.json 没条目, 导致 `install ./path` 提示"already exists"而 `update ./path` 报"not found".  既然用户更新本地 skill 的习惯一定是 `skillsmgr update ./path` (自己带上原始路径), 系统记住这个路径就是冗余的.  移除本地 skill 的 sources.json 记录, 让磁盘成为唯一真相源, 漂移在结构上变为不可能.

## What Changes

- **BREAKING** `install ./path` 不再向 `sources.json` 写入 `installMethod: 'local-copy'` 条目; 只拷贝到 `custom/<name>/`
- **BREAKING** `install` 移除"同名不同 URL 时报冲突"的检查 (没有记录的 URL 可以对比); 已存在目录时走 overwrite 提示, 不再基于 URL 区分 rebind 与冲突
- **BREAKING** `update ./path` 通过扫磁盘解析目标 (`custom/<basename(path)>/SKILL.md` 是否存在), 不读 sources.json; 不存在则提示"先 install"
- **BREAKING** 裸 `update` 命令跳过所有 local-copy skill, 只更新 git 类型 source; 结尾打印一行 "N 个本地 skill 已跳过 (用 skillsmgr update ./path 更新)"
- `uninstall <name>` 对 local skill 通过扫磁盘解析, 不再查 sources.json; 清理 groups.json 引用的逻辑保留
- `list` 对 local skill 通过扫磁盘枚举, git skill 仍读 sources.json
- `group add / group remove / deploy / remove` 等命令解析 `custom/<name>` key 时改为扫磁盘验证, 不依赖 sources.json 条目
- sources.json 里残留的 `installMethod: 'local-copy'` 条目: 读路径忽略, 下次写入时被自然过滤 (无迁移命令, 无 doctor 命令)
- groups.json 悬空引用 (指向磁盘不存在的 skill): 延用当前"读时跳过并警告"语义, 不变

## Capabilities

### New Capabilities

(无新增, 本变更是对既有能力的结构性调整)

### Modified Capabilities

- `custom-install`: 移除 sources.json 写入和 URL-mismatch 冲突检测; overwrite 提示保留但不再按 URL 区分
- `local-update`: 解析改为磁盘扫描; 裸 update 跳过本地; 移除"记录 url 以便回读"语义
- `source-management`: `sources.json` 不再追踪 `installMethod: 'local-copy'` 条目; 定义过滤读策略和自然清理写策略
- `uninstall`: local skill 的解析改为磁盘扫描, 删除 sources.json 清理步骤
- `custom-skill-lookup`: 确认按名字扫磁盘查找 (与现有行为一致, 但升级为权威路径, 不再是 sources.json 的补充兜底)

## Impact

- **代码**: `src/commands/install.ts`, `install-local.ts`, `install-utils.ts`, `update.ts`, `uninstall.ts`, `list.ts`, `deploy.ts`, `remove.ts`, `group.ts`; `src/services/source-resolver.ts`, `source-updater.ts`, `sources.ts`, `group-manager.ts`
- **测试**: 上述命令的现有单测/e2e 测试需要更新断言; 新增测试覆盖"磁盘有 sources 没"的零元数据路径
- **用户数据**: 现存 `sources.json` 中的 local-copy 条目被静默忽略并在下次写入时清除, 用户无感知; 磁盘上的 custom skill 目录不动
- **文档**: `docs/` 里涉及本地 skill 生命周期的描述需要同步
- **依赖**: 无新增依赖
- **兼容**: 裸 `skillsmgr update` 行为改变 (不再更新本地), 属于 BREAKING; 新版本的 release notes 需要明确说明

## Out of Scope

- git 安装 (community/, official/, registry, zip) 的 sources.json 追踪不变, 留给未来的变更处理 (例如从 `.git/config` 读取 origin)
- 不引入 `.skillsmgr-origin.json` 或任何 per-skill 元数据文件
- 不引入 `skillsmgr doctor` / 诊断命令
- bundles 表中 git 类型 bundle 保持原样, 不改 local-batch 物理组 (物理组成员天然来自磁盘, 已符合磁盘为真的语义)
