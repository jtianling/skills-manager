## ADDED Requirements

### Requirement: --from 选项接受 collection ref
`install` / `add` / `remove` / `uninstall` 命令 SHALL 提供 `--from <ref>` 选项，参数接受 collection ref。ref 形式 SHALL 支持 `@owner/slug`、`owner/slug`（无 `@`）、`skillsmgr.dev/c/@owner/slug`、完整 URL。

#### Scenario: 使用 @owner/slug 形式
- **WHEN** 用户执行 `skillsmgr install --from @alice/kit`
- **THEN** CLI SHALL 把 ref 传给服务端 `POST /api/collections/resolve`
- **THEN** 服务端返回 members 后逐个安装

#### Scenario: 使用 URL 形式
- **WHEN** 用户执行 `skillsmgr install --from https://skillsmgr.dev/c/@alice/kit`
- **THEN** CLI SHALL 剥离 host 后得到 `@alice/kit` 并请求 resolve
- **THEN** 行为与直接传 `@alice/kit` 一致

#### Scenario: 使用无 @ 形式
- **WHEN** 用户执行 `skillsmgr install --from alice/kit`
- **THEN** CLI SHALL 补 `@` 前缀后交由服务端规范化
- **THEN** 行为与 `@alice/kit` 一致

### Requirement: 服务端 warning 透传
服务端返回的 `warnings` 数组 SHALL 逐条全部打印给用户。

#### Scenario: 含 private-skipped warning
- **WHEN** collection 含当前 viewer 无权访问的 private 包
- **THEN** 服务端返回 `{ kind: "private-skipped", detail: <pkg name> }` warning
- **THEN** CLI SHALL 打印 `⚠ Skipped private package <pkg> (no access)`

#### Scenario: 含 cycle warning
- **WHEN** collection extends 存在循环
- **THEN** CLI SHALL 打印 `⚠ Cycle detected in extends chain: <detail>`

### Requirement: Members 批量安装
解析得到 members 后，CLI SHALL 按顺序逐个调用 registry 安装。每个 member 按 `packageName` + `pinnedVersion`（或 `latest`）下载。

#### Scenario: 多 member 全部成功
- **WHEN** collection 返回 3 个 members 且 registry 均可访问
- **THEN** CLI SHALL 依次安装 3 个包
- **THEN** 输出每个包的安装结果

#### Scenario: 单 member 失败不阻塞
- **WHEN** 3 个 members 中第 2 个安装失败（registry 404）
- **THEN** CLI SHALL 继续安装第 3 个
- **THEN** 汇总输出标记第 2 个为失败

### Requirement: 空 collection 提示
如果服务端返回 members 为空数组，CLI SHALL 打印提示并以 exit 0 退出。

#### Scenario: 空 collection
- **WHEN** `skillsmgr install --from @alice/empty`
- **THEN** CLI SHALL 打印 `Collection '<ref>' is empty.` 并 exit 0

### Requirement: 鉴权与私有 collection
当本地存在 auth token（`readAuth()` 返回非空）时，请求 resolve endpoint SHALL 附加 `Authorization: Bearer <token>` 头，以便服务端按 viewer 身份过滤 private 包。

#### Scenario: 已登录用户请求
- **WHEN** 用户已 `login`，执行 `skillsmgr install --from @me/private-kit`
- **THEN** CLI 请求 SHALL 带 token
- **THEN** 服务端能返回用户自己的 private 包

#### Scenario: 未登录用户请求 private collection
- **WHEN** 未登录用户请求含 private 包的 collection
- **THEN** CLI 不带 token
- **THEN** private 包被服务端过滤，返回 warning

### Requirement: --group 组合
`--from` SHALL 可以和 `--group <name>` 组合使用，所有成功安装的 skill 加入同一 group。

#### Scenario: 装 collection 到指定 group
- **WHEN** 执行 `skillsmgr install --from @alice/kit --group my-tools`
- **THEN** collection 里所有成功安装的 skill SHALL 加入 `my-tools` group

### Requirement: JSON 输出
`--from` 配合 `--json` SHALL 输出结构化结果。install/add 时为 `{ collection, members, installed, failed, warnings }`；remove/uninstall 时为 `{ collection, members, removed, failed, warnings }`。

#### Scenario: JSON 模式
- **WHEN** 执行 `skillsmgr install --from @alice/kit --json`
- **THEN** stdout SHALL 输出 JSON 包含 collection ref、resolved members、install 结果、warnings

### Requirement: remove --from 批量取消部署
`skillsmgr remove --from <ref>` SHALL 从当前项目的 `.agents/skills/` 取消部署 collection 中所有 members。未部署的 member 跳过。

#### Scenario: Collection 中部分 member 已部署
- **WHEN** 当前项目部署了 collection 里的 3 个包中的 2 个
- **THEN** `remove --from <ref>` SHALL 取消部署 2 个已部署的
- **THEN** 未部署的 1 个 SHALL 被跳过，不报错

#### Scenario: 单个 member 移除失败不阻塞
- **WHEN** 批量 remove 中某个 member 因文件权限错误失败
- **THEN** 其他 member SHALL 继续处理，汇总报告失败项

### Requirement: uninstall --from 批量完全删除
`skillsmgr uninstall --from <ref>` SHALL 从 `~/.skillsmgr/` 完全删除 collection 中所有 members 的 skill，同时自动取消当前项目中对这些 skill 的部署（复用现有 uninstall 的 cleanup 逻辑）。

#### Scenario: Collection 里所有 member 都已安装
- **WHEN** 执行 `uninstall --from @alice/kit`
- **THEN** collection 所有 member SHALL 从本地缓存删除

#### Scenario: Collection 里有未安装的 member
- **WHEN** collection 含 3 个 member，本地只装了 2 个
- **THEN** 系统 SHALL 删除已装的 2 个，跳过第 3 个并提示 `not installed`
