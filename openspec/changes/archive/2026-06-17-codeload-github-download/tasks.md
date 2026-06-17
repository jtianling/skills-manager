## 1. 依赖与脚手架

- [x] 1.1 `package.json` 新增 `node-tar` 依赖 (锁定版本), 安装并确认 build 通过
- [x] 1.2 新增 `src/services/github-archive.ts` 模块骨架 (codeload 下载 + sha 抽取的归属文件)

## 2. codeload 下载层

- [x] 2.1 实现 GitHub archive URL 构造: `https://github.com/<owner>/<repo>/archive/<ref>.tar.gz`, ref 缺省 `HEAD`, owner/repo/ref 做 URL 编码
- [x] 2.2 实现 https-only 校验 + connect 超时的 fetch (redirect: follow)
- [x] 2.3 实现 SSRF 防护: 跟随重定向后校验 `finalUrl` 落在 `https://codeload.github.com/`
- [x] 2.4 实现流式读取: 每 chunk idle 超时 + 边下边累计字节, 超压缩态上限中止, 不信 Content-Length
- [x] 2.5 实现 commit sha 抽取 (正则 `codeload\.github\.com/.+/tar\.gz/([0-9a-f]{40})`), 抠不到时 fail-closed 报错

## 3. 解包层 (node-tar)

- [x] 3.1 实现 gunzip (内置 `node:zlib`) + node-tar 解包到指定临时目录
- [x] 3.2 解包配置解压态大小上限 (解压炸弹防护), 超限中止
- [x] 3.3 确认 node-tar 的 path traversal 防护生效 (拒绝 `..` / 绝对路径, 限定写盘在临时目录内)

## 4. 统一下载入口 cloneRepoToTemp

- [x] 4.1 重写 `repo-clone.ts` 的 `cloneRepoToTemp`: 公开 repo 走 codeload (下载→gunzip→untar→临时目录), 返回 `ClonedRepo`
- [x] 4.2 `ClonedRepo` 接口新增 `commitSha?: string` 字段, codeload 路径填入抽取的 sha
- [x] 4.3 实现私有/不可访问 repo 检测 (codeload 401/403/404) → fallback 分支
- [x] 4.4 fallback 前检测 `git` 可用性; 不可用时抛友好错误 (替代 ENOENT 裸崩)
- [x] 4.5 fallback 执行 `git clone --depth 1`, best-effort `git rev-parse HEAD` 填 `commitSha`
- [x] 4.6 删除 `install-git.ts` 中重复的 `cloneToTemp`, 调用方改用 `cloneRepoToTemp`

## 5. commit sha 写入 source 元数据

- [x] 5.1 `saveGitCloneSource` 接收 `commitSha`, 写入 `SourceInfo.version`
- [x] 5.2 install / update / bundle 三条路径透传 `ClonedRepo.commitSha` 到元数据保存

## 6. /tree 特定 skill URL

- [x] 6.1 解析 `/tree/<branch>/<skillPath>` → owner/repo/branch/skillPath, 对 branch 取 codeload archive
- [x] 6.2 解包后按 skillPath 前缀过滤目标 skill (取代旧 sparse-checkout 路径)

## 7. 测试

- [x] 7.1 单测: archive URL 构造、SSRF 校验、sha 抽取 (含 fail-closed)、大小上限中止
- [x] 7.2 单测: 解包正确性 + path traversal 拒绝 + 解压炸弹上限
- [x] 7.3 E2E: 真实公开仓库 codeload 安装, 断言 skill 落地 + `SourceInfo.version` = commit sha
- [x] 7.4 E2E: codeload 解包文件树与 `git clone --depth 1` 结果逐文件对拍一致 (覆盖长文件名/深层嵌套/子目录 skill)
- [x] 7.5 E2E: 无 git 环境 (PATH 去除 git) 安装公开 repo 成功; 私有 repo 触发友好报错
- [x] 7.6 回归: update / bundle 路径经 CloneFetcher 走新下载实现, 资源清理无 `$TMPDIR` 残留

## 8. 收尾

- [x] 8.1 `pnpm test` + `pnpm run test:e2e` 全绿
- [x] 8.2 `openspec validate codeload-github-download --strict` 通过
