## Context

skillsmgr 安装 Git 仓库时, 通过 `scanForSkills` 做浅层递归扫描来发现 SKILL.md 文件.  部分仓库(如 `microsoft/skills`)采用 plugin manifest 结构:

```
.claude-plugin/marketplace.json   ← 声明多个 plugin 及其路径
.claude-plugin/plugin.json        ← 声明单个 plugin
```

manifest 指定 `pluginRoot` 和每个 plugin 的 `source`/`skills` 字段, 将 skills 分布在深层嵌套路径中.  `npx skills` 已支持此机制, skillsmgr 需要对齐.

## Goals / Non-Goals

**Goals:**
- 解析 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json` 中的 skill 路径声明
- 将 manifest 发现的路径集成到现有 Git clone 安装流程中
- 路径安全校验, 防止 manifest 中的路径穿越攻击

**Non-Goals:**
- 不支持 manifest 中的远程 source(仅处理本地相对路径)
- 不实现 plugin grouping/naming 元数据(仅发现 skill 路径)
- 不修改 local 安装流程(仅影响 Git clone 路径)

## Decisions

### 1. 新建独立模块 `src/services/plugin-manifest.ts`

**选择**: 独立服务模块, 导出纯函数.
**替代方案**: 直接在 `install-git.ts` 内联解析逻辑.
**理由**: manifest 解析是独立关注点, 便于单独测试; 未来 local install 也可能需要.

### 2. 集成点: 在 `collectGitCloneSkills` 和 `findRepoSkills` 中优先使用 manifest

**选择**: manifest 发现的路径优先, 与递归扫描结果合并去重.
**替代方案**: 完全替代递归扫描.
**理由**: 向后兼容, 没有 manifest 的仓库仍走原有路径; manifest 可能不覆盖所有 skills(如 `.github/skills/` 下的顶层 skills).

### 3. 路径校验: 所有 manifest 路径必须以 `./` 开头且不含 `..`

**选择**: 与 `npx skills` 保持一致的校验规则.
**理由**: 防止 manifest 指向仓库外的路径, 这是安全基线.

### 4. 复用现有 `scanSkillDirectories` 扫描 manifest 指向的目录

**选择**: manifest 只负责提供搜索根路径, 实际 skill 发现复用已有扫描函数.
**替代方案**: manifest 模块自带扫描逻辑.
**理由**: 避免重复代码, 保持 SKILL.md 解析逻辑统一.

## Risks / Trade-offs

- **manifest 格式变化** → 当前实现基于 `npx skills` v1.4.6 的格式, 若上游变更需要适配.  风险低, 格式已被多个主要仓库采用.
- **性能** → manifest 可能声明大量 plugin 路径, 每个都需要扫描.  由于是 clone 后的本地文件操作, 影响可忽略.
- **JSON 解析错误** → manifest 文件格式错误时静默跳过, 回退到递归扫描.  与 `npx skills` 行为一致.
