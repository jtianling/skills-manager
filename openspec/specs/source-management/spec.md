# Source Management

## Purpose
管理 skill 的远程来源: 下载, 安装, 元数据追踪, 更新.

## 来源分类

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}/` | 官方 skill, 由 OFFICIAL_PROVIDERS registry 定义或 owner 匹配 |
| community | `~/.skills-manager/community/{owner}/{repo}/{skillName}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义 skill |

official 提供者由 `OFFICIAL_PROVIDERS` registry 定义, 支持多个提供者. 同一 official owner 下的未注册仓库也归类为 official.

#### Scenario: Official 安装路径 (已注册 repo)
- **WHEN** 安装 official 提供者 openai 的 skills repo
- **THEN** 安装到 `~/.skills-manager/official/openai/skills/{skill-name}/`

#### Scenario: Official 安装路径 (未注册 repo, owner 匹配)
- **WHEN** 安装 vercel-labs/new-repo (owner 匹配但 repo 未注册)
- **THEN** 安装到 `~/.skills-manager/official/vercel-labs/new-repo/{skill-name}/`

#### Scenario: Community 安装路径
- **WHEN** 安装 community 仓库 `obra/superpowers` 的 skills
- **THEN** 安装到 `~/.skills-manager/community/obra/superpowers/{skill-name}/`

#### Scenario: Custom 安装路径
- **WHEN** 安装本地 skill
- **THEN** 安装到 `~/.skills-manager/custom/{name}/`

#### Scenario: Custom 分组目录不再识别
- **WHEN** `~/.skills-manager/custom/` 下的子目录不含 SKILL.md
- **THEN** 该子目录 SHALL 被忽略, 不再视为分组目录

## 来源元数据

### SourceInfo 数据结构

存储在 `~/.skills-manager/sources.json`:

```json
{
  "version": "1.0",
  "sources": {
    "official/anthropic/skills": {
      "url": "https://github.com/anthropics/skills",
      "type": "official",
      "repoName": "skills",
      "installedAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-02-01T15:30:00.000Z"
    },
    "community/obra/superpowers": {
      "url": "https://github.com/obra/superpowers",
      "type": "community",
      "repoName": "superpowers",
      "installedAt": "2025-03-01T10:00:00.000Z",
      "updatedAt": "2025-03-01T10:00:00.000Z"
    }
  }
}
```

#### Scenario: Community source 记录完整 owner/repo
- **WHEN** 安装 community 仓库 `obra/superpowers`
- **THEN** source key SHALL 为 `"community/obra/superpowers"`, url 为 `"https://github.com/obra/superpowers"`

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

key 格式:
- official: `"official/{providerKey}/{repoName}"` (如 `"official/openai/skills"`, `"official/vercel-labs/agent-skills"`)
- community: `"community/{owner}/{repo}"` (如 `"community/obra/superpowers"`)
- custom: `"custom/{repo}"` (不变)

#### Scenario: Official source key (已注册 repo)
- **WHEN** 安装 official provider 'openai' 的 skills repo
- **THEN** source key SHALL 为 `"official/openai/skills"`

#### Scenario: Official source key (未注册 repo)
- **WHEN** 安装 vercel-labs/new-repo (owner 匹配)
- **THEN** source key SHALL 为 `"official/vercel-labs/new-repo"`

#### Scenario: Community source key
- **WHEN** 安装 `obra/superpowers` 的 skills
- **THEN** source key SHALL 为 `"community/obra/superpowers"`

## 安装流程

### 输入解析

`install` 命令接受 `<source>` 参数, 使用 `detectSourceType()` 按以下优先级路由:

| 源类型 | 匹配条件 | 处理 |
|--------|---------|------|
| remote-zip | URL + .zip/.skill 扩展名 | `installFromRemoteZip()` |
| local-zip | 本地路径 + .zip/.skill 扩展名 | `installFromZip()` |
| owner-repo | `owner/repo` 格式 | 构建 `https://github.com/{owner}/{repo}`, 走 `installViaGitClone()` |
| remote-url | `http(s)://` 或 `git@` 开头 | `installViaGitClone()` |
| local-path | `/`, `./`, `../`, `~` 前缀 | `installFromLocalDir()` |
| unknown | 其他 | 报错 "Unknown source format" |

official/community 分类在 git clone 完成后由 `findOfficialProvider(owner)` 决定.

