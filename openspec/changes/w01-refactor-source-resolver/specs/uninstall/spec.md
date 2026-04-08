# Uninstall (delta)

## ADDED Requirements

### Requirement: 通过 SourceResolver 统一解析输入
uninstall 命令 SHALL 把所有 input 形式 (owner/repo, URL, 本地路径, registry 包名, 裸词) 委托给 SourceResolver.resolve 进行归一化, 基于返回的 ResolvedTarget 执行删除.  对 kind='batch-unsupported', 系统 SHALL 输出与 update 一致的引导消息并非零退出.  对 kind='not-found', 系统 SHALL 报错退出.

#### Scenario: owner/repo 输入经 resolver 处理
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** SourceResolver 返回 `sourceKeys: ['official/anthropic/skills']`
- **THEN** uninstall 按现有"卸载整个 source"流程继续 (列出 skills, 确认, 删除)

#### Scenario: owner/repo:skill 单 skill 卸载
- **WHEN** 用户执行 `skillsmgr uninstall obra/superpowers:my-skill`
- **THEN** SourceResolver 返回 `kind: 'skill'` 和单个 skill 信息
- **THEN** uninstall 只删除 `community/obra/superpowers/my-skill` 目录
- **THEN** 若该 source 下仍有其他 skill, 保留 sources.json 记录

#### Scenario: 本地 batch 路径被拒绝
- **WHEN** 用户执行 `skillsmgr uninstall ./spec-tdd` 且 spec-tdd 是 batch 目录
- **THEN** SourceResolver 返回 `kind: 'batch-unsupported'`
- **THEN** uninstall 输出引导消息: "Batch directory uninstall not yet supported. Uninstall individual skills by name: skillsmgr uninstall <skill-name>"
- **THEN** uninstall 以非零状态码退出, 不删除任何内容

#### Scenario: registry 包名卸载
- **WHEN** 用户执行 `skillsmgr uninstall code-review` 且 `registry/code-review` 已安装
- **THEN** SourceResolver 返回 `sourceKeys: ['registry/code-review']`
- **THEN** uninstall 删除对应目录和 sources.json 记录

### Requirement: 通过 HTTPS/SSH URL 卸载 (扩展)
uninstall 命令 SHALL 对 HTTPS/SSH 格式的 git URL 输入由 SourceResolver 进行归一化, 识别到的 owner/repo 按已有流程卸载.  新增对 `.git` 后缀, SSH 格式, 以及非 GitHub host 的 URL 归一化支持.

#### Scenario: HTTPS URL 带 .git 后缀
- **WHEN** 用户执行 `skillsmgr uninstall https://github.com/obra/superpowers.git`
- **THEN** SourceResolver 归一化去掉 `.git` 后缀
- **THEN** 行为与 `skillsmgr uninstall obra/superpowers` 一致

#### Scenario: SSH URL 带 .git 后缀
- **WHEN** 用户执行 `skillsmgr uninstall git@github.com:obra/superpowers.git`
- **THEN** SourceResolver 归一化得到 owner/repo
- **THEN** 行为与 `skillsmgr uninstall obra/superpowers` 一致

#### Scenario: 非 GitHub URL
- **WHEN** 用户执行 `skillsmgr uninstall https://gitlab.com/foo/bar` 且该源以此 URL 安装
- **THEN** SourceResolver 通过扫描 sources.json 的 url 字段匹配到对应 source key
- **THEN** 按匹配到的 source key 执行卸载

## MODIFIED Requirements

### Requirement: 按 provider 卸载
系统 SHALL 支持通过 owner/repo 格式卸载 official provider 下的仓库, 经由 SourceResolver 进行 owner 翻译 (如 `anthropics → anthropic`).  命令格式: `skillsmgr uninstall <owner>/<repo>`.  系统 SHALL 同时支持 provider 的别名 (如 `vercel -> vercel-labs`).

#### Scenario: 卸载整个 official provider
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** SourceResolver 翻译 `anthropics` 为 `anthropic`, 返回 `sourceKeys: ['official/anthropic/skills']`
- **THEN** 系统列出 `~/.skills-manager/official/anthropic/skills/` 下所有已安装的 skills
- **THEN** 系统警告 symlink 部署可能失效
- **THEN** 系统请求用户确认
- **THEN** 确认后删除 `~/.skills-manager/official/anthropic/skills/` 目录及其所有内容
- **THEN** 清理 `sources.json` 中对应的 source 记录

#### Scenario: 通过别名卸载 provider
- **WHEN** 用户执行 `skillsmgr uninstall vercel/agent-skills`
- **THEN** SourceResolver 将 `vercel` 解析为 `vercel-labs`
- **THEN** 行为与直接使用 `vercel-labs/agent-skills` 一致

#### Scenario: provider 不存在
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills` 但 `~/.skills-manager/official/anthropic/skills/` 不存在
- **THEN** SourceResolver 返回 `kind: 'not-found'`
- **THEN** 系统输出错误信息并退出
