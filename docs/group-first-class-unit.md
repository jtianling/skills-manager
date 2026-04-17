# Group 一等公民模型

`skillsmgr` 现在把 group 作为一等公民单元, 同时支持 `physical group` 和 `virtual group` 两种类型。  

## 两种 group

- `physical group`: 对应一个本地批量目录, 例如 `skillsmgr install ./tdd-spec` 安装后的 `spec-tdd`。  它拥有源路径 `url`, 拥有 `~/.skills-manager/custom/<name>/` 目录, 成员实时从物理目录派生。
- `virtual group`: 纯元数据集合, 成员保存在 `groups.json`, 可以跨 `official`, `community`, `custom`, `registry` 混合引用。

两种 group 共用同一个命名空间, 不允许同名。  当旧数据迁移时遇到冲突, 系统会把已有 virtual group 重命名为 `<name>-legacy[-N]`, 并把日志写到 stderr 和 `~/.skills-manager/migration.log`。

## 常用命令

- `skillsmgr install ./dir`: 安装 physical group。
- `skillsmgr update <group-or-source>`: 如果输入命中 physical group, 默认以源目录为真同步。  需要保留本地孤儿成员时, 使用 `--keep-local`。  单个本地 skill 必须用 `skillsmgr update ./path` 显式传入源目录。
- `skillsmgr uninstall <group-or-source>`: 如果输入命中 physical group, 会按物理目录 + `sources.json` 记录的并集做清理。
- `skillsmgr group install ./dir`: physical group 的显式入口。
- `skillsmgr group update <name>`: physical group 走目录同步, virtual group 逐个 member 分发到各自的 update 路径。
- `skillsmgr group uninstall <name>`: 仅用于 physical group。  virtual group 请使用 `skillsmgr group delete <name>`。
- `skillsmgr group rename <old> <new>`: physical group 会同步重命名物理目录, `sources.json` key, 以及所有 virtual group 中的引用。

## 存储边界

- `groups.json`: 保存 group 元数据。  physical group 只保存 `kind`, `url`, `installedAt`, `updatedAt`。  virtual group 保存显式 `members`。
- `sources.json`: 只保存 git/registry/zip source 元数据, 以及 git/zip bundle。  `local-batch` 不再写入 `bundles`, 顶层单个本地 skill (`custom/<name>`) 也不再写入 `sources.json`。
- `~/.skills-manager/custom/<name>/`: physical group 拥有的目录边界。  不要手动塞入无关文件或无关 skill, 否则 update 和 uninstall 会把它们视为该 physical group 的成员。

## 兼容与迁移

- V1 `groups.json` 会自动升级到 V2 schema。
- V2 `sources.json` 中的 `local-batch bundle` 会自动迁移为 physical group。
- `skillsmgr update ./new-path/<same-name>` 可以在旧路径丢失后触发 rebind, 更新 physical group 的 `url` 和对应 `custom/<group>/*` source 记录。
- 单个本地 skill 改为以磁盘为唯一真相源。  `skillsmgr install ./path` 不再写入 `sources.json`, 裸 `skillsmgr update` 也不会更新它们, CLI 会提示改用 `skillsmgr update ./path`。
