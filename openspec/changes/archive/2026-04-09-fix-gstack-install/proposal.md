## Why

`skillsmgr install garrytan/gstack` 失败, 暴露两个 bug: (1) `copyDir` 不处理 symlink, 对 symlink-to-directory 调用 `copyFileSync` 在 macOS 上报 ENOTSUP; (2) `collectGitCloneSkills` 在根 SKILL.md 存在时短路, 把整个 repo 当作单个 skill, 忽略子目录中的 37 个独立 skill.

## What Changes

- `copyDir` 增加 symlink 检测: 对 `isSymbolicLink()` 条目用 `symlinkSync(readlinkSync())` 保留原始 symlink, 跳过其他非常规文件(socket, FIFO 等)
- `collectGitCloneSkills` 修改发现逻辑: 根 SKILL.md 存在时仍扫描子目录, 若发现子目录 skill 则返回子目录 skill 列表(不含 root); 扫描深度从 1 提升到 3, 覆盖 `openclaw/skills/*/SKILL.md` 等嵌套结构
- 两项修改均需补充测试

## Capabilities

### New Capabilities
- `symlink-copy`: copyDir 正确处理 symlink 和非常规文件类型
- `flat-multiskill-discovery`: 根 SKILL.md 与子目录 skill 共存时的发现逻辑

### Modified Capabilities

## Impact

- `src/utils/fs.ts`: `copyDir` 函数修改
- `src/commands/install-git.ts`: `collectGitCloneSkills` 函数修改
- `src/utils/fs.test.ts`: 新增 symlink 复制测试
- `src/commands/install-git.test.ts`: 新增 flat multi-skill repo 发现测试
