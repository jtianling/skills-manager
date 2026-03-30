# Source Management

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

### Requirement: install --group 不影响 source key
`install --group` 时, source key SHALL 不包含 group 信息.  source key 格式与不带 `--group` 时一致.

#### Scenario: 带 --group 安装的 custom skill source key
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** source key SHALL 为 `"custom/my-linter"`, 不含 group 信息

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

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`).  系统 SHALL 从路径中提取 skill name (basename), 在中央仓库 custom 目录中按 name 查找已安装 skill, 找到后对比 SKILL.md 内容, 有变化则重新拷贝.  系统 SHALL NOT 依赖 sources.json 的 url 字段做匹配.

#### Scenario: 路径指向已安装的 skill
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统提取 skillName = "my-skill"
- **THEN** 在 `~/.skills-manager/custom/` 中查找 "my-skill"
- **THEN** 找到后对比 source 路径和已安装路径的 SKILL.md 内容
- **THEN** 内容不同时删除已安装目录并从 source 路径重新拷贝, 输出 "↑ my-skill: updated"

#### Scenario: 路径指向已安装 skill 且无变化
- **WHEN** source 路径和已安装路径的 SKILL.md 内容相同
- **THEN** 输出 "✓ my-skill: up to date"

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill` 且 "unknown-skill" 未在中央仓库中安装
- **THEN** 输出 "No installed skill found: unknown-skill"

#### Scenario: source 路径不存在
- **WHEN** 用户执行 `skillsmgr update ./missing-dir` 且该路径不存在
- **THEN** 输出错误信息并退出

#### Scenario: 从不同目录 update 同一 skill
- **WHEN** skill "jt-release" 从 `/path/a/.claude/skills/jt-release` 安装
- **WHEN** 用户在 `/path/b/` 执行 `skillsmgr update ./skills/jt-release`
- **THEN** 系统按 skill name "jt-release" 查找, 不受 CWD 影响, 成功执行更新

#### Scenario: update 成功后维护 sources.json
- **WHEN** update 成功完成
- **THEN** 系统更新 sources.json 中对应 skill 的 `url` 为当前 source 绝对路径, `updatedAt` 为当前时间
- **THEN** 如果 sources.json 中无记录, 系统补写一条 (type: "custom", installMethod: "local-copy")

### 更新流程

对每个 source:

1. 解析 GitHub URL (不支持非 GitHub 的 source 更新, parseGitHubUrl 返回 null 时跳过)
2. 确定本地目标目录 (根据 type: official/community/custom)
3. 获取 default branch

**更新 Skills**:
1. 扫描本地已安装的 skill 目录 (`getDirectoriesInDir(targetBase)`)
2. 跳过名为 `commands` 的目录 (避免误识别为 skill)
3. 跳过没有 SKILL.md 的目录
4. 探测远程 skill 目录位置: 依次尝试 `skills/`, `.`
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

4. 更新 source 的 `updatedAt` 时间戳

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

### 更新结果统计

| 状态 | 含义 |
|------|------|
| updated | 内容变更, 已删除旧版并下载新版 |
| upToDate | 内容一致, 无需更新 |
| failed | 获取或下载失败 (网络错误) |

输出格式: "Done! X updated, Y up to date, Z failed"

### 局限性

- 更新流程仍通过 GitHub API 检查远程变更, 不支持非 GitHub source 的更新 (如果 parseGitHubUrl 返回 null, 该 source 被跳过并显示警告)
- 仅更新已安装的 skill, 不发现和安装新增内容
- skill 更新仅对比 SKILL.md, 但删除和重新下载是整个目录 (所以其他文件也会被更新)
- 没有版本号或 hash 比较, 依赖文本内容全文对比

## GitHub Service 详解 (仅用于 update 流程)

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

### 文件下载

`downloadSkill()`:
- 先 ensureDir 创建目标目录
- 递归下载: 调用 contents API 获取目录内容, 对 file 类型使用 `download_url` 下载, 对 dir 类型递归处理
- 文件内容通过 `response.text()` 获取, 使用 `writeFileSync(path, content, 'utf-8')` 写入

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