#### Scenario: owner/repo 简写识别为 community
- **WHEN** 用户执行 `skillsmgr install obra/superpowers`
- **THEN** 构建 URL `https://github.com/obra/superpowers`, git clone, 安装到 `community/obra/superpowers/`

#### Scenario: owner/repo 简写识别为 official
- **WHEN** 用户执行 `skillsmgr install vercel-labs/agent-skills`
- **THEN** 构建 URL `https://github.com/vercel-labs/agent-skills`, git clone, 反查 registry 匹配, 安装到 `official/vercel-labs/agent-skills/`

#### Scenario: GitHub URL 安装
- **WHEN** 用户执行 `skillsmgr install https://github.com/vercel-labs/agent-skills`
- **THEN** 直接走 `installViaGitClone()`, 安装到 `official/vercel-labs/agent-skills/`

#### Scenario: 裸词报错
- **WHEN** 用户执行 `skillsmgr install local-skill` (无路径前缀)
- **THEN** 报错 "Unknown source format"

### 选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `--all` | boolean | 安装所有 skill, 跳过选择提示 |
| `--custom` | boolean | 安装到 custom/ 而非 community/ |
| `-s, --skill <name>` | string[] | 仅安装指定的 skill (可重复), 跳过选择提示 |

### Git Clone 安装流程

所有远程仓库安装统一使用 git clone, 不使用 GitHub API:

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

目标目录和 source key 规则:
- official (反查 registry 匹配): `official/{providerKey}/`
- community: `community/{owner}/{repo}/`
- custom: `custom/{repo}/`

