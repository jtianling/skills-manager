## ADDED Requirements

### Requirement: 公开 GitHub repo 通过 codeload archive 下载

`cloneRepoToTemp` 对公开 GitHub 仓库 SHALL 通过 codeload archive 端点下载, 不依赖系统 `git` 二进制. 流程为: 构造 `https://github.com/<owner>/<repo>/archive/<ref>.tar.gz` (`<ref>` 缺省为 `HEAD`), 以 `redirect: follow` 发起 https GET, 跟随 302 重定向到 `https://codeload.github.com/...`, 对响应体先 `gunzip` (Node 内置 `node:zlib`) 再用 `node-tar` 解包到临时目录.

解包结果 SHALL 维持现有 `ClonedRepo { repoPath, cleanup }` 返回契约, `repoPath` 指向解包后的仓库根目录, 使下游 `collectSkillsFromClone` / `copyDir` 无需改动. `cleanup()` SHALL 删除整个临时目录.

系统 SHALL NOT 为下载或发现 skill 调用 `api.github.com` 或 `raw.githubusercontent.com`.

#### Scenario: 公开 repo 无系统 git 也能安装
- **GIVEN** 运行环境的 PATH 中没有可用的 `git` 二进制
- **WHEN** 用户执行 `skillsmgr install obra/superpowers` (公开仓库)
- **THEN** 系统 SHALL 通过 codeload archive 下载并解包, 成功安装 skill
- **THEN** 系统 SHALL NOT 因缺少 git 而报错

#### Scenario: codeload 解包结果与 git clone 文件树一致
- **GIVEN** 一个公开仓库
- **WHEN** 通过 codeload archive 下载并解包到临时目录
- **THEN** 解包出的文件树 (路径与内容) SHALL 与 `git clone --depth 1` 同一 ref 的工作树一致 (不含 `.git/`)

#### Scenario: ref 缺省取 HEAD
- **WHEN** 安装输入未指定分支/标签
- **THEN** archive URL SHALL 使用 `HEAD` 作为 ref

### Requirement: 私有 repo fallback git clone 且下载前检测 git 可用性

当 codeload 下载因鉴权失败 (HTTP 401/403/404) 判定为私有或不可访问仓库时, 系统 SHALL fallback 回 `git clone --depth 1`, 以复用本机 git 凭证完成私有仓库安装. fallback 前系统 SHALL 检测 `git` 是否可用; 不可用时 SHALL 输出明确的友好错误 (说明私有仓库需要本机 git 或凭证), 而非抛出底层 `spawnSync git ENOENT`.

#### Scenario: 私有 repo 经 fallback 用 git clone 安装
- **GIVEN** 环境已配置可访问某私有仓库的 git 凭证, 且 `git` 可用
- **WHEN** 用户安装该私有仓库, codeload 返回 403/404
- **THEN** 系统 SHALL fallback 到 `git clone --depth 1` 完成安装

#### Scenario: 私有 repo 但 git 不可用时友好报错
- **GIVEN** PATH 中没有可用的 `git` 二进制
- **WHEN** 用户安装一个 codeload 返回 403/404 的仓库
- **THEN** 系统 SHALL 输出友好错误, 说明私有仓库需要本机 git 或访问凭证
- **THEN** 系统 SHALL NOT 输出底层 `spawnSync git ENOENT` 崩溃栈

### Requirement: 安装/更新捕获 commit sha 写入 source 元数据

通过 codeload 下载时, 系统 SHALL 从跟随重定向后的最终 URL 用正则 `codeload\.github\.com/.+/tar\.gz/([0-9a-f]{40})` 抽取 40 位 commit sha, 并经 `ClonedRepo.commitSha` 传递, 由 `saveGitCloneSource` 写入 `SourceInfo.version`.

