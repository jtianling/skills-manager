## Purpose
TBD - update after review.

## Requirements

### Requirement: setup 命令测试
setup 命令 SHALL 有单元测试覆盖目录创建, 模板复制, 幂等执行.

#### Scenario: 首次执行创建目录结构
- **WHEN** executeSetup() 在空的 SKILLS_MANAGER_DIR 下执行
- **THEN** 创建 official/, community/, custom/ 子目录
- **THEN** 复制 example-skill 模板到 custom/example-skill/

#### Scenario: 重复执行不覆盖已有模板
- **WHEN** executeSetup() 在已有 custom/example-skill/ 的目录下执行
- **THEN** 不覆盖已有的 example-skill
- **THEN** 输出 "already exists, skipping"

### Requirement: install 命令测试
install 命令 SHALL 有单元测试覆盖各种输入格式的路由逻辑和下载流程.  网络调用 mock 在 service 级别.

#### Scenario: official provider shorthand
- **WHEN** executeInstall("anthropic", { all: true }) 执行
- **THEN** 调用 installFromOfficial 并下载到 official/anthropic/ 目录

#### Scenario: provider alias 解析
- **WHEN** executeInstall("vercel", { all: true }) 执行
- **THEN** 解析 alias 为 "vercel-labs" 并调用 installFromOfficial

#### Scenario: owner/repo shorthand
- **WHEN** executeInstall("someowner/somerepo", { all: true }) 执行
- **THEN** 构造 GitHub URL 并尝试 API 下载

#### Scenario: GitHub URL 输入
- **WHEN** executeInstall("https://github.com/owner/repo", { all: true }) 执行
- **THEN** 解析 URL 并下载 skills

#### Scenario: 未 setup 时退出
- **WHEN** SKILLS_MANAGER_DIR 不存在时执行
- **THEN** 输出 "not set up" 并退出

#### Scenario: --all 跳过交互选择
- **WHEN** options.all 为 true
- **THEN** 不调用 interactiveCheckbox 或 promptSkillsToInstall

### Requirement: update 命令测试
update 命令 SHALL 有单元测试覆盖远程比对, 单源更新, 全量更新.

#### Scenario: SKILL.md 内容一致时 up to date
- **WHEN** 本地和远程 SKILL.md 内容一致
- **THEN** 输出 "up to date", 不重新下载

#### Scenario: SKILL.md 内容不同时更新
- **WHEN** 本地和远程 SKILL.md 内容不同
- **THEN** 删除本地目录, 重新下载, 输出 "updated"

#### Scenario: 指定 source 只更新匹配的
- **WHEN** executeUpdate("anthropic") 执行
- **THEN** 只更新 key 匹配 "anthropic" 的 source

#### Scenario: 无已安装 sources
- **WHEN** sources.json 为空
- **THEN** 输出 "No installed sources found"

### Requirement: init 命令测试
init 命令 SHALL 有单元测试覆盖 skill 部署, bridge 创建, unmanaged 保留.

#### Scenario: link 模式部署
- **WHEN** deployMode 为 link
- **THEN** 在 .agents/skills/ 创建 symlink 指向 central repo

#### Scenario: copy 模式部署
- **WHEN** options.copy 为 true
- **THEN** 复制文件到 .agents/skills/

#### Scenario: 非原生工具创建 symlink bridge
- **WHEN** 选择 claude-code 等非原生工具
- **THEN** 创建 .claude/skills → .agents/skills symlink

#### Scenario: 取消选择的工具移除 bridge
- **WHEN** 之前配置的非原生工具未被选中
- **THEN** 移除对应的 symlink bridge

#### Scenario: unmanaged skills 保留
- **WHEN** .agents/skills/ 中有不在 central repo 的 skill
- **THEN** 标记为 unmanaged, 不删除

### Requirement: remove 命令测试
remove 命令 SHALL 有单元测试覆盖正常删除和错误情况.

#### Scenario: 删除已部署的 skill
- **WHEN** executeRemove(name) 且 skill 存在于 .agents/skills/
- **THEN** 删除对应目录, 输出 "Removed"

#### Scenario: skill 不存在
- **WHEN** executeRemove(name) 且 skill 不在已部署列表中
- **THEN** 输出 "not found" 并退出

#### Scenario: 无部署 skills
- **WHEN** .agents/skills/ 为空
- **THEN** 输出 "No skills deployed" 并退出

### Requirement: SourcesService 测试
SourcesService SHALL 有单元测试覆盖 CRUD 操作和 JSON 持久化.

#### Scenario: addSource 创建新记录
- **WHEN** addSource(key, info) 对新 key 调用
- **THEN** sources.json 中包含该 key 的记录, 含 installedAt 和 updatedAt

#### Scenario: addSource 更新已有记录
- **WHEN** addSource(key, info) 对已有 key 调用
- **THEN** 更新记录, 保留 installedAt, 更新 updatedAt

#### Scenario: removeSource 删除记录
- **WHEN** removeSource(key) 调用
- **THEN** sources.json 中不再包含该 key

#### Scenario: getAllSources 返回所有记录
- **WHEN** 有多个 source 已添加
- **THEN** getAllSources() 返回包含所有 key 的对象

#### Scenario: sources.json 不存在时返回空
- **WHEN** sources.json 文件不存在
- **THEN** getAllSources() 返回空对象

### Requirement: GitService 测试
GitService SHALL 有单元测试覆盖 clone 命令构造和 URL 解析.  execSync mock 在调用级别.

#### Scenario: clone 构造正确的 git 命令
- **WHEN** clone(url, false) 调用
- **THEN** 执行 git clone --depth 1 到 community/ 目录

#### Scenario: clone custom 到 custom 目录
- **WHEN** clone(url, true) 调用
- **THEN** 执行 git clone --depth 1 到 custom/ 目录

#### Scenario: isSpecificSkillUrl 识别 tree URL
- **WHEN** URL 包含 /tree/ 路径
- **THEN** 返回 true

#### Scenario: isSpecificSkillUrl 拒绝普通 URL
- **WHEN** URL 是普通的 repo URL
- **THEN** 返回 false
