# CLI 工具通用规范

skills-manager 沉淀下来的通用 CLI 工程规范, 供新建 Node/TS CLI 工具的 agent 参考.  与 skills 领域强相关的设计(中央仓库三源/虚拟 group/symlink bridge 等)不在此列, 那些不要照搬.

本文件的代码片段都能在本仓库找到 canonical 实现, 引用时优先看真实源码: `src/commands/login.ts`, `src/services/auth.ts`, `src/services/deployment-manifest.ts`, `src/utils/json-output.ts`, `src/services/rollback.ts`.

---

## 1. 分层架构 (强约束)

```
src/
  index.ts        仅注册 commander 子命令, 不写逻辑 (skillsmgr 里只有 ~55 行)
  constants.ts    常量 (URL / 目录路径), 杜绝散落硬编码
  types.ts        共享类型
  commands/*.ts   CLI 层: 解析 flags / 驱动 service / 处理交互与输出
  services/*.ts   业务逻辑 + 存储, 一个 service 一个领域 (可单测)
  utils/*.ts      纯函数工具
  tools/*.ts      领域常量 / 元数据
```

铁律: index 只装配 -> commands 编排 -> services 干活 -> utils 纯函数.  命令层**不写业务逻辑**, 全部下沉到 service, 这样逻辑可被单测覆盖, 也可被多个命令复用.  新增功能从下往上写, 从上往下调.

文件 200-400 行为宜, 最多 800.  大命令按维度拆子文件 (如 install 按来源拆成 install-git / install-local / install-registry / install-utils).

---

## 2. 命令对称性 (最易踩的坑)

正向命令与反向命令的能力必须对称.  给正向命令新增参数格式 / 匹配方式 / 功能时, **必须同步修改对应反向命令**.

| 正向 | 反向 |
| --- | --- |
| install | uninstall |
| add | remove |
| publish | (撤销 / unpublish) |

例外: 反向命令操作对象已在本地, 可用更简化输入 (如 uninstall 只需 name, 因为已安装项可由名称唯一定位).

提交前自查: 本次改动涉及的每个正向命令, 其反向命令是否已同步.  skillsmgr 多个历史 bug (`--from` / bare group name / owner/repo 匹配) 都源于只改了一边.

---

## 3. CLI 接口设计

- **`--json` 模式必须彻底跳过所有交互 prompt**.  统一一个出口:
  ```ts
  export function jsonOutput(data: unknown): void {
    process.stdout.write(JSON.stringify(data) + '\n');
  }
  export function jsonError(message: string, code: string): void {
    jsonOutput({ error: message, code });
  }
  ```
  错误也走 JSON, 带机器可读的 code 字段.

- **跳过所有 prompt 用独立的 `-y` flag**, 不要复用其它语义.

- **选择/确认类交互优先 `confirm` 而非 `list`**, 列表型交互在部分终端体验差.

- **Ctrl-C 优雅退出**: inquirer 抛 `ExitPromptError` 时打印 "Cancelled." 并 `exit(0)`, 不要当异常崩栈.
  ```ts
  export function handlePromptError(error: unknown): never {
    if (error && typeof error === 'object' && 'name' in error) {
      if (error.name === 'ExitPromptError') {
        console.log('\nCancelled.');
        process.exit(0);
      }
    }
    throw error;
  }
  ```

---

## 4. 认证: browser device-flow + 轮询

CLI 给"有网站"的服务做登录, 首选浏览器 device-flow, 不要在 CLI 里收账号密码.

流程:
1. `login` 生成 `sessionId` (randomUUID), `open` 浏览器到 `${SITE}/cli-auth?session=<id>`.
2. CLI 端 `pollForToken(sessionId)`: 每 2s 轮询 `${SITE}/api/cli-auth/poll?session=<id>`, 5 分钟超时.
3. 状态机: `pending` 继续轮询, `complete` 返回 {token, username}, `consumed`/`expired` 抛终态错误.  404 = 浏览器还没建会话, 继续等.  网络抖动继续轮询, 只有终态错误才抛.
4. 拿到 token 后落盘 `~/.<tool>/auth.json`, **`chmodSync(file, 0o600)`**.

`--token` 走三路兜底 (CI 友好): 环境变量 -> stdin 管道 -> 交互掩码输入 (`type: 'password', mask: '*'`).  **token 永远不进 CLI 明文参数** (会落 shell history).

auth 读取要容错: 文件不存在 / 解析失败 / 字段缺失一律返回 null, 不抛.