ref 缺省的 `HEAD` 路径 SHALL 总是解析到不可变的 40 位 commit sha; 该路径下抽取不到 sha SHALL 视为异常并报错 (fail-closed, 不接受无版本 pin 的归档). 显式分支 ref (形如 `/tree/<branch>`) 的 codeload 重定向落在 `tar.gz/refs/heads/<branch>` 不含 40 位 sha, 此情形 SHALL 接受空 `version` (与 git fallback 路径的 best-effort 行为一致), 不阻断安装. git clone fallback 路径 SHALL 尽力通过 `git rev-parse HEAD` 取 sha; 取不到时 `version` 留空, 不阻断安装.

#### Scenario: codeload 安装记录 commit sha
- **WHEN** 通过 codeload 成功安装一个公开仓库
- **THEN** 该 source 的 `SourceInfo.version` SHALL 等于 codeload 重定向 URL 中的 40 位 commit sha

#### Scenario: 默认 HEAD 路径抽取不到 sha 时 fail-closed
- **WHEN** 默认 `HEAD` ref 的 codeload 重定向后的最终 URL 不含 40 位 commit sha
- **THEN** 系统 SHALL 报错并中止该次下载

#### Scenario: 显式分支 ref 接受空 version
- **WHEN** 安装 `/tree/<branch>` 形式 URL, codeload 重定向落在 `tar.gz/refs/heads/<branch>` 不含 40 位 sha
- **THEN** 系统 SHALL 以空 `version` 完成安装, 不报错中止

#### Scenario: git fallback 路径尽力取 sha
- **WHEN** 经 git clone fallback 安装私有仓库
- **THEN** 系统 SHALL 尝试 `git rev-parse HEAD` 写入 `version`; 失败时 `version` 留空且安装继续

### Requirement: codeload 下载的网络与解包安全防护

codeload 下载与解包过程 SHALL 满足下列安全约束:

- **https-only**: SHALL 拒绝非 `https://` 的下载 URL.
- **SSRF 防护**: 跟随重定向后, 最终 URL SHALL 落在 `https://codeload.github.com/` 前缀下, 否则报错中止.
- **超时**: SHALL 设置连接超时; 流式读取 SHALL 对每个数据块设置 idle 超时, 防止挂死连接.
- **压缩态大小上限**: SHALL 边下载边累计已接收字节, 超过压缩态上限时立即中止; SHALL NOT 信任 `Content-Length` 头.
- **解压态大小上限**: 解包阶段 SHALL 对解压总量设上限, 超限中止 (解压炸弹防护).
- **path traversal 防护**: 解包写盘 SHALL 限定在临时目录内, 拒绝含 `..` 或绝对路径的归档条目.

#### Scenario: 重定向到非 codeload 主机被拒
- **WHEN** archive 请求被重定向到非 `codeload.github.com` 的主机
- **THEN** 系统 SHALL 报错中止, 不下载响应体

#### Scenario: 超过压缩态大小上限中止
- **WHEN** 下载累计字节超过配置的压缩态上限
- **THEN** 系统 SHALL 立即中止下载并报错

#### Scenario: 解压总量超限中止
- **WHEN** 解包后的累计解压字节超过配置的解压态上限
- **THEN** 系统 SHALL 中止解包并报错

#### Scenario: 拒绝逃逸路径条目
- **WHEN** 归档中存在含 `..` 或绝对路径的条目
- **THEN** 系统 SHALL 拒绝该归档, 不在临时目录外写盘

### Requirement: /tree 特定 skill URL 经 codeload 处理

对包含 `/tree/<branch>/<skillPath>` 的 URL, 系统 SHALL 解析出 owner / repo / branch / skillPath, 对 `<branch>` 取 codeload archive, 解包后按 `skillPath` 前缀过滤出目标 skill. 该路径取代旧的 git sparse-checkout 实现.

#### Scenario: /tree URL 安装指定子目录 skill
- **WHEN** 用户安装形如 `https://github.com/<owner>/<repo>/tree/<branch>/<skillPath>` 的 URL
- **THEN** 系统 SHALL 对 `<branch>` 取 codeload archive
- **THEN** 系统 SHALL 仅安装 `<skillPath>` 前缀下的 skill

## MODIFIED Requirements

### Requirement: Git 来源 update 走 git clone, 不使用 GitHub HTTP API

