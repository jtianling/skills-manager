# Source Management

管理 skill 和 command 的远程来源: 下载, 安装, 元数据追踪, 更新.

## 来源分类

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{repo}/` | 官方 skill, 目前仅 anthropic |
| community | `~/.skills-manager/community/{repo}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义, 也可通过 `--custom` 从远程安装 |

"anthropic" 关键字为特殊简写, 映射到 `https://github.com/anthropics/skills`.

## 来源元数据

### SourceInfo 数据结构

存储在 `~/.skills-manager/sources.json`:

```json
{
  "version": "1.0",
  "sources": {
    "official/anthropic": {
      "url": "https://github.com/anthropics/skills",
      "type": "official",
      "repoName": "anthropic",
      "installedAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-02-01T15:30:00.000Z"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 远程仓库 URL |
| type | "official" \| "community" \| "custom" | 来源类型 |
| repoName | string | 仓库名称 |
| installedAt | string (ISO 8601) | 首次安装时间, 后续安装不覆盖 |
| updatedAt | string (ISO 8601) | 最近更新时间 |

### SourcesService 行为

- **load()**: 读取 sources.json, 文件不存在时返回 `{ version: "1.0", sources: {} }`
- **save()**: 写入 sources.json, 使用 `JSON.stringify(data, null, 2)` 格式化, `ensureDir` 确保父目录存在
- **addSource(key, info)**: 添加或更新 source. `installedAt` 保留已有值 (如果 key 已存在), `updatedAt` 设为当前时间
- **getSource(key)**: 返回指定 source 或 undefined
- **getAllSources()**: 返回所有 sources 的 Record
- **removeSource(key)**: 使用 `delete` 删除指定 source
- **updateTimestamp(key)**: 仅更新 `updatedAt` 字段为当前时间, source 不存在时不做任何操作

### Source Key 命名规则

key 格式为 `{type}/{repoName}`:
- official: `"official/anthropic"`
- community: `"community/{repo}"`
- custom: `"custom/{repo}"`

## 安装流程

### 输入解析

`install` 命令接受 `<source>` 参数, 按以下优先级解析:

1. **`anthropic` 关键字**: 特殊处理, 调用 `installFromAnthropic()`, 不经过通用流程
2. **`owner/repo` 简写** (如 `Fission-AI/OpenSpec`):
   - 匹配规则: `!source.includes('://') && /^[^/]+\/[^/]+\/?$/.test(source)`
   - 即: 不含协议前缀, 且格式为 "非斜杠字符/非斜杠字符" (允许末尾可选斜杠)
   - 转换为 `https://github.com/{owner}/{repo}` (末尾斜杠被去掉)
   - 输出 "Resolved to {url}"
3. **GitHub URL** (含 `github.com`): 尝试 GitHub API, 失败则回退 git clone
4. **其他 URL**: 直接使用 git clone

### 选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `--all` | boolean | 安装所有 skill, 跳过选择提示 |
| `--custom` | boolean | 安装到 custom/ 而非 community/ |

### GitHub API 下载流程 (优先路径)

#### installFromAnthropic()

专用于 `anthropic` 关键字的优化路径:

1. 调用 `githubService.listSkills('anthropics', 'skills', 'skills')` 获取 skill 列表
2. 获取 default branch
3. 如果没有 skill:
   - 尝试安装 commands, 如果也没有 → `process.exit(1)` 并报错
4. 有 skill 时:
   - 使用 ProgressBar 逐个获取 SKILL.md 描述 (通过 raw.githubusercontent.com)
   - 获取失败时 description 为空, 不中断流程
   - 提示用户选择 (除非 `--all`)
   - 用户不选择任何 skill 时输出 "No skills selected" 并返回 (不 exit)
   - 下载选中的 skill
   - **自动安装 commands** (调用 `installCommandsFromGitHub()`)
5. 保存 source 元数据, key 为 `"official/anthropic"`

#### installFromGitHubUrl()

通用 GitHub URL 处理, 返回 boolean 表示是否成功:

