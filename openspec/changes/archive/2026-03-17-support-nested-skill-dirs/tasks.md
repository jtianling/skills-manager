## 1. GitHub API 路径

- [x] 1.1 修改 `src/commands/install.ts` 中 `installFromGitHubUrl()` 的 skill 发现循环: 当 `{subdir}/SKILL.md` 不存在时, 调用 `listSkills()` 获取子目录并检查每个子目录的 SKILL.md, 将发现的 skill 加入 skills 数组 (name 为最内层目录名, path 为完整路径如 `skills/research-en/research`)

## 2. Git clone 路径

- [x] 2.1 修改 `installViaGitClone()`: 对所有仓库 (不限 anthropic) 检查 `{repoPath}/skills/` 子目录, 存在时将 skillsRoot 设为该目录
- [x] 2.2 将单层 `getDirectoriesInDir` + `fileExists(SKILL.md)` 扫描改为递归扫描函数, 最大深度 2 层
- [x] 2.3 对发现的嵌套 skill, 将其目录移动到 `{repoPath}/{skill-name}/` 扁平位置, 清理空分组目录

## 3. 验证

- [x] 3.1 测试: `skillsmgr install https://github.com/Weizhena/Deep-Research-skills`, 确认能发现并列出所有 skill
- [x] 3.2 测试: 对已有的扁平结构仓库 (如 anthropic) 安装行为不变
