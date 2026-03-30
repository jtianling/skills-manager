## Context

`remove` 命令当前只接受 skill 名称作为参数, 通过 `deployedSkills.find(s => s.name === skillName)` 做精确匹配.  `add` 命令已有 `detectArgFormat()` 和 `findRepoInCentralRepository()` 实现 `owner/repo` 路由, `uninstall` 命令通过正则 `/^[^/]+\/[^/]+$/` 检测格式并路由到 `uninstallSource()`.  `remove` 缺少这一层.

## Goals / Non-Goals

**Goals:**

- `remove` 支持 `owner/repo` 格式, 批量移除该 source 下已部署的 skills
- 复用已有的格式检测和中央仓库查找逻辑
- 保持现有 skill name 移除行为不变

**Non-Goals:**

- 不支持 URL 格式 (remove 不需要远程操作)
- 不改变 `--global` 模式的行为
- 不添加交互式选择 (直接移除所有匹配的已部署 skills)

## Decisions

### 1. 复用 `detectArgFormat` 和 `findRepoInCentralRepository`

将 `add.ts` 中的 `detectArgFormat` 和 `findRepoInCentralRepository` 提取到 `src/utils/source-detection.ts` (已有 `detectSourceType`) 或新建共享模块, 供 `remove` 和 `add` 共同使用.

**备选方案**: 在 `remove.ts` 中用简单正则 `/^[^/]+\/[^/]+$/` (如 `uninstall` 的做法).  选择复用 `detectArgFormat` 是因为它已经覆盖了 URL vs owner/repo 的区分, 更健壮.

### 2. owner/repo 匹配后直接移除所有已部署的 skills, 不交互

`remove` 是项目级操作 (移除部署), 不涉及不可逆删除 (不像 `uninstall` 会删除中央仓库文件).  因此不需要确认提示, 直接移除所有匹配的已部署 skills, 逐个输出 `✓ Removed <name>`.

如果该 source 下没有任何已部署的 skill, 输出 "No deployed skills found from '<owner/repo>'" 并 exit(1).

### 3. 通过中央仓库查找 skills, 再与 deployed skills 交叉匹配

不依赖 deployed skill 的 `source` 字段 (因为 `extractSourceFromPath` 只提取两段如 `community/mattpocock`, 而非完整三段 `community/mattpocock/skills`).  改为:

1. `findRepoInCentralRepository(ownerRepo)` 获取中央仓库中该 source 的所有 skill 名称
2. 过滤 `deployedSkills` 中 name 在这些名称内的

## Risks / Trade-offs

- **[风险] 中央仓库已卸载但部署仍存在**: 用户先 `uninstall` 了中央仓库的 skill, 但项目里 copy 模式的部署还在.  此时 `findRepoInCentralRepository` 找不到 skills, 会报 "No deployed skills found".  → 缓解: 用户可按 skill name 逐个 remove, 这是边缘场景.
- **[风险] 同名 skill 来自不同 source**: `remove mattpocock/skills` 通过中央仓库找到的 skill names 与 deployed skills 按 name 交叉匹配, 如果另一个 source 也有同名 skill, 可能误移除.  → 缓解: 交叉匹配时额外校验 deployed skill 的 source 前缀.
