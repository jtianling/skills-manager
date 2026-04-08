# Source Resolver

统一的 input 字符串到已安装 source 的归一化查找层, 被 `update` 和 `uninstall` 命令共享使用.  resolve 过程不修改任何状态, 只返回匹配结果.

## ADDED Requirements

### Requirement: resolve 单一入口

系统 SHALL 提供 `SourceResolver.resolve(input: string): Promise<ResolvedTarget>` 作为所有 input 形式的统一解析入口.  ResolvedTarget 数据结构 MUST 包含字段: `kind` ('source' | 'skill' | 'batch-unsupported' | 'not-found'), `sourceKeys` (string[]), `skills` (SkillInfo[] | undefined), `reason` (string | undefined), `originalInput` (string).

#### Scenario: 成功匹配单个 source
- **WHEN** 调用 `resolve('obra/superpowers')` 且 `community/obra/superpowers` 已安装
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['community/obra/superpowers'], ... }`

#### Scenario: 未匹配任何已安装 source
- **WHEN** 调用 `resolve('nonexistent/repo')`
- **THEN** 返回 `{ kind: 'not-found', sourceKeys: [], reason: <人类可读原因>, originalInput: 'nonexistent/repo' }`

### Requirement: Official owner 翻译

resolver SHALL 对 owner/repo 形式的输入先走 `findOfficialProvider(owner)` 翻译, 然后按 `official/{providerKey}/{repo}` 格式匹配已安装 source.  若 owner 不是 official owner, 则按 `community/{owner}/{repo}` 格式匹配.

#### Scenario: Official owner 正确翻译
- **WHEN** 调用 `resolve('anthropics/skills')`
- **THEN** resolver 内部调用 `findOfficialProvider('anthropics')` 得到 `'anthropic'`
- **THEN** 尝试匹配 `official/anthropic/skills`
- **THEN** 成功返回 `{ kind: 'source', sourceKeys: ['official/anthropic/skills'], ... }`

#### Scenario: Community owner 无翻译
- **WHEN** 调用 `resolve('obra/superpowers')`
- **THEN** `findOfficialProvider('obra')` 返回 null
- **THEN** 尝试匹配 `community/obra/superpowers`
- **THEN** 成功返回 `{ kind: 'source', sourceKeys: ['community/obra/superpowers'], ... }`

#### Scenario: Owner 别名支持
- **WHEN** 调用 `resolve('vercel/agent-skills')` 且系统注册 `vercel` 为 `vercel-labs` 的别名
- **THEN** resolver 按 `official/vercel-labs/agent-skills` 匹配

### Requirement: URL 归一化

resolver SHALL 接受 HTTPS 和 SSH 格式的 git URL, 并归一化到 owner/repo 后走 owner/repo 匹配流程.  归一化 MUST 去掉 `.git` 后缀, 识别 `git@host:owner/repo` 和 `https://host/owner/repo` 为等价.

#### Scenario: HTTPS URL 归一化
- **WHEN** 调用 `resolve('https://github.com/obra/superpowers')`
- **THEN** resolver 提取 `{owner: 'obra', repo: 'superpowers'}`
- **THEN** 按 owner/repo 匹配流程返回 `community/obra/superpowers`

#### Scenario: HTTPS URL 带 .git 后缀
- **WHEN** 调用 `resolve('https://github.com/obra/superpowers.git')`
- **THEN** 归一化结果与不带 `.git` 后缀等价

#### Scenario: SSH URL 归一化
- **WHEN** 调用 `resolve('git@github.com:obra/superpowers.git')`
- **THEN** 归一化结果与 HTTPS URL 等价

#### Scenario: 非 GitHub 托管服务
- **WHEN** 调用 `resolve('https://gitlab.com/foo/bar')` 且该 source 以此 URL 安装
- **THEN** resolver 扫描 sources.json 中 `url` 字段, 按 URL 字符串归一化比对
- **THEN** 找到命中则返回对应 source key

### Requirement: Owner/repo:skill 单 skill 查找

resolver SHALL 支持 `owner/repo:skill` 格式的输入, 精确匹配到单个已安装 skill.  若 skill 不在已安装列表中, 返回 `not-found` 而不是自动安装.

#### Scenario: 精确匹配单 skill
- **WHEN** 调用 `resolve('obra/superpowers:my-skill')` 且 `community/obra/superpowers/my-skill` 已安装
- **THEN** 返回 `{ kind: 'skill', sourceKeys: ['community/obra/superpowers'], skills: [<my-skill info>], ... }`

#### Scenario: source 已安装但 skill 未安装
- **WHEN** 调用 `resolve('obra/superpowers:unknown-skill')` 且 superpowers 已装但不含该 skill
- **THEN** 返回 `{ kind: 'not-found', reason: <说明 skill 未安装>, ... }`

### Requirement: Registry 包名查找