1. 克隆仓库到临时目录 (`git clone --depth 1`)
2. **Skill 发现** (`collectGitCloneSkills`), 按以下优先级搜索:
   a. **Plugin manifest**: 检查 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`, 解析 `metadata.pluginRoot` + `plugins[].source` + `plugins[].skills` 构造搜索路径 (详见 plugin-manifest spec)
   b. **标准路径** (`STANDARD_SKILL_PATHS`): 依次扫描以下目录, 递归查找包含 SKILL.md 的子目录 (最大深度 3):
      - `skills/`
      - `skills/.curated/`
      - `skills/.experimental/`
      - `skills/.system/`
      - `.agents/skills/`
      - `.claude/skills/`
   c. **根目录 SKILL.md** (单 skill 仓库): 如果上述路径都未找到 skill, 检查克隆目录根的 SKILL.md. 存在时解析 frontmatter 获取 name (fallback 为仓库名), 作为单 skill 处理
   d. **根目录子文件夹扫描**: 如果根目录也没有 SKILL.md, 扫描根目录的直接子文件夹 (深度 1) 查找包含 SKILL.md 的目录
3. manifest 和标准路径的结果会合并去重 (按 name 去重, 先发现的优先)
4. 无 skill → 抛出 "No skills found in repository" 错误
5. 有 skill 时选择逻辑:
   - `--skill` 指定了 skill 名称 → 仅安装指定的 skill, 跳过选择提示
   - `--all` 且无 `--skill` → 安装所有 skill, 跳过选择提示
   - 其他 → 提示选择
6. "Found N skills." 输出: 有 `--skill` 过滤时反映过滤后的数量, 无过滤时反映仓库总数
7. 将选中的 skill 复制到目标目录
8. 清理临时克隆目录
9. 保存 source 元数据

#### Scenario: Install skills only
- **WHEN** 通过 git clone 安装仓库
- **THEN** 只查找和安装 skill

#### Scenario: Repo with no skills
- **WHEN** 克隆的仓库中没有 skill
- **THEN** 抛出 "No skills found in repository" 错误

#### Scenario: Root SKILL.md 单 skill 仓库
- **WHEN** git clone 仓库, 克隆目录根有 SKILL.md 但无子目录 skill
- **THEN** 系统将整个仓库视为单个 skill, 解析 frontmatter 获取 name, 直接安装

#### Scenario: Root SKILL.md 无 name 字段
- **WHEN** 根目录 SKILL.md 无 frontmatter name 字段
- **THEN** 使用仓库名作为 skill name

#### Scenario: 根目录子文件夹扫描
- **WHEN** 仓库无标准路径 skill 且无根 SKILL.md, 但根目录子文件夹包含 SKILL.md (如 `tdd/SKILL.md`, `qa/SKILL.md`)
- **THEN** 系统 SHALL 扫描根目录子文件夹, 发现并列出所有 skill

#### Scenario: 标准路径优先于根目录扫描
- **WHEN** 仓库 `skills/` 下有 skill, 且根目录子文件夹也有 SKILL.md
- **THEN** 系统 SHALL 只返回 `skills/` 下的 skill, 不扫描根目录

#### Scenario: Skills in curated/experimental/system subdirectories
- **WHEN** 仓库有 `skills/.curated/curated-skill/SKILL.md` 和 `skills/.experimental/exp-skill/SKILL.md`
- **THEN** 系统 SHALL 发现这些 skill

#### Scenario: 扁平仓库结构正常识别
- **WHEN** git clone 仓库, `skills/` 下的子目录直接包含 SKILL.md
- **THEN** 行为不变, 正常识别和安装

#### Scenario: Community 安装路径
- **WHEN** 安装 `obra/superpowers`
- **THEN** 克隆到临时目录, 复制到 `~/.skills-manager/community/obra/superpowers/`

#### Scenario: Official 安装路径
- **WHEN** 安装 `openai/skills`
- **THEN** 反查 registry 匹配 openai, 复制到 `~/.skills-manager/official/openai/skills/`

### 安装目标路径

| 场景 | 路径 |
|------|------|
| official 快捷名 (多 repo) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| official owner/repo (已注册) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| official owner/repo (未注册, owner 匹配) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| community GitHub 仓库 | `~/.skills-manager/community/{owner}/{repo}/{skill-name}/` |
| `--custom` 选项 | `~/.skills-manager/custom/{repo}/{skill-name}/` |

#### Scenario: getTargetDir for official (已注册)
- **WHEN** 调用 `getTargetDir` 且 owner/repo 匹配 official registry (exactRepoMatch=true)
- **THEN** 返回 `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}`

#### Scenario: getTargetDir for official (未注册 repo)
- **WHEN** 调用 `getTargetDir` 且 owner 匹配 official (exactRepoMatch=false)
- **THEN** 返回 `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}`

#### Scenario: getTargetDir for community
- **WHEN** 调用 `getTargetDir` 且 owner/repo 不匹配 official registry
- **THEN** 返回 `~/.skills-manager/community/{owner}/{repo}/{skillName}`

#### Scenario: Install success output
- **WHEN** 安装完成
- **THEN** 输出 "Installed N skills to path", 不再有 "and M commands" 部分

### 错误处理

- `~/.skills-manager/` 不存在 → `process.exit(1)` 并提示 setup
- 仓库中无 skill → 抛出 "No skills found in repository" 错误
- git clone 失败 → 捕获 Error, 输出 `error.message` 并 `process.exit(1)`
- 网络错误 → 捕获 Error, 输出 `error.message` 并 `process.exit(1)`

## 更新流程

`update` 命令从远程拉取已安装 source 的最新版本.

### Source 匹配

`update [source]` 的可选参数匹配逻辑:

不指定时: 更新所有 sources

指定时, 按以下条件查找匹配的 key:
1. 精确匹配 key (如 `official/openai`, `community/obra/superpowers`)
2. key 以 `/{source}` 结尾 (如输入 `anthropic` 匹配 `official/anthropic`, 输入 `superpowers` 匹配 `community/obra/superpowers`)
3. `sourceInfo.repoName === source`

更新时确定本地目标目录 SHALL 使用与安装相同的路径规则.

找不到匹配时, 输出已安装 source 列表供参考.

#### Scenario: Update community source 匹配
- **WHEN** 用户执行 `skillsmgr update superpowers`
- **THEN** 系统 SHALL 匹配 key `community/obra/superpowers` (以 `/superpowers` 结尾)

#### Scenario: Update official source 匹配
- **WHEN** 用户执行 `skillsmgr update openai`
- **THEN** 系统 SHALL 匹配 key `official/openai` (以 `/openai` 结尾)

### 更新流程

对每个 source:

1. 检查 source 的 installMethod:
   - `'local-copy'`: 从 sources.json 中记录的 `url` (原始路径) 读取最新内容并对比, 执行路径对比更新 (详见 local-update spec)
   - `'zip'`: 跳过 (zip 来源不支持更新)
   - 其他: 解析 GitHub URL, parseGitHubUrl 返回 null 时跳过
2. 确定本地目标目录 (根据 type: official/community/custom)
3. 对 git 来源 `git clone --depth 1` 到临时目录, 后续基于本地文件系统对比 (无 GitHub HTTP API 调用)

**更新 Skills**:
1. 扫描本地已安装的 skill 目录 (`getDirectoriesInDir(targetBase)`)
2. 跳过名为 `commands` 的目录 (避免误识别为 skill)
3. 跳过没有 SKILL.md 的目录
4. **`git clone --depth 1` 拉取远端仓库到临时目录** (复用 `services/repo-clone.ts` 的 `cloneRepoToTemp`), clone 失败时抛错并清理临时目录
5. **基于本地文件系统扫描发现远端 skill** (复用 `collectSkillsFromClone`), 与 install 流程和 BundleManager 共享同一份发现规则; 扫描覆盖 plugin manifest, 标准路径 (`skills/` 等), 根目录 SKILL.md 单 skill 仓库, 根目录子文件夹四种形态
6. 已安装 skill 不在 clone 扫描结果中时显示 "not found in remote", 不删本地
7. 对每个本地 skill:
   - 读取 `<clonePath>/<skillPath>/SKILL.md` 与本地 SKILL.md 字节对比
   - 字节相同 → 标记为 "up to date"
   - 字节不同 → `removeDir()` 删除本地, `copyDir(<clonePath>/<skillPath>, <targetDir>)` 重新拷贝, 标记为 "updated"
8. 在 `try { ... } finally { cleanup() }` 中保证临时目录回收, 无论成功或抛错

9. 更新 source 的 `updatedAt` 时间戳

#### Scenario: Update only updates skills
- **WHEN** 执行 `update` 更新某个 source
- **THEN** 只比较和更新 skill, 不处理 `{targetBase}/commands/` 下的文件

#### Scenario: Update output
- **WHEN** 更新完成
- **THEN** 统计只包含 skill 的更新结果, 不计入 command

#### Scenario: Update root-skill repo with changed content
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容已变更
- **THEN** 系统删除本地 skill 目录, 重新下载整个仓库根目录内容到该目录, 显示 "updated"

#### Scenario: Update root-skill repo with no changes
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容未变更
- **THEN** 显示 "up to date", 不做任何修改

#### Scenario: Update detects root-skill pattern
- **WHEN** 本地有 skill "deep-research" 安装于 `community/repo/deep-research/`, 远程仓库无 `skills/`, `.`, `src/skills/` 下的子目录, 但根目录有 SKILL.md
- **THEN** 系统使用根目录路径 `SKILL.md` (而非 `skills/deep-research/SKILL.md`) 进行远程比对

#### Scenario: 全量更新只遍历 git / registry
- **GIVEN** `sources.json` 含 1 个 git source 和 5 个物理 group 成员 (三段 key)
- **WHEN** 用户执行 `skillsmgr update` (无参数)
- **THEN** git source 走其 update 路径
- **THEN** 物理 group 成员不被单独遍历 (它们的更新通过 `skillsmgr update <group-name>` 触发)
- **THEN** 不尝试更新任何磁盘上的单 skill local-copy (见 local-update capability 的 "裸 update 跳过 local-copy skill" 需求)

### 更新结果统计

| 状态 | 含义 |
|------|------|
| updated | 内容变更, 已删除旧版并下载新版 |
| upToDate | 内容一致, 无需更新 |
| failed | 获取或下载失败 (网络错误) |

输出格式: "Done! X updated, Y up to date, Z failed"

### 局限性

- 更新流程对 git 来源通过 git clone 检查远程变更, 对 local-copy 来源通过原始路径对比更新, zip 来源不支持更新 (跳过)
- 仅更新已安装的 skill, 不发现和安装新增内容
- skill 更新仅对比 SKILL.md, 但删除和重新下载是整个目录 (所以其他文件也会被更新)
- 没有版本号或 hash 比较, 依赖文本内容全文对比

## GitHub Service 详解 (URL 解析工具)

`GitHubService` 不再发起任何 HTTP 请求, 退化为纯粹的 URL / 路径工具类.  整个 codebase 的 git 来源安装与更新均通过 git clone 完成 (见下文 "Git Service 详解" 与 "更新流程").

### URL 解析

`parseGitHubUrl()` 支持两种格式:

**Tree URL**: `https://github.com/owner/repo/tree/branch/path/to/content`
- 正则: `/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?/`
- 返回: `{ owner, repo, branch, path }` (path 可能为 undefined, 如 `/tree/main`)