1. 调用 `githubService.parseGitHubUrl()` 解析 URL
2. 解析失败 → 返回 false (会回退到 git clone)

**特定 skill URL (有 path)**:
- 从 path 提取 skill 名称 (最后一段)
- 直接下载该 skill, 不提示选择
- 返回 true

**仓库 URL (无 path)**:
1. 依次在 `['skills', '.', 'src/skills']` 路径下搜索 skill 目录
2. 对每个路径调用 `listSkills()`, 有结果就停止搜索
3. 有 skill 时正常流程 (提示选择, 下载, 安装 commands)
4. **没有子目录 skill 时, 检查根目录 SKILL.md**:
   - 通过 `raw.githubusercontent.com/{owner}/{repo}/{branch}/SKILL.md` 获取根目录 SKILL.md
   - 如果存在 (HTTP 200): 解析 frontmatter 获取 name 和 description, name 为空时 fallback 为 repo 名
   - 将整个仓库根目录内容下载到 `{targetBase}/{skillName}/`
   - 直接安装, 不提示用户选择 (单 skill 仓库)
   - 同时检查并安装 commands
   - 保存 source 元数据
   - 返回 true
5. 根目录也没有 SKILL.md 时, 尝试 commands, 都没有 → 返回 false
6. 有 skill 时 (子目录形式):
   - 逐个获取 SKILL.md 描述, 没有 SKILL.md 的目录被过滤掉
   - 过滤后无 skill → 再次尝试 commands, 没有 → 返回 false
   - 提示选择 (除非 `--all`)
   - 用户不选择任何 skill 时输出 "No skills selected" 并返回 true (视为成功, 不回退到 git clone)
   - 下载选中的 skill + 自动安装 commands
7. 确定 source key:
   - anthropics/skills → `"official/anthropic"`
   - `--custom` → `"custom/{repo}"`
   - 默认 → `"community/{repo}"`
8. 返回 true

#### Scenario: Root SKILL.md detected after subdirectory search fails
- **WHEN** 仓库 URL 安装时, `listSkills()` 对所有路径都未找到子目录 skill, 但根目录存在 SKILL.md
- **THEN** 系统获取根目录 SKILL.md, 解析 frontmatter, 将仓库内容下载到 `{targetBase}/{skillName}/`, 返回 true

#### Scenario: Root SKILL.md not found either
- **WHEN** 仓库既无子目录 skill, 根目录也无 SKILL.md
- **THEN** 行为不变: 尝试 commands, 都没有则返回 false

#### Scenario: Root SKILL.md with commands in same repo
- **WHEN** 仓库根目录有 SKILL.md, 同时有 commands/ 目录
- **THEN** 安装根目录 skill 后, 同时自动安装 commands

#### installCommandsFromGitHub()

自动安装 commands (不需要用户选择):

1. 依次在 `['commands', 'src/commands']` 路径下搜索 .md 文件
2. 有结果就停止搜索
3. 在 `{targetBase}/commands/` 下逐个下载
4. 返回安装的 command 数量

### Git Clone 回退

当 GitHub API 不可用或返回 false 时:

#### 特定 skill URL

判断标准: URL 中包含 `/tree/`

处理:
1. 使用正则提取 owner, repo, branch, skillPath
2. 匹配失败 → 返回 null
3. 使用 sparse checkout:
   - 在目标目录初始化 git repo (如果不存在)
   - 设置 remote origin
   - 启用 sparse checkout
   - 将 skillPath 追加到 `.git/info/sparse-checkout`
   - `git pull --depth 1 origin {branch}`

#### installViaGitClone() - 仓库 URL

当 GitHub API 不可用或返回 false 时使用 git clone:

