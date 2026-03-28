# Source Management

管理 skill 的远程来源: 下载, 安装, 元数据追踪, 更新.

## 来源分类

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}/` | 官方 skill, 由 OFFICIAL_PROVIDERS registry 定义或 owner 匹配 |
| community | `~/.skills-manager/community/{owner}/{repo}/{skillName}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义无分组 skill |
| custom (grouped) | `~/.skills-manager/custom/{groupName}/{name}/` | 本地自定义分组 skill |

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

#### Scenario: Custom 无分组安装路径
- **WHEN** 使用 `custom-install` 安装且不指定 `--group`
- **THEN** 安装到 `~/.skills-manager/custom/{name}/`

#### Scenario: Custom 分组安装路径
- **WHEN** 使用 `custom-install --group my-tools` 安装
- **THEN** 安装到 `~/.skills-manager/custom/my-tools/{name}/`

#### Scenario: Custom 分组目录检测
- **WHEN** `~/.skills-manager/custom/` 下的子目录不含 SKILL.md
- **THEN** 该子目录视为分组目录, 扫描其下级目录寻找 skill

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

`install` 命令接受 `<source>` 参数, 按以下优先级解析:

1. **official 快捷名**: 查询 `OFFICIAL_PROVIDERS[source]`, 匹配则调用 `installFromOfficial(source)`
2. **别名**: 查询所有 provider 的 aliases, 匹配则调用 `installFromOfficial(resolvedKey)`
3. **`owner/repo` 简写** (如 `vercel-labs/agent-skills`):
   - 调用 `findOfficialProvider(owner, repo)`:
     - `exactRepoMatch: true` → 调用 `installFromOfficial(providerKey, repo)` 仅安装该 repo
     - `exactRepoMatch: false` → 转为 GitHub URL, 走 URL 流程但归类为 official
     - `null` → 转为 GitHub URL, 走 community 流程
4. **GitHub URL** (含 `github.com`): 解析 owner/repo, 用 `findOfficialProvider` 判断分类
5. **其他 URL**: 直接使用 git clone

#### Scenario: anthropic 关键字安装
- **WHEN** 用户执行 `skillsmgr install anthropic`
- **THEN** 匹配 `OFFICIAL_PROVIDERS['anthropic']`, 遍历其 repos, 安装到 `official/anthropic/{repoName}/`

#### Scenario: 别名安装
- **WHEN** 用户执行 `skillsmgr install vercel`
- **THEN** 解析别名为 vercel-labs, 调用 `installFromOfficial('vercel-labs')`

#### Scenario: owner/repo 简写, 已注册 repo
- **WHEN** 用户执行 `skillsmgr install vercel-labs/agent-skills`
- **THEN** findOfficialProvider 返回 exactRepoMatch=true, 调用 `installFromOfficial('vercel-labs', 'agent-skills')`

#### Scenario: owner/repo 简写, 未注册 repo
- **WHEN** 用户执行 `skillsmgr install vercel-labs/new-repo`
- **THEN** findOfficialProvider 返回 exactRepoMatch=false, 转为 GitHub URL, 安装到 `official/vercel-labs/new-repo/`

#### Scenario: owner/repo 简写识别为 community
- **WHEN** 用户执行 `skillsmgr install obra/superpowers`
- **THEN** 解析 owner=obra, repo=superpowers, 反查 registry 无匹配, 安装到 `community/obra/superpowers/`

#### Scenario: GitHub URL 识别为 official
- **WHEN** 用户执行 `skillsmgr install https://github.com/vercel-labs/agent-skills`
- **THEN** 解析 owner=vercel-labs, repo=agent-skills, 反查 registry 匹配, 安装到 `official/vercel-labs/agent-skills/`

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

### GitHub API 下载流程 (优先路径)

#### installFromOfficial(providerKey)

通用 official 安装路径, 适用于所有 `OFFICIAL_PROVIDERS` 中的提供者:

1. 从 `OFFICIAL_PROVIDERS[providerKey]` 获取 `owner`, `repo`, `skillsPath`
2. 如有 `skillsPath`, 直接调用 `listSkills(owner, repo, skillsPath)`; 否则依次在 `['skills', '.', 'src/skills']` 搜索
3. 获取 default branch
4. 如果没有 skill → `process.exit(1)` 并报错 "No skills found in repository"
5. 有 skill 时:
   - 使用 ProgressBar 逐个获取 SKILL.md 描述 (通过 raw.githubusercontent.com)
   - 获取失败时 description 为空, 不中断流程
   - 提示用户选择 (除非 `--all` 或 `--skill` 已指定)
   - 用户不选择任何 skill 时输出 "No skills selected" 并返回 (不 exit)
   - 下载选中的 skill
6. 保存 source 元数据, key 为 `"official/{providerKey}"`, URL 为 `"https://github.com/{owner}/{repo}"`

#### Scenario: Install official skills only
- **WHEN** 用户执行 `install anthropic` 或 `install openai`
- **THEN** 只下载和安装 skill, 不查找或安装 commands

#### Scenario: No skills found in official repo
- **WHEN** official 仓库中没有 skill
- **THEN** 输出 "No skills found in repository" 并 exit(1), 不再尝试安装 commands

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
3. 有 skill 时正常流程 (提示选择, 下载)
4. **没有子目录 skill 时, 检查根目录 SKILL.md**:
   - 通过 `raw.githubusercontent.com/{owner}/{repo}/{branch}/SKILL.md` 获取根目录 SKILL.md
   - 如果存在 (HTTP 200): 解析 frontmatter 获取 name 和 description, name 为空时 fallback 为 repo 名
   - 将整个仓库根目录内容下载到 `{targetBase}/{skillName}/`
   - 直接安装, 不提示用户选择 (单 skill 仓库)
   - 保存 source 元数据
   - 返回 true
5. 根目录也没有 SKILL.md 时 → 返回 false
6. 有 skill 时 (子目录形式):
   - 逐个获取 SKILL.md 描述, **没有 SKILL.md 的目录 SHALL 作为分组目录处理**: 再调用一次 `listSkills()` 获取其子目录, 对每个子目录检查 SKILL.md. 发现的 skill 使用其完整路径 (如 `skills/research-en/research`) 作为 path, 但 name 仅为最后一段目录名.
   - 分组目录探测限制为一层 — 不做无限递归
   - 过滤后无 skill → 返回 false
   - 提示选择 (除非 `--all` 或 `--skill` 已指定), 单个 skill 时直接安装不提示
   - 用户不选择任何 skill 时输出 "No skills selected" 并返回 true (视为成功, 不回退到 git clone)
   - 下载选中的 skill
7. 确定 source key:
   - 反查 `OFFICIAL_PROVIDERS` 匹配 → `"official/{providerKey}"`
   - `--custom` → `"custom/{repo}"`
   - 默认 → `"community/{owner}/{repo}"`
8. 返回 true

#### Scenario: GitHub URL install skills only
- **WHEN** 用户安装 GitHub 仓库
- **THEN** 只搜索, 提示选择, 和下载 skill, 不处理 commands

#### Scenario: Repo with no skills
- **WHEN** 仓库中既无子目录 skill 也无根目录 SKILL.md
- **THEN** 返回 false (回退到 git clone), 不再因存在 commands 而返回 true

#### Scenario: Root SKILL.md detected after subdirectory search fails
- **WHEN** 仓库 URL 安装时, `listSkills()` 对所有路径都未找到子目录 skill, 但根目录存在 SKILL.md
- **THEN** 系统获取根目录 SKILL.md, 解析 frontmatter, 将仓库内容下载到 `{targetBase}/{skillName}/`, 返回 true

#### Scenario: Root SKILL.md not found either
- **WHEN** 仓库既无子目录 skill, 根目录也无 SKILL.md
- **THEN** 返回 false

