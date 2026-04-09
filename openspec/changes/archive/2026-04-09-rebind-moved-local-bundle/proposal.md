## Why

本地 skill 的 identity 是绝对路径, 用户一旦移动目录就无法 `update`/`uninstall` 已安装的 skill.  目前要么报 "No installed skill found from path", 要么 `uninstall tdd-spec` 因为 bareword 解析不认 batch bundle 的子目录名而报 "Skill not found".  用户被迫手改 `sources.json` 或逐个 `uninstall --skill`, 体验很差.  本地 skill 的命名由用户掌握, 改位置是常见操作, 工具应该基于 basename 自动识别 "还是同一个 skill 搬家了" 并在用户确认下修正路径.

## What Changes

- `install ./local` **BREAKING**: 发现同 basename 但不同 URL 的 local-copy source 或 local-batch bundle 时, 不再悄悄复用或写入脏数据, 而是报错引导用户用 `update ./new-path` 搬家
- `update ./local` 新增 basename fallback: 精确路径匹配失败 + 旧 URL 路径已失效时, 按 basename 在 local-copy source 和 local-batch bundle 中查找唯一匹配
- `update ./local` 新增 rebind 交互: fallback 命中后 prompt 用户确认, 同意则就地改写 `sources.json` 里的 bundle URL/key 和所有 member 的 `source.url`, 然后继续正常 update 流程
- `update ./local` rebind 前做类型校验: 单 skill 只能 rebind 到单 skill, batch 只能 rebind 到 batch, 类型不一致拒绝
- `update ./local` 支持 `-y` / `--force` 跳过 rebind prompt
- 历史脏数据(同 basename 多个 bundle)在 rebind 查找时报错列出候选, 让用户手动清理
- `uninstall`, `add`, `deploy`, `bareword update` 等命令**不做改动**, 维持现有行为

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `custom-install`: 新增单 skill 的重名冲突检测, 拒绝不同 URL 的同名 install
- `install-directory-batch`: 新增 batch bundle 的重名冲突检测, 拒绝不同 URL 的同名 batch install
- `local-update`: 新增 basename fallback + rebind 流程, 覆盖"旧路径失效 + 新路径匹配"的搬家场景

## Impact

- `src/services/source-resolver.ts`: `resolveLocalPath` 增加 basename fallback 分支, 类型校验, 多匹配报错
- `src/services/sources.ts`: 新增 rebind 方法 (重写 bundle URL/key + member URL 的事务性操作), 新增按 basename 查找 local bundle/source 的辅助方法
- `src/commands/install-local.ts`: `installFromLocalDir` 和 `installFromLocalDirBatch` 增加重名冲突检测
- `src/commands/update.ts`: `executeUpdateWithOptions` 在 not-found 分支前处理 rebind prompt 和事务性重写
- `src/utils/url-normalize.ts`: 可能需要辅助函数获取路径 basename (复用已有 `normalizeLocalPath`)
- 测试: `install-local.test.ts`, `update.test.ts`, `source-resolver.test.ts` 新增重名拒绝/rebind 接受/rebind 拒绝/类型不匹配/多匹配/旧路径仍存在不触发 等用例
- 不影响远程 (git/registry/zip) source 流程
- 不影响 `uninstall`, `add`, `deploy` 命令
