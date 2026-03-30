## Why

`install` 和 `update` 对裸词输入的语义不一致: `install foo` 解析为本地目录 `./foo`, 而 `update foo` 按已安装 source 名查找.  这增加了用户心智负担.  同时 `update` 不支持 local-copy 来源的更新, `custom-update` 作为遗留命令仍在注册但功能重叠.

## What Changes

- **BREAKING**: `install` 不再将裸词解析为本地目录, 本地路径需显式 `./`, `../`, `~/`, `/` 前缀
- **BREAKING**: 删除 `custom-update` / `cu` 命令, 功能并入 `update`
- `update` 支持 local-copy 来源: 从 sources.json 记录的原始路径重新对比/拷贝
- `update` 接受本地路径参数 (`./skill`, `/abs/skill`): 按路径匹配已安装 source 并更新
- `detectSourceType` 移除裸词→本地路径的 fallback, 未识别格式返回 `'unknown'`

## Capabilities

### New Capabilities
- `local-update`: update 命令对 local-copy 来源的更新支持, 包括全量更新和按路径指定更新

### Modified Capabilities
- `unified-source-detection`: 移除裸词→本地路径 fallback, 未识别格式返回 unknown
- `source-management`: update 流程中 local-copy 来源从"跳过"改为"从原始路径对比更新"
- `custom-update`: **删除** - 功能并入 update 命令

## Impact

- **CLI 接口**: `install foo` 不再工作(需 `install ./foo`), `custom-update` / `cu` 移除
- **代码文件**: `src/utils/source-detection.ts` 修改, `src/commands/update.ts` 重构, `src/commands/custom-update.ts` 删除
- **index.ts**: 移除 custom-update 注册
- **测试**: source-detection, update, install 测试需更新
