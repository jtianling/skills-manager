## 1. GitHubService 扩展

- [x] 1.1 在 `GitHubService` 中添加 `fetchRootFile(owner, repo, branch, fileName)` 方法, 通过 `raw.githubusercontent.com` 获取仓库根目录指定文件内容, 存在时返回内容字符串, 不存在时返回 null
- [x] 1.2 在 `GitHubService` 中添加 `downloadRepoRoot(owner, repo, targetDir)` 方法, 调用 `downloadDirectory(owner, repo, '', targetDir)` 下载整个仓库根目录内容到指定目录

## 2. Install 命令 - GitHub API 路径

- [x] 2.1 在 `installFromGitHubUrl()` 中, 当 `skills.length === 0` 且 commands 也为 0 时 (返回 false 之前), 添加根目录 SKILL.md 检测: 调用 `fetchRootFile` 获取 SKILL.md
- [x] 2.2 解析获取到的 SKILL.md frontmatter, 提取 name (fallback 为 repo) 和 description
- [x] 2.3 使用 `downloadRepoRoot` 将仓库内容下载到 `{targetBase}/{skillName}/`, 保存 source 元数据, 返回 true

## 3. Install 命令 - Git Clone 路径

- [x] 3.1 在 `installViaGitClone()` 中, 当子目录扫描未找到 skill 时, 检查 `join(repoPath, 'SKILL.md')` 是否存在
- [x] 3.2 存在根目录 SKILL.md 时: 解析 frontmatter 获取 name, 创建 `{repoPath}/{skillName}/` 子目录, 将所有非 `.git` 文件/目录移入子目录, 然后删除 `.git` 目录
- [x] 3.3 将根目录 skill 作为单 skill 处理, 跳过用户选择提示, 直接完成安装

## 4. Update 命令

- [x] 4.1 在 `updateSource()` 的 skill 更新逻辑中, 当 `listSkills()` 对所有路径都未找到远程 skill 时, 检查远程根目录 SKILL.md 是否存在
- [x] 4.2 根目录 SKILL.md 存在时, 使用根路径 `SKILL.md` (而非 `{skillsBasePath}/{skillName}/SKILL.md`) 进行内容对比
- [x] 4.3 内容变更时, 删除本地 skill 目录, 使用 `downloadRepoRoot` 重新下载整个仓库根目录到该目录

## 5. 测试验证

- [x] 5.1 使用 `https://github.com/199-biotechnologies/claude-deep-research-skill` 进行端到端 install 测试, 验证 skill 被正确安装到 `~/.skills-manager/community/claude-deep-research-skill/deep-research/`
- [x] 5.2 验证安装后 `skillsmgr list` 能发现该 skill, `skillsmgr add deep-research` 能正确部署
- [x] 5.3 验证 `skillsmgr update` 能正确检测和更新根目录 skill 仓库
