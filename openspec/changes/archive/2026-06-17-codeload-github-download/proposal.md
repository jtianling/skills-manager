## Why

skillsmgr 从 GitHub 安装 skill 时统一用 `git clone --depth 1`, 这带来三个问题:

1. **隐式系统依赖**: `git` 是未声明的运行时前提, 用户机器没装 git 或 git 不在 PATH 时, 安装直接抛 `spawnSync git ENOENT` 裸崩, 没有友好提示.
2. **无版本溯源**: git 安装路径不记录 commit sha, `SourceInfo.version` 字段一直空着, 不知道装的是哪个 commit, update 只能盲目重拉最新.
3. **进程/环境耦合**: 依赖 fork git 子进程, 不利于未来在无 git 环境运行.

GitHub 的 codeload archive 端点 (`github.com/<owner>/<repo>/archive/<ref>.tar.gz`) 不计入 GitHub REST API 的 60/小时限额, 且跟随 302 重定向后 `finalUrl` 会带回解析好的 40 位 commit sha — 免去额外 API 调用即可拿到不可变版本 pin.

## What Changes

- **公开 repo 改用 codeload archive 下载**: `fetch` archive tar.gz → 跟随 302 到 `codeload.github.com` → `gunzip` (内置 zlib) → **node-tar 解包**到临时目录. 保持 `cloneRepoToTemp` 返回的 `ClonedRepo { repoPath, cleanup }` 接口不变, 下游 skill 发现/复制逻辑零改动.
- **私有 repo / 403 fallback 回 git clone** (混合方案): 保住"靠本机 git 凭证零配置安装私有 repo"的现有能力. fallback 到 git clone 前**检测 git 可用性**, 不可用时给友好报错 (替代现有 ENOENT 裸崩).
- **白嫖 commit sha**: 从 302 后的 `finalUrl` 正则抠 40 位 sha, `ClonedRepo` 新增 `commitSha` 字段, 一路传到 source 元数据保存逻辑, 填入 `SourceInfo.version`. 抠不到 sha 时 fail-closed 报错.
- **安全防护**: SSRF 校验 (重定向必须落在 `codeload.github.com`)、https-only、connect 超时 + body idle 超时、边下边累计字节不信 Content-Length (压缩态上限)、解压态大小上限 (解压炸弹防护).
- **统一下载入口**: 消除 `install-git.ts` 中重复的 `cloneToTemp`, 并入 `repo-clone.ts` 的 `cloneRepoToTemp`, 经已有的 `CloneFetcher` 抽象让 install / update / bundle 三条路共享同一下载实现.
- **引入依赖**: 新增 `node-tar` (纯 JS, 无原生编译) 用于 tar 解包.
- **范围限定**: 只处理 `.tar.gz` (GitHub archive 默认格式), 不做 zip (YAGNI).

## Capabilities

### New Capabilities
<!-- 无新增 capability, 本变更修改既有下载机制 -->

### Modified Capabilities
- `source-management`: 远程仓库下载机制从"统一 git clone"改为"公开 repo codeload + 私有 repo git clone fallback"; 安装与更新流程新增 commit sha 捕获并写入 source 元数据 `version` 字段; 新增 codeload 网络层与解包安全防护要求; git 不可用时的友好报错要求.

## Impact

- **代码**:
  - `src/services/repo-clone.ts`: `cloneRepoToTemp` 内部实现重写 (codeload + node-tar), `ClonedRepo` 新增 `commitSha`
  - `src/commands/install-git.ts`: 删除重复的 `cloneToTemp`, 改用 `cloneRepoToTemp`; `saveGitCloneSource` 写入 `version`
  - `src/services/source-updater.ts` / `src/services/bundle-manager.ts`: 经 `CloneFetcher` 抽象自动继承新下载实现; 透传 sha
  - `src/services/sources.ts`: `SourceInfo.version` 在 git 来源上被填充 (字段已存在)
  - 新增 codeload fetch + 解包模块 (GitHub archive URL 构造、sha 抽取、安全防护)
- **依赖**: `package.json` 新增 `node-tar`
- **行为变更**: 公开 GitHub repo 安装不再要求系统 git; 私有 repo 行为不变 (仍走 git clone)
- **非目标**: `git.ts` 的 `GitService` (死代码) 不在本次清理范围; zip 归档不支持