1. 克隆仓库到目标目录
2. 扫描子目录查找包含 SKILL.md 的目录
3. **如果未找到子目录 skill, 检查克隆目录根的 SKILL.md**:
   - 使用 `fileExists(join(repoPath, 'SKILL.md'))` 检查
   - 如果存在: 解析 frontmatter 获取 name (fallback 为仓库名)
   - 创建 `{repoPath}/{skillName}/` 子目录
   - 将根目录下所有非 `.git` 文件和目录移入该子目录
   - 删除 `.git` 目录 (不再需要, 已安装完成)
   - 作为单 skill 安装, 不提示选择
4. 同时统计 commands 数量
5. 无 skill 且无 command → `process.exit(1)`
6. 有 skill 且非 `--all` → 提示选择
7. **未选中的 skill 被物理删除** (`removeDir(skill.path)`)
8. 用户不选择任何 skill 时, **整个仓库目录被删除** (`removeDir(repoPath)`)
9. 保存 source 元数据

#### Scenario: Git clone detects root SKILL.md
- **WHEN** GitHub API 失败后 git clone 仓库, 克隆目录根有 SKILL.md 但无子目录 skill
- **THEN** 系统将文件重组到 `{repoPath}/{skillName}/` 子目录, 直接安装

#### Scenario: Git clone root skill with no frontmatter name
- **WHEN** 根目录 SKILL.md 无 frontmatter name 字段
- **THEN** 使用仓库名作为 skill name

### 安装目标路径

| 场景 | 路径 |
|------|------|
| anthropic 关键字 | `~/.skills-manager/official/anthropic/{skill-name}/` |
| anthropics/skills 仓库 URL | `~/.skills-manager/official/anthropic/{skill-name}/` |
| 普通 GitHub 仓库 | `~/.skills-manager/community/{repo}/{skill-name}/` |
| `--custom` 选项 | `~/.skills-manager/custom/{repo}/{skill-name}/` |
| Commands | `{targetBase}/commands/{name}.md` |

### 错误处理

- `~/.skills-manager/` 不存在 → `process.exit(1)` 并提示 setup
- GitHub API 失败 → 输出 "GitHub API failed, falling back to git clone..." 并尝试 git clone
- 仓库中无 skill 和 command → `process.exit(1)` 并报错
- 网络错误 → 捕获 Error, 输出 `error.message` 并 `process.exit(1)`

## 更新流程

`update` 命令从远程拉取已安装 source 的最新版本.

### Source 匹配

`update [source]` 的可选参数匹配逻辑:

不指定时: 更新所有 sources

指定时, 按以下条件查找匹配的 key:
1. 精确匹配 key (如 `official/anthropic`)
2. key 以 `/{source}` 结尾 (如输入 `anthropic` 匹配 `official/anthropic`)
3. `sourceInfo.repoName === source`

找不到匹配时, 输出已安装 source 列表供参考.

### 更新流程

对每个 source:

1. 解析 GitHub URL (不支持非 GitHub 的 source 更新, parseGitHubUrl 返回 null 时跳过)
2. 确定本地目标目录 (根据 type: official/community/custom)
3. 获取 default branch

**更新 Skills**:
1. 扫描本地已安装的 skill 目录 (`getDirectoriesInDir(targetBase)`)
2. 跳过名为 `commands` 的目录 (避免误识别为 skill)
3. 跳过没有 SKILL.md 的目录
4. 探测远程 skill 目录位置: 依次尝试 `skills/`, `.`, `src/skills/`
5. **如果远程无子目录 skill, 额外检查根目录 SKILL.md**:
   - 获取 `raw.githubusercontent.com/{owner}/{repo}/{branch}/SKILL.md`
   - 如果存在 (HTTP 200), 标记该仓库为根目录 skill 仓库
   - 对本地 skill 使用根路径 `SKILL.md` 进行内容对比 (而非 `{skillsBasePath}/{skillName}/SKILL.md`)
   - 内容不同时, 删除本地 skill 目录, 重新下载整个仓库根到该目录
6. 如果远程也没有根目录 SKILL.md, 对本地 skill 显示 "not found in remote"
7. 对每个本地 skill:
   - 通过 `raw.githubusercontent.com` 获取远程 SKILL.md
   - 远程不存在 (HTTP 非 200) → 标记为 "not found in remote"
   - 内容相同 → 标记为 "up to date"
   - 内容不同 → `removeDir()` 删除本地, `downloadSkill()` 重新下载, 标记为 "updated"
   - 获取失败 → 标记为 "failed to update"