**Basic URL**: `https://github.com/owner/repo` 或 `https://github.com/owner/repo.git`
- 正则: `/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/`
- 返回: `{ owner, repo }` (无 branch 和 path)

**不匹配的 URL** → 返回 null

### 目标目录计算

`getTargetDir(owner, repo, skillName, isCustom?)`:
- official (owner 命中 OFFICIAL_PROVIDERS) → `~/.skills-manager/official/{providerKey}/{repo}/{skillName}`
- isCustom → `~/.skills-manager/custom/{repo}/{skillName}`
- 其它 → `~/.skills-manager/community/{owner}/{repo}/{skillName}`

## Git Service 详解

### clone()

- official 快捷名 → 从 `OFFICIAL_PROVIDERS` 获取 URL
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

- test_install_ownerRepoShorthand_resolvesToGitClone: "user/repo" 格式构建 GitHub URL 后走 git clone
- test_install_ownerRepoWithTrailingSlash_trimmed: "user/repo/" 末尾斜杠被去掉
- test_install_remoteUrl_usesGitClone: 远程 URL (包括 GitHub URL) 统一走 git clone
- test_install_bareWord_throwsUnknownFormat: 裸单词抛出 "Unknown source format" 错误

### Git Clone 安装

- test_gitClone_specificSkillUrl_usesSparseCheckout: tree URL 使用 sparse checkout
- test_gitClone_shallowClone_depthOne: 新 clone 使用 --depth 1