resolver SHALL 识别 registry 包名输入 (bare name, scoped name, 和带 @version 后缀的形式), 匹配已安装的 `registry/{packageName}` source.  `@version` 后缀 MUST 被解析为目标版本, 包含在 ResolvedTarget 扩展字段中供调用方使用.

#### Scenario: 裸包名匹配
- **WHEN** 调用 `resolve('code-review')` 且 `registry/code-review` 已安装
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['registry/code-review'], ... }`

#### Scenario: 带版本的包名
- **WHEN** 调用 `resolve('code-review@1.2.0')` 且 `registry/code-review` 已安装
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['registry/code-review'], ... }` 并在扩展字段中记录 `requestedVersion: '1.2.0'`

#### Scenario: Scoped 包名
- **WHEN** 调用 `resolve('@acme/skill-x')` 且 `registry/@acme/skill-x` 已安装
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['registry/@acme/skill-x'], ... }`

### Requirement: 本地路径查找

resolver SHALL 接受本地路径输入 (`./`, `../`, `/`, `~/` 前缀), 归一化为绝对路径后, 按 sources.json 中 `url` 字段字面匹配已安装的 local-copy source.

#### Scenario: 相对路径匹配
- **WHEN** 调用 `resolve('./my-skill')` 且 `custom/my-skill` 已安装并 url 指向该路径的绝对形式
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['custom/my-skill'], ... }`

#### Scenario: 绝对路径匹配
- **WHEN** 调用 `resolve('/Users/foo/my-skill')` 且对应 source 已安装
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['custom/my-skill'], ... }`

#### Scenario: 家目录展开
- **WHEN** 调用 `resolve('~/workspace/my-skill')`
- **THEN** resolver 展开 `~` 为 `process.env.HOME` 后进行字面匹配

#### Scenario: 路径不是 batch 目录但 SKILL.md 存在
- **WHEN** 输入路径存在且包含 SKILL.md, 对应 custom skill 已安装
- **THEN** 返回 kind='source' 单 skill 结果

### Requirement: 本地 batch 目录返回 batch-unsupported

resolver SHALL 对本地路径输入做 SKILL.md 存在性检查.  若路径存在但根目录无 SKILL.md, 且子目录中存在 SKILL.md, 则视为 batch 目录, 返回 `kind: 'batch-unsupported'` 并在 reason 中说明将在 w03 支持, 当前可通过更新单个子 skill 作为 workaround.

#### Scenario: Batch 目录返回 batch-unsupported
- **WHEN** 调用 `resolve('./spec-tdd')` 且 `spec-tdd/` 根无 SKILL.md 但子目录有
- **THEN** 返回 `{ kind: 'batch-unsupported', sourceKeys: [], reason: <引导用户 update 单个子 skill 的说明>, originalInput: './spec-tdd' }`

#### Scenario: Batch 目录但无已安装成员
- **WHEN** 调用 `resolve('./random-dir')` 且是 batch 目录但无任何成员被安装
- **THEN** 返回 `kind: 'batch-unsupported'` (仍用该 kind, reason 额外说明无已安装成员)

### Requirement: 裸词兜底查找

对不匹配任何已知格式 (URL, owner/repo, owner/repo:skill, 本地路径) 的裸词输入, resolver SHALL 按以下优先级依次尝试匹配:

1. 作为 registry 包名 (走 `parseRegistryInput`)
2. 作为已安装 source key 的后缀 (endsWith 比较, 与旧 fuzzy 行为兼容)
3. 作为 `repoName` 字段精确匹配
4. 作为 skill name (走 `resolveSkillByName`, 多匹配时触发交互式选择)

首个命中即返回, 全部失败返回 `not-found`.

#### Scenario: 裸词命中 source key 后缀
- **WHEN** 调用 `resolve('superpowers')` 且已安装 `community/obra/superpowers`
- **THEN** 按优先级 2 命中, 返回 `{ kind: 'source', sourceKeys: ['community/obra/superpowers'], ... }`

#### Scenario: 裸词命中 skill name
- **WHEN** 调用 `resolve('code-review')` 且 registry 没装但有 skill 叫 `code-review`
- **THEN** 按优先级 4 命中, 返回 kind='skill'

#### Scenario: 多个 skill name 匹配触发交互
- **WHEN** `resolveSkillByName('foo')` 返回多个命中
- **THEN** resolver SHALL 透传交互式选择的结果作为最终 skills

#### Scenario: 全部优先级都未命中
- **WHEN** 输入在所有优先级下都未找到匹配
- **THEN** 返回 `{ kind: 'not-found', reason: <列出尝试过的匹配路径>, ... }`

### Requirement: resolve 不产生副作用

SourceResolver 的 resolve 方法 SHALL 是只读操作.  resolve 期间 MUST NOT 修改 sources.json / groups.json / 本地文件系统, MUST NOT 触发安装 / 下载 / 删除操作.

#### Scenario: resolve 调用后状态不变
- **WHEN** 调用 `resolve(anyInput)`
- **THEN** sources.json 文件 mtime 和内容不变
- **THEN** 本地文件系统无新增/删除/修改