`SourceUpdater.updateSource` 对 `installMethod === 'git'` 的 source SHALL 通过共享的 `cloneRepoToTemp` 拉取整个仓库到临时目录, 然后基于本地文件系统扫描和文件对比完成更新. `cloneRepoToTemp` 对公开仓库默认使用 codeload archive 下载, 对私有/不可访问仓库 (codeload 401/403/404) fallback 到 `git clone --depth 1`. 系统 SHALL NOT 调用 `api.github.com` 或 `raw.githubusercontent.com` 来探测分支、列举 skill、对比 SKILL.md 或下载文件 (codeload archive 下载不在此禁止之列).

clone+scan 过程 SHALL 复用 `services/repo-clone.ts` 提供的 `cloneRepoToTemp` 和 `collectSkillsFromClone`, 与 install 流程和 `BundleManager.sync` 共享同一份发现规则 — 三条路径下"什么算 skill"的判定结果 SHALL 一致.

每次 update 调用 SHALL 在 try/finally 中清理临时目录, 无论成功还是抛错.

#### Scenario: Git source update 不发起 api.github.com 请求
- **GIVEN** 已安装 community/obra/superpowers (`installMethod: 'git'`), 本地有若干 skill
- **WHEN** 用户执行 `skillsmgr update superpowers`
- **THEN** 系统 SHALL 通过共享 `cloneRepoToTemp` (公开仓库走 codeload archive) 拉取仓库
- **THEN** 系统 SHALL NOT 发起对 `api.github.com` 或 `raw.githubusercontent.com` 的 HTTP 请求
- **THEN** SKILL.md 内容比对 SHALL 通过读 `<tempDir>/<skillPath>/SKILL.md` 完成

#### Scenario: 已安装 skill 内容未变更
- **WHEN** 已安装 skill `<localTarget>/<skillName>/SKILL.md` 与 clone 中对应位置 SKILL.md 字节相同
- **THEN** 系统 SHALL 输出 "✓ <skillName>: up to date"
- **THEN** 该 skill 目录 SHALL NOT 被删除或重新拷贝

#### Scenario: 已安装 skill 内容有变化
- **WHEN** 已安装 skill `<localTarget>/<skillName>/SKILL.md` 与 clone 中对应位置 SKILL.md 字节不同
- **THEN** 系统 SHALL 删除 `<localTarget>/<skillName>/`
- **THEN** 系统 SHALL 从 clone 中 `copyDir(<clonedSkillPath>, <localTarget>/<skillName>)` 重新拷贝整个 skill 目录
- **THEN** 系统 SHALL 输出 "↑ <skillName>: updated"

#### Scenario: 远端已删除已安装 skill
- **WHEN** 已安装 skill 名 `<skillName>` 不在 clone 扫描结果中 (远端已删除)
- **THEN** 系统 SHALL 输出 "⚠ <skillName>: not found in remote"
- **THEN** 该 skill 目录 SHALL NOT 被删除 (与 BundleManager 默认 keep 行为一致)

#### Scenario: clone 失败时清理临时目录并报错
- **WHEN** 下载 (codeload 或 git clone fallback) 失败 (网络异常、仓库不存在等)
- **THEN** 系统 SHALL 清理任何已创建的临时目录
- **THEN** 系统 SHALL 把错误向上抛出, update 命令以非 0 退出
- **THEN** 已安装的本地 skill 目录 SHALL 保持不变 (无任何删除/拷贝)

#### Scenario: scan 异常时仍清理临时目录
- **WHEN** clone 成功但 `collectSkillsFromClone` 抛出异常
- **THEN** 系统 SHALL 在 finally 块中调用 cleanup 删除临时目录, `$TMPDIR` 不留垃圾

#### Scenario: SourceUpdater 与 BundleManager / install 共享 skill 发现规则
- **GIVEN** 同一个仓库 (例如 garrytan/gstack)
- **WHEN** 通过 `install`、`update <skill>` 和 `update <bundle>` 三条路径分别处理该仓库
- **THEN** 三条路径扫描出的 skill 名集合 SHALL 完全一致 (差异仅来自 `selectedSkillNames` 等过滤参数, 不来自发现规则本身)
