## Why

Registry（skillsmgr.dev）已经实现 collection（策展）功能：用户可以把一批 skill 组织成一个 collection，通过 URL 分享给别人。服务端已经提供 `POST /api/collections/resolve` endpoint，把 collection ref 展开成 skill 列表，并处理 `extends` 链、private 过滤、redirect、环/深度检测。

CLI 侧需要对接：让用户用一条命令拉取 collection 里的所有 skill 并部署到项目，覆盖"从网页挑一批 → 命令行一键装"的场景。

## What Changes

- `install` / `add` / `remove` / `uninstall` 命令新增 `--from <ref>` 选项，参数接受 collection ref：
  - `@alice/kit`
  - `alice/kit`（自动补 `@`）
  - `skillsmgr.dev/c/@alice/kit`
  - `https://skillsmgr.dev/c/@alice/kit`
- 调用 `/api/collections/resolve` 拿到 members 列表
- `install --from` / `add --from`：逐个按 registry 安装/添加
- `remove --from`：逐个从当前项目取消部署
- `uninstall --from`：逐个从本地完全删除
- 服务端返回的 warning（`missing` / `private-skipped` / `cycle` / `depth`）透传给用户
- 支持 `--json` 输出批量结果

## Capabilities

### New Capabilities
- `install-collection`: 从 collection ref 批量安装能力——定义 ref 规范化、endpoint 调用、member 逐个安装、warning 透传行为

### Modified Capabilities

（无现有 spec 级别的行为变更）

## Impact

- **代码**: 
  - `src/services/registry.ts` 新增 `resolveCollection(ref)` 方法
  - `src/utils/source-detection.ts` 复用或扩展 ref 解析
  - `src/commands/install.ts` 和 `src/commands/add.ts` 新增 `--from` option 处理
- **依赖**: 无新增依赖
- **鉴权**: 匿名调用即可，private collection 需要带现有 auth token（`getToken()`）
- **兼容性**: 新增 option，现有命令行为不变
