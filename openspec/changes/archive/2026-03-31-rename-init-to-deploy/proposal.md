## Why

`init` 命令的实际功能是交互式部署管理(可反复运行来调整部署状态), 但 "init" 在 CLI 惯例中意味着一次性初始化(如 `git init`, `npm init`), 语义错位.  同时 `setup` 作为显式命令没有存在的必要, 因为首次使用任何命令时都会自动触发.  `setup` 中复制的 example skill 对用户来说不明所以, 徒增困惑.

## What Changes

- **BREAKING**: `init` 命令重命名为 `deploy`, 保留所有现有功能(交互式选择 agent/skill, `-g/--global`, `--copy`)
- 移除 `setup` 显式命令, 不再注册为 CLI 子命令
- 所有依赖 `~/.skills-manager/` 的命令统一添加 auto-setup 守卫(目前仅 `init` 和 `add` 有, `install`/`list`/`uninstall`/`remove`/`update`/`group` 缺失)
- `executeSetup()` 中移除 example skill 模板复制逻辑, 删除 `templates/example-skill/` 目录
- `setup` 完成后的 "Next steps" 提示内容相应调整(使用 `deploy` 而非 `init`)

## Capabilities

### New Capabilities

- `auto-setup`: 所有 CLI 命令统一的自动初始化守卫, 确保 `~/.skills-manager/` 目录结构在首次使用任何命令时自动创建

### Modified Capabilities

- `cli-interaction`: `init` 子命令重命名为 `deploy`, `setup` 子命令移除

## Impact

- **命令入口**: `src/commands/init.ts` → `src/commands/deploy.ts`, `src/commands/setup.ts` 移除显式命令注册
- **CLI 注册**: `src/index.ts` 或主入口文件中的命令注册需更新
- **内部引用**: `add.ts` 等文件中 `import { executeInit } from './init.js'` 需更新
- **测试文件**: `init.test.ts` → `deploy.test.ts`, `setup.test.ts` 更新
- **模板文件**: `templates/example-skill/` 目录可删除
- **文档/输出**: 所有 console.log 中引用 `init`/`setup` 的提示文本需更新为 `deploy`
- **用户影响**: 已习惯 `skillsmgr init` 的用户需改用 `skillsmgr deploy`, 这是 breaking change