**更新 Commands**:
1. 扫描 `{targetBase}/commands/` 下的 .md 文件
2. 探测远程 commands 目录位置: 尝试 `commands/`, `src/commands/`
3. 对每个本地 command:
   - 获取远程文件内容
   - 逻辑与 skill 相同: 对比 → 相同跳过 / 不同则删除重下

4. 更新 source 的 `updatedAt` 时间戳

#### Scenario: Update root-skill repo with changed content
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容已变更
- **THEN** 系统删除本地 skill 目录, 重新下载整个仓库根目录内容到该目录, 显示 "updated"

#### Scenario: Update root-skill repo with no changes
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容未变更
- **THEN** 显示 "up to date", 不做任何修改

#### Scenario: Update detects root-skill pattern
- **WHEN** 本地有 skill "deep-research" 安装于 `community/repo/deep-research/`, 远程仓库无 `skills/`, `.`, `src/skills/` 下的子目录, 但根目录有 SKILL.md
- **THEN** 系统使用根目录路径 `SKILL.md` (而非 `skills/deep-research/SKILL.md`) 进行远程比对

### 更新结果统计

| 状态 | 含义 |
|------|------|
| updated | 内容变更, 已删除旧版并下载新版 |
| upToDate | 内容一致, 无需更新 |
| failed | 获取或下载失败 (网络错误) |

输出格式: "Done! X updated, Y up to date, Z failed"

### 局限性

- 仅通过 GitHub API 更新, 不支持 git clone 方式的 source 更新 (如果 parseGitHubUrl 返回 null, 该 source 被跳过并显示警告)
- 仅更新已安装的 skill/command, 不发现和安装新增内容
- skill 更新仅对比 SKILL.md, 但删除和重新下载是整个目录 (所以其他文件也会被更新)
- 没有版本号或 hash 比较, 依赖文本内容全文对比

## GitHub Service 详解

### API 请求

- Base URL: `https://api.github.com`
- User-Agent: `skillsmgr`
- Accept: `application/vnd.github.v3+json`
- 认证: 如果 `process.env.GITHUB_TOKEN` 存在, 使用 `token {GITHUB_TOKEN}` 作为 Authorization header
- 无 token 时使用匿名访问 (GitHub 限制: 60 requests/hour)

### Default Branch 缓存

`getDefaultBranch()`:
- 使用 Map 按 `{owner}/{repo}` 缓存, 同一 GitHubService 实例内有效
- API 调用失败时 (非 200) → fallback 返回 `"main"`, 不抛错
- 正常返回 `data.default_branch`, 如果字段不存在也 fallback 到 `"main"`

### URL 解析

`parseGitHubUrl()` 支持两种格式:

**Tree URL**: `https://github.com/owner/repo/tree/branch/path/to/content`
- 正则: `/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?/`
- 返回: `{ owner, repo, branch, path }` (path 可能为 undefined, 如 `/tree/main`)

**Basic URL**: `https://github.com/owner/repo` 或 `https://github.com/owner/repo.git`
- 正则: `/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/`
- 返回: `{ owner, repo }` (无 branch 和 path)

**不匹配的 URL** → 返回 null

### 目录列表

`listSkills()`:
- 调用 `/repos/{owner}/{repo}/contents/{path}` API
- 过滤 `type === 'dir'` 的条目
- API 失败时抛出 Error

`listCommands()`:
- 同样使用 contents API
- 过滤 `type === 'file' && name.endsWith('.md')`
- API 失败时返回空数组 (不抛错, 与 listSkills 不同)

### 文件下载

`downloadSkill()`:
- 先 ensureDir 创建目标目录
- 递归下载: 调用 contents API 获取目录内容, 对 file 类型使用 `download_url` 下载, 对 dir 类型递归处理
- 文件内容通过 `response.text()` 获取, 使用 `writeFileSync(path, content, 'utf-8')` 写入

