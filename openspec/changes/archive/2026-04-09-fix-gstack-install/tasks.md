## 1. copyDir symlink 处理

- [x] 1.1 修改 `src/utils/fs.ts` 的 `copyDir`: 对 `entry.isSymbolicLink()` 用 `symlinkSync(readlinkSync(srcPath), destPath)` 保留 symlink, 对既非 directory/file/symlink 的条目静默跳过
- [x] 1.2 在 `src/utils/fs.test.ts` 添加 copyDir 测试: symlink-to-file, symlink-to-directory, 嵌套目录中的 symlink

## 2. collectGitCloneSkills 发现逻辑

- [x] 2.1 修改 `src/commands/install-git.ts` 的 `collectGitCloneSkills`: 根 SKILL.md 存在时先扫描子目录(depth 3), 有子目录 skill 则返回子目录 skill, 无则退回根作为单 skill
- [x] 2.2 在 `src/commands/install-git.test.ts` 添加测试: flat multi-skill repo(根 + 子目录 SKILL.md), 仅根 SKILL.md repo, depth-3 嵌套发现, depth-1 与 depth-3 共存