### Skill 发现 (collectGitCloneSkills)

- test_collectSkills_manifestPlugins_discoversFromManifest: 从 marketplace.json 发现 skills
- test_collectSkills_mergesManifestAndStandardPaths: manifest 和标准路径结果合并去重
- test_collectSkills_deduplicatesByName: 同名 skill 只保留先发现的
- test_collectSkills_standardPathsOnly_discoversSkills: 无 manifest 时从标准路径发现 skills
- test_collectSkills_rootSkillMd_singleSkillRepo: 根目录 SKILL.md 识别为单 skill 仓库
- test_collectSkills_rootSubdirScan_discoversSkillsAtRoot: 根目录子文件夹包含 SKILL.md 时发现 skills
- test_collectSkills_standardPathsPriority_overRootScan: 标准路径有结果时不扫描根目录
- test_collectSkills_curatedExperimentalSystem_discovered: skills/.curated, .experimental, .system 下的 skill 被发现

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
- test_update_updatesTimestamp: 更新完成后调用 updateTimestamp
- test_update_nonGithubSource_showsWarning: 无法解析的 URL 显示警告并跳过

## Requirements

### Requirement: install --group 不影响 source key
`install --group` 时, source key SHALL 不包含 group 信息.  source key 格式与不带 `--group` 时一致.

#### Scenario: 带 --group 安装的 custom skill source key
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** source key SHALL 为 `"custom/my-linter"`, 不含 group 信息

### Requirement: zip 包来源识别 (.zip / .skill)

源类型检测 SHALL 将 `.zip` 和 `.skill` 扩展名视为 zip 包, 但仅当输入带有明确路径前缀 (`./`, `/`, `~/`, `../`) 或 URL 前缀 (`http://`, `https://`) 时.  裸文件名 (如 `foo.zip`, `foo.skill`) SHALL 不被识别为 zip 包来源, 返回 `unknown`.

#### Scenario: 本地带前缀的 zip 包识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install ./foo.zip` 或 `skillsmgr install ./foo.skill`
- **THEN** 源类型检测 SHALL 返回 `local-zip`, 走 `installFromZip` 流程

#### Scenario: 远程 URL zip 包识别为 remote-zip
- **WHEN** 用户运行 `skillsmgr install https://example.com/foo.zip` 或 `https://example.com/foo.skill`
- **THEN** 源类型检测 SHALL 返回 `remote-zip`, 走 `installFromRemoteZip` 流程

#### Scenario: 裸 zip 包文件名不识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install foo.zip` 或 `skillsmgr install foo.skill` (无路径前缀)
- **THEN** 源类型检测 SHALL 返回 `unknown`, 不走 zip 安装流程

#### Scenario: 绝对路径 zip 包识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install /path/to/foo.zip` 或 `/path/to/foo.skill`
- **THEN** 源类型检测 SHALL 返回 `local-zip`