服务端需配套两个端点: 登录页 `/cli-auth?session=` 和轮询 `/api/cli-auth/poll?session=` (返回 {status, token?, username?}).

完整实现见 `src/commands/login.ts` 与 `src/services/auth.ts`.

---

## 5. 与远端交互 (提交本地资源)

无论提交的是打包目录还是结构化 JSON 元数据, 这四点通用:

- **鉴权头统一**: registry client 里一律 `Authorization: Bearer ${getToken()}`, 未登录先报错引导 `login`.
- **强制当前用户 scope**: 提交前从 token 解析出 username, 把 payload 里的 owner/scope 字段强制覆写成当前用户, **不信任客户端传入**, 防冒名.
- **not-found vs 真错误的边界**: 检查"是否已存在"时, 只把 404 / "not found" 当作不存在, 其它 (网络错误 / 5xx) 必须 rethrow, 不能静默当成"不存在"继续.
- **进出 schema 校验**: payload 进出系统边界都用 schema (zod 之类) 校验.

打包目录的场景 (skillsmgr publish): `tar czf` 排除 node_modules/.git/.DS_Store, base64 塞请求体, 临时目录 `mkdtempSync` + finally `removeDir` 清理.  结构化 JSON 场景更简单: 校验 schema -> 带鉴权头 POST -> 处理 409 冲突 / 422 校验失败.

---

## 6. 存储与数据

- **磁盘是唯一真相源 (disk-as-truth)**: 状态从实际文件 / 目录扫描得出, 索引文件只是缓存, 能从磁盘重建.
- **JSON 存储带 schema version**, 预留迁移路径.
- **原子落盘**: 写临时文件 + rename, 避免半写状态.
  ```ts
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmp, path);
  ```
- **per-project 状态文件要 gitignore** (如 skillsmgr 的 `skillsmgr-deploy.json`), 不 commit.
- **不可变性**: 创建新对象, 不原地 mutate.
- **边界 schema 校验**: 所有外部数据 (用户输入 / 文件内容 / 网络) 在系统边界用 schema 校验, 显式处理错误, 不静默吞.

---

## 7. 错误处理与回滚

- **多步副作用操作要能 rollback**: 写文件 / 建符号链接这类操作, 失败时把已写入的路径和索引项都清掉.  见 `src/services/rollback.ts`.
- **teardown / 清理路径用 `console.warn` 不用 throw**: 删除不存在的资源 / 清理失败等, warn 后继续, 别让清理失败炸掉主流程.
- 显式处理每一层错误, 错误信息带 `error instanceof Error ? error.message : error` 兜底.

---

## 8. 测试规范

- **E2E 优先于手动步骤**: 要验证功能就写 / 跑 e2e, 不要给用户递多步 shell recipe.  隔离 HOME (沙箱 `~/.<tool>`) + vitest, build + 跑单文件约 10-15s.
- **无副作用验证 (关键)**: 断言目标结果正确之外, 还要断言**非目标未受影响** —— install 一个后验证没多出别的, remove 一个后验证其它还在.
- **TDD**: 先写失败测试 -> 最小实现 -> 重构.  命名 `test_[function]_[scenario]_[expected]`, 结构 Arrange-Act-Assert.
- 测试代码只放 `*.test.ts` 或 `e2e/`, 不混进产品代码.
- 真实 fixture 测试用 `describe.skipIf(!FIXTURE_AVAILABLE)` 守卫, 避免 CI 误红.
- **资源清理纪律**: 每个 `tmux new-session` 配对 `kill-session` (失败路径也走); 临时目录用实例字段存, 在 destroy/cleanup 里 `rmSync`; destroy 幂等可重入; 默认"进程总有一天会异常退出"来设计清理.

---

## 9. 代码风格

- 行宽 <= 88, 函数 < 50 行, 文件 < 800 行, 嵌套 <= 3 层, 无硬编码.
- DRY & YAGNI: 三次重复再抽象, 只为当前需求编码.
- 先搜已有代码 -> 复用已有模式 -> 最小变更 -> 不投机加功能.
- 代码注释 / docstring 用英文, 只写意图性注释, 不写解释性注释.  代码里字符串标点用英文.
- 正式文档 -> `docs/`, 讨论文档 -> `discuss/`.  `.md` 用中文, 标点用英文 (逗号后一空格, 句号后两空格).
- Commit: `<type>: <subject>` (祈使句, subject <= 50 字符, 一次一个逻辑变更).  Types: feat / fix / docs / style / refactor / test / chore.
