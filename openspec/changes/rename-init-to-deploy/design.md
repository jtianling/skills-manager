## Context

当前 CLI 有 `setup` 和 `init` 两个命令.  `setup` 创建 `~/.skills-manager/` 目录结构并复制 example skill; `init` 是交互式部署管理器.  问题: "init" 语义暗示一次性初始化, 但实际用途是反复运行的部署管理; `setup` 作为显式命令冗余(已被 `init`/`add` auto-trigger); example skill 对用户无明确价值.

## Goals / Non-Goals

**Goals:**
- `init` → `deploy` 重命名, 消除语义错位
- 移除 `setup` 显式命令, 减少命令表面积
- 所有命令统一 auto-setup, 任何命令首次使用都能正常工作
- 清理 example skill 模板

**Non-Goals:**
- 不改变 `deploy` (原 `init`) 的任何功能逻辑
- 不改变 auto-setup 的实际行为(创建目录结构), 只统一触发点
- 不做向后兼容别名 (不保留 `init` 作为隐藏别名)

## Decisions

### 1. 重命名策略: 文件级重命名

`init.ts` → `deploy.ts`, `init.test.ts` → `deploy.test.ts`.  函数名 `executeInit` → `executeDeploy`.  Commander 注册从 `init` 改为 `deploy`.

**理由**: 干净的重命名, 不留废弃代码.  由于是 CLI 工具 (非 API), 没有下游消费者需要兼容.

### 2. auto-setup 实现: 提取共享守卫函数

创建 `ensureSetup()` 函数(放在 `setup.ts` 中), 封装 "检查 `SKILLS_MANAGER_DIR` 是否存在, 不存在则执行 `executeSetup()`" 逻辑.  所有需要中央仓库的命令在 action handler 开头调用.

需要 auto-setup 的命令: `deploy`, `add`, `install`, `uninstall`, `update`, `list`, `remove`, `group`.

**理由**: 当前 `init.ts:69` 和 `add.ts` 各自内联了这段逻辑, 提取为共享函数消除重复.

### 3. setup 命令: 移除注册但保留模块

`setup.ts` 保留 `executeSetup()` 和 `ensureSetup()` 作为内部函数, 但不再导出 `setupCommand`.  从 `index.ts` 移除 `setup` 子命令注册.

**理由**: `executeSetup()` 仍被 `ensureSetup()` 调用, 模块本身有存在价值.

### 4. example skill: 直接删除

从 `executeSetup()` 中删除模板复制逻辑.  删除 `templates/example-skill/` 目录 (或同级的 dist 中打包的模板).  `setup` 完成后的提示文本更新为直接引导 `deploy`.

**理由**: example skill 不提供实际价值, 首次体验应引导用户安装 official skills.

## Risks / Trade-offs

- [Breaking change: `init` 命令不再存在] → 文档和任何引用 `skillsmgr init` 的地方需更新.  用户量小, 可接受.  `setup` 完成提示和错误提示中的 "Run: skillsmgr init" 全部改为 "skillsmgr deploy".
- [auto-setup 在非预期场景触发] → `ensureSetup()` 是幂等的(目录已存在则跳过), 无副作用风险.