#### Scenario: .skill 文件安装结果与 .zip 一致
- **WHEN** 安装一个 `.skill` 文件, 其内部包含有效的 skill 目录 (含 `SKILL.md`)
- **THEN** 安装行为 SHALL 与安装同内容的 `.zip` 文件完全一致, 包括目标路径、sources.json 记录和 installMethod

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统 SHALL 从路径中提取 skill name (basename), 通过 `findInstalledCustomSkill(name)` 在磁盘上 `~/.skills-manager/custom/` 中按 name 查找已安装 skill, 找到后对比 SKILL.md 内容, 有变化则重新拷贝.  系统 SHALL NOT 依赖 `sources.json` 的 url 字段做匹配, 也 SHALL NOT 在 update 成功后向 `sources.json` 写入或刷新 local-copy 条目.

#### Scenario: 路径指向已安装的 skill
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统提取 skillName = "my-skill"
- **THEN** 在 `~/.skills-manager/custom/` 中调用 `findInstalledCustomSkill("my-skill")`
- **THEN** 找到后对比 source 路径和已安装路径的 SKILL.md 内容
- **THEN** 内容不同时删除已安装目录并从 source 路径重新拷贝, 输出 "↑ my-skill: updated"
- **THEN** `sources.json` 中 SHALL NOT 新增或刷新 `custom/my-skill` 条目

