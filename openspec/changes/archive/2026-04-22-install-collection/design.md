## Context

- Web 已实现 collection resolve endpoint（web-master 交付），详细 schema 见 hive message 217
- CLI `install` 目前是单 source 命令，`add` 也是单 target；collection 解析出的 members 是多个 skill
- `installFromRegistry` 已支持按 packageName + version 安装单个 registry 包

## Goals / Non-Goals

**Goals:**
- `skillsmgr install --from <ref>` 拉取 collection 所有 members 到 `~/.skillsmgr/`
- `skillsmgr add --from <ref>` 在 install 基础上 deploy 到当前项目
- ref 接受多种形式，客户端和服务端一致做归一化
- 透传服务端 warnings 给用户
- `--from` 可以和 `--group` 组合，所有 member 加入同一 group
- 单 member 失败不阻塞其余

**Non-Goals:**
- 不做 collection 的创建/编辑/删除（只读对接）
- 不做 CLI 端的 extends 展开或 redirect（服务端完成）
- 不做 manifest（skillsmgr.json）对接（后续 change）

## Decisions

### 1. 命令形态：`--from <ref>` option

**选择**: 给 `install` 和 `add` 各加一个 `--from <ref>` option

**备选**:
- 独立命令 `skillsmgr collection install <ref>`：学习成本高，功能和 install 重叠
- 让 source argument 自动识别：`skillsmgr install @alice/kit` 会和 scoped package 冲突

**理由**: install/add 本就是"获取 skill"的入口，collection 只是多了一种 source。`--from` 明确表示"来自 collection"。

### 2. Ref 归一化

**方案**: 客户端做轻校验（regex `^@?[a-z0-9][a-z0-9._-]{0,48}/[a-z0-9][a-z0-9-]{0,48}$` 允许带或不带 `@`），归一化交给服务端。URL 形式在客户端先剥掉 host 只留 `@owner/slug`。

**理由**: 服务端已经做了完整规范化逻辑，客户端重复实现容易漂移。web-master 明确提到可以 import 同一套 normalize 函数——但后端是 TS 项目，跨仓库 import 成本大，先各自做，后续可以抽 npm 包共享。

### 3. 调用方式：POST /resolve

**选择**: 使用 `POST /api/collections/resolve`，body `{ extends: [ref] }`

**理由**: GET 形式简单但不便扩展；POST 预留了未来传 local `skills[]` 的能力，一致性更好。

### 4. 安装流程

1. 解析 ref → POST resolve → 拿 `{ members, warnings }`
2. 打印 warnings
3. 如果 members 为空，提示"collection is empty"退出
4. 展示待装列表并确认（非 `-y`）
5. for each member：复用 `installFromRegistry({ packageName, requestedVersion })`
6. 汇总结果（published/failed）

### 5. Add 模式

`add --from <ref>` = `install --from <ref>` + 自动 deploy 到当前项目的 agent 目录。复用现有 `executeAdd` 的 install+deploy 逻辑，传 multi-source 数组。

## Risks / Trade-offs

- **[私有 collection 的 auth]** → 服务端按 cookie/bearer token 过滤 private → CLI 在请求时自动附加 `Authorization: Bearer <token>`（如果本地已 login），未登录时只能拿 public
- **[URL 形式的解析]** → 用户贴完整 `https://skillsmgr.dev/c/@alice/kit` → 客户端正则剥出 `@alice/kit` 部分再交服务端
- **[warning 噪音]** → 服务端一次返回多种 warning，逐个打印可能吵 → 默认全部打印，如果实际体验刷屏再加限流