#### Scenario: 扁平仓库结构正常识别
- **WHEN** 仓库 `skills/` 下的子目录都直接包含 SKILL.md (如 `skills/code-review/SKILL.md`)
- **THEN** 行为不变, 每个子目录被识别为 skill

#### Scenario: 分组嵌套结构识别
- **WHEN** 仓库 `skills/` 下的子目录不包含 SKILL.md, 但其子目录包含 SKILL.md (如 `skills/research-en/research/SKILL.md`)
- **THEN** 系统 SHALL 将分组目录展开, 识别嵌套的 skill, skill name 为最内层目录名 (如 `research`)

#### Scenario: 混合结构 — 扁平和嵌套共存
- **WHEN** 仓库 `skills/` 下部分子目录直接有 SKILL.md, 部分子目录为分组目录
- **THEN** 系统 SHALL 同时识别两种结构中的 skill

#### Scenario: 分组目录无 skill
- **WHEN** 仓库 `skills/` 下的子目录无 SKILL.md, 且其子目录也无 SKILL.md
- **THEN** 该子目录被忽略, 不作为 skill 或分组处理

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

git clone 回退路径中的目标目录和 source key SHALL 使用与 GitHub API 路径相同的规则:
- official (反查 registry 匹配): `official/{providerKey}/`
- community: `community/{owner}/{repo}/`
- custom: `custom/{repo}/`

1. 克隆仓库到目标目录
2. **检查 `skills/` 子目录**: 对所有仓库 (不限于 anthropic), 如果 `{repoPath}/skills/` 存在, 则将 skillsRoot 设为该目录
3. 递归扫描子目录查找包含 SKILL.md 的目录, 最大深度为 2 层:
   - 如果子目录包含 SKILL.md → 识别为 skill
   - 如果子目录不包含 SKILL.md 且深度未超限 → 继续扫描其子目录
4. **发现嵌套 skill 后, 将其移动到 `{repoPath}/{skill-name}/` 扁平路径** (如果 skill 不在 repoPath 直接子目录下). 移动完成后清理空的分组目录.
5. **如果未找到子目录 skill, 检查克隆目录根的 SKILL.md**:
   - 使用 `fileExists(join(repoPath, 'SKILL.md'))` 检查
   - 如果存在: 解析 frontmatter 获取 name (fallback 为仓库名)
   - 创建 `{repoPath}/{skillName}/` 子目录
   - 将根目录下所有非 `.git` 文件和目录移入该子目录
   - 删除 `.git` 目录 (不再需要, 已安装完成)
   - 作为单 skill 安装, 不提示选择
6. 无 skill → `process.exit(1)` 并输出 "No skills found in repository"
7. 有 skill 时选择逻辑:
   - `--skill` 指定了 skill 名称 → 仅安装指定的 skill, 跳过选择提示
   - `--all` 且无 `--skill` → 安装所有 skill, 跳过选择提示
   - 其他 → 提示选择 (单个 skill 时直接安装不提示)
8. "Found N skills." 输出: 有 `--skill` 过滤时反映过滤后的数量, 无过滤时反映仓库总数
9. **未选中的 skill 被物理删除** (`removeDir(skill.path)`)
10. 用户不选择任何 skill 时, **整个仓库目录被删除** (`removeDir(repoPath)`)
10. 保存 source 元数据

#### Scenario: Git clone install skills only
- **WHEN** 通过 git clone 安装仓库
- **THEN** 只查找和安装 skill, 不统计或提及 commands

#### Scenario: Git clone repo with no skills
- **WHEN** 克隆的仓库中没有 skill
- **THEN** 输出 "No skills found in repository" 并 exit(1)

#### Scenario: Git clone detects root SKILL.md
- **WHEN** GitHub API 失败后 git clone 仓库, 克隆目录根有 SKILL.md 但无子目录 skill
- **THEN** 系统将文件重组到 `{repoPath}/{skillName}/` 子目录, 直接安装