`downloadCommandFile()`:
- 通过 contents API 获取文件的 `download_url`
- 使用 download_url 下载实际内容

### Requirement: GitHubService 支持检查根目录文件

`GitHubService` SHALL 提供方法检查仓库根目录是否存在指定文件, 用于根目录 SKILL.md 检测.

#### Scenario: Check root file exists
- **WHEN** 调用检查方法且仓库根目录存在 SKILL.md
- **THEN** 返回文件内容

#### Scenario: Check root file not exists
- **WHEN** 调用检查方法且仓库根目录不存在 SKILL.md
- **THEN** 返回 null 或 undefined

## Git Service 详解

### clone()

- `anthropic` 关键字 → URL 替换为 `ANTHROPIC_SKILLS_REPO`
- 目标目录已存在 → `git pull` (在已有目录中执行, 使用 `stdio: 'inherit'`)
- 不存在 → `git clone --depth 1` (浅克隆, 使用 `stdio: 'inherit'`)
- 仓库名提取: 从 URL 末尾匹配 `/([^/]+?)(\.git)?$/`, 匹配失败返回 "unknown"

### cloneSpecificSkill()

Sparse checkout 流程:
1. 解析 URL 提取 owner, repo, branch, skillPath
2. 创建目标目录
3. 如果没有 `.git` 目录 → `git init` + `git remote add origin`
4. 启用 sparse checkout: `git config core.sparseCheckout true`
5. 追加路径到 `.git/info/sparse-checkout` (使用 `>>` 追加, 不覆盖)
6. `git pull --depth 1 origin {branch}`
7. 返回 skill 目标路径

**注意**: sparse checkout 配置使用追加模式, 多次安装不同 skill 时会累积路径.

### isSpecificSkillUrl()

判断逻辑: `url.includes('/tree/')` — 简单的字符串包含检查.

## 测试用例

### 输入解析

