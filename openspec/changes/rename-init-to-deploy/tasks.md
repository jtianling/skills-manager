## 1. init → deploy 重命名

- [x] 1.1 `src/commands/init.ts` → `src/commands/deploy.ts`, 函数名 `executeInit` → `executeDeploy`, `executeInitGlobal` → `executeDeployGlobal`, Commander 注册 `init` → `deploy`
- [x] 1.2 `src/commands/init.test.ts` → `src/commands/deploy.test.ts`, 更新测试中所有 init 引用
- [x] 1.3 更新 `src/commands/add.ts` 中 `import { executeInit } from './init.js'` → `import { executeDeploy } from './deploy.js'` 及调用处

## 2. setup 命令移除 + auto-setup 统一

- [x] 2.1 在 `src/commands/setup.ts` 中添加 `ensureSetup()` 共享函数, 移除 `setupCommand` 导出
- [x] 2.2 从 `src/index.ts` (或主入口) 移除 `setup` 命令注册, 更新 `init` → `deploy` 注册
- [x] 2.3 所有命令添加 `ensureSetup()` 调用: `install.ts`, `uninstall.ts`, `update.ts`, `list.ts`, `remove.ts`, `group.ts` (deploy 和 add 已有, 改为用共享函数)

## 3. 清理 example skill

- [x] 3.1 从 `executeSetup()` 中删除 example skill 模板复制逻辑
- [x] 3.2 删除 `templates/example-skill/` 目录 (及打包配置中的相关引用)
- [x] 3.3 更新 `executeSetup()` 中 "Next steps" 提示: `init` → `deploy`, 移除 setup 相关引用

## 4. 提示文本全面更新

- [x] 4.1 全局搜索代码中所有 `skillsmgr init`/`skillsmgr setup` 字符串, 替换为 `skillsmgr deploy`
- [x] 4.2 更新 `src/commands/setup.test.ts` 测试(如果存在)适配新逻辑

## 5. 验证

- [x] 5.1 运行全量单元测试, 确认无回归
