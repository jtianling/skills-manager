## Why

当前 `install` 和 `custom-install` 是两个独立命令, 分别处理远程和本地安装.  用户需要自行判断该用哪个命令, 且 `custom-install` 不写入 sources.json, 导致已安装的本地 skill 无法被 `update`/`uninstall` 统一管理.  此外, 用户需要从 zip 文件安装 skill 的场景(下载的 skill 包, GitHub release 附件等)目前完全不支持.

## What Changes

- **BREAKING**: 删除 `custom-install` 命令, 功能完全并入 `install`
- **BREAKING**: 去掉 official provider shorthand(不再支持 `skillsmgr install anthropic`, 改用 `anthropics/skills`)
- **BREAKING**: 去掉 provider alias 机制(不再支持 `skillsmgr install vercel` → `vercel-labs`)
- 统一 source 识别逻辑: 裸词优先解析为本地目录(`./name`), 含 `/` 的走 GitHub, `https://` 走远程
- 支持本地 zip 文件和远程 zip URL 安装
- 为 `install` 添加 `--group` (`-g`) 参数, 本地和远程都可用
- 所有安装方式统一写入 sources.json, zip 来源标记为不可 update

## Capabilities

### New Capabilities
- `zip-install`: 从本地 zip 文件或远程 zip URL 安装 skill, 包括下载/解压/扫描/安装流程
- `unified-source-detection`: 统一的 source 类型识别逻辑, 根据输入格式自动判断安装方式

### Modified Capabilities
- `source-management`: 所有安装方式(含本地目录和 zip)统一写入 sources.json, zip 标记不可 update
- `smart-add`: 路由逻辑简化, 不再区分 install 和 custom-install, 统一走 install
- `custom-install`: **删除** - 功能并入 install 命令, 不再作为独立命令存在
- `provider-alias`: **删除** - 不再支持 provider shorthand 和 alias 机制
- `official-registry`: 移除 shorthand 安装入口, 仅保留 owner/repo 和 URL 方式

## Impact

- **CLI 接口**: `custom-install` / `ci` 命令移除, 用户需改用 `install`
- **代码文件**: `src/commands/custom-install.ts` 删除, `src/commands/install.ts` 重构
- **source 追踪**: sources.json schema 扩展(新增 installMethod 字段)
- **add 命令**: `src/commands/add.ts` 路由逻辑简化
- **向后兼容**: 已通过 `custom-install` 安装的 skill 文件不受影响(仅在目录中), 但无 source 记录