- test_install_anthropicKeyword_usesOfficialPath: "anthropic" 关键字安装到 official/anthropic/
- test_install_ownerRepoShorthand_resolvesToGitHubUrl: "user/repo" 格式正确解析为 GitHub URL
- test_install_ownerRepoWithTrailingSlash_trimmed: "user/repo/" 末尾斜杠被去掉
- test_install_ownerRepoWithProtocol_notResolvedAsShorthand: "https://user/repo" 不被视为简写 (包含 ://)
- test_install_ownerRepoThreeSegments_notResolvedAsShorthand: "a/b/c" 不匹配 (多于两段)
- test_install_githubUrl_usesGitHubApi: 包含 github.com 的 URL 尝试 GitHub API
- test_install_nonGithubUrl_usesGitClone: 非 GitHub URL 直接 git clone

### GitHub API 安装

- test_installFromAnthropic_noSkillsNoCommands_exits: 仓库无内容时 process.exit(1)
- test_installFromAnthropic_onlyCommands_succeeds: 仓库仅有 commands 时成功安装
- test_installFromAnthropic_allOption_skipsPrompt: --all 选项跳过选择提示
- test_installFromAnthropic_noSelection_returnsNoExit: 用户不选择时输出 "No skills selected" 但不 exit
- test_installFromAnthropic_fetchSkillMdFails_emptyDescription: 获取 SKILL.md 失败时 description 为空, 不中断
- test_installFromGitHubUrl_specificSkill_directDownload: tree URL 直接下载指定 skill, 无提示
- test_installFromGitHubUrl_repoUrl_searchesMultiplePaths: 仓库 URL 时依次搜索 skills/, ., src/skills/
- test_installFromGitHubUrl_parseFails_returnsFalse: URL 解析失败返回 false
- test_installFromGitHubUrl_customOption_installsToCustomDir: --custom 选项安装到 custom/ 目录

### Commands 自动安装

- test_installCommands_searchesMultiplePaths: 依次尝试 commands/ 和 src/commands/
- test_installCommands_noCommandsDir_returnsZero: 没有 commands 目录时返回 0
- test_installCommands_downloadsAllMdFiles: 所有 .md 文件被下载

### Git Clone 回退

- test_gitClone_githubApiFails_fallsToClone: GitHub API 失败后回退到 git clone
- test_gitClone_specificSkillUrl_usesSparseCheckout: tree URL 使用 sparse checkout
- test_gitClone_existingRepo_pullsInsteadOfClone: 已存在的仓库使用 git pull
- test_gitClone_shallowClone_depthOne: 新 clone 使用 --depth 1
- test_gitClone_noSelectionOnPrompt_removesRepo: 用户不选择时删除整个 clone 目录
- test_gitClone_partialSelection_removesUnselected: 部分选择时删除未选中的 skill 目录

### Source 元数据

- test_sourcesService_addSource_newKey_setsInstalledAt: 新 source 的 installedAt 设为当前时间
- test_sourcesService_addSource_existingKey_preservesInstalledAt: 重复安装时 installedAt 不变
- test_sourcesService_addSource_existingKey_updatesUpdatedAt: 重复安装时 updatedAt 更新为当前时间
- test_sourcesService_getSource_notExists_returnsUndefined: 不存在的 key 返回 undefined
- test_sourcesService_removeSource_deletesEntry: 删除 source 后 getSource 返回 undefined
- test_sourcesService_updateTimestamp_existingKey_updatesTime: 更新已有 source 的 updatedAt
- test_sourcesService_updateTimestamp_nonExistingKey_noOp: 不存在的 key 不做任何操作
- test_sourcesService_load_fileNotExists_returnsEmptyData: sources.json 不存在时返回空数据
- test_sourcesService_save_createsFormattedJson: 保存时 JSON 使用 2 空格缩进

### GitHub URL 解析

- test_parseGitHubUrl_basicUrl_returnsOwnerRepo: `https://github.com/owner/repo` 返回 owner 和 repo
- test_parseGitHubUrl_gitSuffix_stripsGit: `https://github.com/owner/repo.git` 去掉 .git
- test_parseGitHubUrl_treeUrl_returnsAllFields: tree URL 返回 owner, repo, branch, path
- test_parseGitHubUrl_treeUrlNoPath_branchOnly: `/tree/main` 无 path 时 path 为 undefined
- test_parseGitHubUrl_invalidUrl_returnsNull: 非 GitHub URL 返回 null

### Default Branch

- test_getDefaultBranch_success_returnsBranch: API 成功时返回实际 default_branch
- test_getDefaultBranch_apiFails_fallbackToMain: API 失败时返回 "main"
- test_getDefaultBranch_cached_noSecondApiCall: 第二次调用同一仓库不发起 API 请求

### 更新流程

- test_update_noSources_showsMessage: 无已安装 source 时提示安装
- test_update_specificSource_matchesByKey: 指定 source 精确匹配 key
- test_update_specificSource_matchesBySuffix: "anthropic" 匹配 "official/anthropic"
- test_update_specificSource_matchesByRepoName: 通过 repoName 匹配
- test_update_specificSource_notFound_showsInstalled: 找不到时显示已安装列表
- test_update_skillUnchanged_showsUpToDate: 内容一致时显示 up to date
- test_update_skillChanged_deletesAndRedownloads: 内容变更时先删除再下载
- test_update_skillNotFoundRemote_showsWarning: 远程不存在时显示警告
- test_update_skipsCommandsDirectory: 名为 "commands" 的目录被跳过不作为 skill 更新
- test_update_skipsNoSkillMd: 无 SKILL.md 的目录被跳过
- test_update_commandUnchanged_showsUpToDate: command 内容一致时显示 up to date
- test_update_commandChanged_deletesAndRedownloads: command 内容变更时重新下载
- test_update_updatesTimestamp: 更新完成后调用 updateTimestamp
- test_update_nonGithubSource_showsWarning: 无法解析的 URL 显示警告并跳过