#### Scenario: Git clone root skill with no frontmatter name
- **WHEN** 根目录 SKILL.md 无 frontmatter name 字段
- **THEN** 使用仓库名作为 skill name

#### Scenario: Git clone 扁平仓库不受影响
- **WHEN** git clone 仓库, 根目录或 skills/ 下的子目录直接包含 SKILL.md
- **THEN** 行为不变, 正常识别和安装

#### Scenario: Git clone 识别 skills/ 子目录
- **WHEN** git clone 仓库, 仓库根目录有 `skills/` 子目录
- **THEN** 系统 SHALL 在 `skills/` 下搜索 skill, 而非仅在仓库根目录

#### Scenario: Git clone 识别嵌套 skill 并扁平化
- **WHEN** git clone 仓库, `skills/research-en/research/SKILL.md` 存在
- **THEN** 系统 SHALL 识别 `research` 为 skill, 安装后存储为 `{repoPath}/research/` (扁平化)

#### Scenario: Git clone community 目录
- **WHEN** GitHub API 失败, 回退 git clone 安装 `obra/superpowers`
- **THEN** 克隆到 `~/.skills-manager/community/obra/superpowers/`

#### Scenario: Git clone official 目录
- **WHEN** GitHub API 失败, 回退 git clone 安装 `openai/skills`
- **THEN** 反查 registry 匹配 openai, 克隆到 `~/.skills-manager/official/openai/`

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
- GitHub API 失败 → 输出 "GitHub API failed, falling back to git clone..." 并尝试 git clone
- 仓库中无 skill → `process.exit(1)` 并报错 "No skills found in repository"
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

- 仅通过 GitHub API 更新, 不支持 git clone 方式的 source 更新 (如果 parseGitHubUrl 返回 null, 该 source 被跳过并显示警告)
- 仅更新已安装的 skill, 不发现和安装新增内容
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

- test_install_officialShorthand_usesOfficialPath: official 快捷名安装到 official/{providerKey}/
- test_install_ownerRepoShorthand_resolvesToGitHubUrl: "user/repo" 格式正确解析为 GitHub URL
- test_install_ownerRepoWithTrailingSlash_trimmed: "user/repo/" 末尾斜杠被去掉
- test_install_ownerRepoWithProtocol_notResolvedAsShorthand: "https://user/repo" 不被视为简写 (包含 ://)
- test_install_ownerRepoThreeSegments_notResolvedAsShorthand: "a/b/c" 不匹配 (多于两段)
- test_install_githubUrl_usesGitHubApi: 包含 github.com 的 URL 尝试 GitHub API
- test_install_nonGithubUrl_usesGitClone: 非 GitHub URL 直接 git clone

### GitHub API 安装

- test_installFromOfficial_noSkills_exits: 仓库无 skill 时 process.exit(1)
- test_installFromOfficial_allOption_skipsPrompt: --all 选项跳过选择提示
- test_installFromOfficial_noSelection_returnsNoExit: 用户不选择时输出 "No skills selected" 但不 exit
- test_installFromOfficial_fetchSkillMdFails_emptyDescription: 获取 SKILL.md 失败时 description 为空, 不中断
- test_installFromOfficial_customSkillsPath_usesDirectPath: 有 skillsPath 时直接使用该路径
- test_installFromOfficial_noSkillsPath_scansDefaults: 无 skillsPath 时依次扫描默认路径
- test_installFromGitHubUrl_specificSkill_directDownload: tree URL 直接下载指定 skill, 无提示
- test_installFromGitHubUrl_repoUrl_searchesMultiplePaths: 仓库 URL 时依次搜索 skills/, ., src/skills/
- test_installFromGitHubUrl_parseFails_returnsFalse: URL 解析失败返回 false
- test_installFromGitHubUrl_customOption_installsToCustomDir: --custom 选项安装到 custom/ 目录

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
- test_update_updatesTimestamp: 更新完成后调用 updateTimestamp
- test_update_nonGithubSource_showsWarning: 无法解析的 URL 显示警告并跳过