#### Scenario: 路径指向已安装 skill 且无变化
- **WHEN** source 路径和已安装路径的 SKILL.md 内容相同
- **THEN** 输出 "✓ my-skill: up to date"
- **THEN** `sources.json` SHALL NOT 被修改

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill` 且 "unknown-skill" 未在中央仓库中安装
- **THEN** 输出 `Skill 'unknown-skill' is not installed. Run: skillsmgr install ./unknown-skill`
- **THEN** 以非 0 退出

#### Scenario: source 路径不存在
- **WHEN** 用户执行 `skillsmgr update ./missing-dir` 且该路径不存在
- **THEN** 输出错误信息并退出

#### Scenario: 从不同目录 update 同一 skill
- **WHEN** skill "jt-release" 已安装 (磁盘 `~/.skills-manager/custom/jt-release/SKILL.md` 存在)
- **WHEN** 用户在任意 CWD 执行 `skillsmgr update /abs/path/jt-release` 或 `./skills/jt-release` 等不同路径形式
- **THEN** 系统按 skill name "jt-release" 查找, 不受 CWD 或路径形式影响, 成功执行更新
- **THEN** sources.json 不因此变化

#### Scenario: update 成功后不维护 sources.json
- **WHEN** `skillsmgr update ./my-skill` 成功完成
- **THEN** `sources.json` 中的 `sources` 字段 SHALL NOT 新增 `custom/my-skill` 条目 (即便原本无条目)
- **THEN** `sources.json` 中原有的 `custom/my-skill` legacy local-copy 条目 (若存在) 不会被此次 update 刷新为新值 (会在下次其它写操作时被自然过滤清除, 见 "sources.json 不追踪 local-copy 条目" 需求)

### Requirement: sources.json 不追踪 local-copy 条目

`SourcesService` SHALL 拒绝向 `sources.json.sources` 写入 `installMethod === 'local-copy'` 的新条目 (开发期断言, 抛出明确错误).

`installFromLocalDir` 的 install 路径 SHALL 移除对 `sourcesService.addSource(...)` 的调用 (对单 skill 本地安装场景).  `custom/<name>/` 磁盘目录本身就是本地 skill 已安装的权威证据.

物理 group (local-batch) 成员的 sources.json 条目仍然保留 — 因为物理 group 的 rebind 流程需要批量改写成员 url, 在单一"磁盘即真相"的语义下物理 group 是豁免对象 (由 groups.json 中的 `url` 字段承担权威角色).

#### Scenario: install 单 skill 不写 sources.json
- **WHEN** 用户执行 `skillsmgr install ./my-skill` (源路径根含 SKILL.md)
- **THEN** 安装完成后, `~/.skills-manager/sources.json` 的 `sources` 字段 SHALL NOT 包含 `custom/my-skill` 条目

#### Scenario: update 单 skill 不写 sources.json
- **WHEN** 用户执行 `skillsmgr update ./my-skill` 成功
- **THEN** `sources.json` SHALL NOT 因此次 update 新增 `custom/my-skill` 条目

#### Scenario: SourcesService 拒绝写入 local-copy 条目
- **WHEN** 代码直接调用 `sourcesService.addSource('custom/abc', { installMethod: 'local-copy', ... })`
- **THEN** SHALL 抛出错误 `Refusing to persist local-copy source: custom/abc. Local skills are tracked by disk presence under custom/.`

#### Scenario: 物理 group 成员的 sources 条目不受影响
- **WHEN** 物理 group `tdd-spec` 被安装或 rebind, 成员 `custom/tdd-spec/ts-apply` 等条目按现有流程写入/更新 sources.json
- **THEN** 本 requirement 不阻止物理 group 成员的 sources 追踪 (它们由 group 生命周期管理, 与单 skill local-copy 语义不同)

### Requirement: sources.json 读路径过滤 legacy local-copy 条目

`SourcesService.load` 在读取磁盘上的 `sources.json` 后, SHALL 在内存数据中过滤掉所有满足下列条件的条目:

- key 形如 `custom/<name>` (两段, 非物理 group 成员的三段 `custom/<group>/<name>`)
- `installMethod === 'local-copy'`

过滤 SHALL 只影响内存视图, 不改动磁盘文件.  下次因其他原因 (例如 addSource/removeSource/timestamp 更新某个 git source) 触发的 `save()` 将写回过滤后的数据, 完成自然清理.

过滤 SHALL 静默执行, 不打印 warning, 不写 migration.log.

#### Scenario: load 过滤 legacy local-copy 条目
- **GIVEN** `sources.json` 含 `custom/jt-share`: `{ url: "/old/path", installMethod: "local-copy", ... }` 和 `community/obra/superpowers`: `{ installMethod: "git", ... }`
- **WHEN** `SourcesService.load()` 被调用
- **THEN** 返回的内存数据中 `sources` 只含 `community/obra/superpowers`, 不含 `custom/jt-share`
- **THEN** 磁盘 `sources.json` 文件内容保持不变 (不立即重写)

#### Scenario: 物理 group 成员的 custom 条目保留
- **GIVEN** `sources.json` 含 `custom/tdd-spec/ts-apply`: `{ installMethod: "local-copy", ... }` (key 三段, 属于物理 group `tdd-spec` 的成员)
- **WHEN** `SourcesService.load()` 被调用
- **THEN** `custom/tdd-spec/ts-apply` SHALL 保留在内存数据中, 不被过滤

#### Scenario: 下次写入自然清理
- **GIVEN** 同 "load 过滤 legacy local-copy 条目" 的前置条件
- **WHEN** 用户执行某条 git source 的 update, 触发 `sourcesService.updateTimestamp('community/obra/superpowers')`
- **THEN** 写回后的磁盘 `sources.json` SHALL NOT 再包含 `custom/jt-share` 条目

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

### Requirement: GitHubService 退化为 URL 解析工具

`GitHubService` SHALL 不再提供任何会发起 HTTP 请求的方法.  在该 capability 范围内 (即整个项目代码), `GitHubService` SHALL 只暴露纯字符串/路径工具:

- `parseGitHubUrl(url)`: URL 解析, 返回 `{ owner, repo, branch?, path? }` 或 null
- `getTargetDir(owner, repo, skillName, isCustom?)`: 计算目标安装目录

下列方法 SHALL 被移除, 不再存在于代码中:

- `getDefaultBranch`, `listSkills`, `listSkillsWithFallbackPaths`, `findRootSkillsByTree`
- `fetchRootFile`, `downloadSkill`, `downloadRepoRoot`
- 内部辅助 `downloadDirectory`, `downloadFile`, `getHeaders`, default-branch 缓存 Map

#### Scenario: GitHubService 不含 HTTP 调用
- **WHEN** 检视 `src/services/github.ts`
- **THEN** 文件中 SHALL NOT 出现 `fetch(`, `api.github.com`, `raw.githubusercontent.com`, `process.env.GITHUB_TOKEN` 等字面量
- **THEN** 类只包含 `parseGitHubUrl`, `getTargetDir` 这两个公开方法 (`isSpecificSkillUrl` 在 `GitService` 中, 不在 `GitHubService`)

#### Scenario: 已删除方法不再被任何代码引用
- **WHEN** 在 `src/` 下 grep `getDefaultBranch|listSkillsWithFallbackPaths|findRootSkillsByTree|fetchRootFile|downloadSkill|downloadRepoRoot`
- **THEN** 除测试文件中清理痕迹外, src 代码 SHALL 没有任何匹配

### Requirement: remove 命令支持 URL 格式
`remove` 命令 SHALL 支持通过 Git URL 格式(HTTPS/SSH)移除已部署的 skills.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 移除流程执行.

#### Scenario: 通过 HTTPS URL 移除
- **WHEN** 用户执行 `skillsmgr remove https://github.com/openai/skills`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove openai/skills` 一致

#### Scenario: 通过 GitLab URL 移除
- **WHEN** 用户执行 `skillsmgr remove https://gitlab.com/foo/bar`
- **THEN** 系统提取 `foo/bar` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove foo/bar` 一致

#### Scenario: 通过 SSH URL 移除
- **WHEN** 用户执行 `skillsmgr remove git@github.com:openai/skills.git`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove openai/skills` 一致

### Requirement: detectArgFormat 识别 URL 中的 owner/repo
`detectArgFormat()` SHALL 对包含可提取 owner/repo 的 URL 输入返回 `'owner-repo'`, 而非 `'install-source'`.

#### Scenario: HTTPS URL 返回 owner-repo
- **WHEN** `detectArgFormat("https://github.com/openai/skills")` 被调用
- **THEN** 返回 `'owner-repo'`

#### Scenario: 无法提取的 URL 仍返回 install-source
- **WHEN** `detectArgFormat("https://example.com/")` 被调用
- **THEN** 返回 `'install-source'`

### Requirement: sources.json V3 schema — bundles 字段限缩

`sources.json` SHALL 升级到 `version: '3.0'`.  顶层 `bundles` 字段 SHALL 仅包含 `type === 'git'` 或 `type === 'zip'` 的 entry.  `type === 'local-batch'` 的 entry 在迁移时 SHALL 移出 `sources.json`, 写入 `groups.json` 作为物理 group (见 `group-as-first-class-unit` capability 的 "迁移策略" 需求).

V3 示例:
```json
{
  "version": "3.0",
  "sources": { ... },
  "bundles": {
    "git:https://github.com/obra/superpowers": { "type": "git", "url": "...", "members": [...], ... },
    "zip:https://example.com/pack.zip": { "type": "zip", "url": "...", "members": [...], ... }
  }
}
```

`SourcesService` SHALL 拒绝向 `bundles` 字段写入 `type === 'local-batch'` 的 entry (开发期断言), 防止旧调用路径残留.

#### Scenario: V3 sources.json 不含 local-batch bundle
- **WHEN** 系统读取已迁移的 V3 sources.json
- **THEN** `bundles` 字段中所有 entry 的 `type` 都是 `'git'` 或 `'zip'`
- **THEN** 不存在 `type === 'local-batch'` 的 entry

#### Scenario: 写入 local-batch bundle 被拒绝
- **WHEN** 代码尝试调用 `SourcesService.addBundle(id, { type: 'local-batch', ... })`
- **THEN** SHALL 抛出错误 `local-batch bundles must be stored as physical groups in groups.json`

### Requirement: SourcesService V2→V3 迁移

`SourcesService.load` SHALL 在检测到 `version !== '3.0'` 时执行一次性迁移:

1. 写入 backup 文件 `sources.json.v2.backup` (atomic)
2. 收集所有 `bundles` 中 `type === 'local-batch'` 的 entry
3. 对每个 local-batch bundle, 调用 `GroupsService.migrateLocalBatchToPhysicalGroup(basename, bundle)` (定义见 `virtual-group` capability)
4. 从 `bundles` 字段中删除已迁移的 entry
5. 设 `version = '3.0'`, atomic 写回

迁移 SHALL 是无 opt-out 的, 失败时不损坏原数据 (atomic write 保证).  迁移后系统 SHALL 在 stderr 打印迁移摘要并写 `~/.skills-manager/migration.log`.

#### Scenario: V2 含 local-batch 自动迁移
- **GIVEN** sources.json 为 V2, `bundles` 含 1 个 local-batch entry (basename = `tdd-spec`)
- **WHEN** 系统首次 load
- **THEN** 写出 `sources.json.v2.backup`
- **THEN** local-batch entry 从 `bundles` 移除
- **THEN** `groups.json` 新增物理 group `tdd-spec`
- **THEN** sources.json `version` 升为 `'3.0'`

#### Scenario: 已是 V3 不重复迁移
- **GIVEN** sources.json `version === '3.0'`
- **WHEN** 系统 load
- **THEN** 不执行迁移逻辑, 不写 backup

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
