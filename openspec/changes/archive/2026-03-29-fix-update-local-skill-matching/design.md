## Context

`unify-local-source-handling` change 将 update 命令的 local-path 匹配实现为: resolve 为绝对路径后在 sources.json 中按 `url` 字段精确匹配.  但 install 存入的 url 是基于当时 CWD 的绝对路径, 用户在不同目录执行 update 时路径不匹配.  同时 install 的 "already exists" 检测只看目标目录是否存在, 与 update 的 sources.json 匹配不一致.

核心原则: **文件系统是 source of truth, sources.json 是辅助元数据.**

## Goals / Non-Goals

**Goals:**
- update 对 local-path 输入按 skill name 在中央仓库文件系统中查找, 不依赖 sources.json url 匹配
- install 的 "already exists" 检测与 update 统一, 都基于 skill name 查找
- 提取公共查找函数供 install 和 update 复用

**Non-Goals:**
- 不修改 group 机制本身
- 不修改远程 source 的 update 逻辑
- 不修改 sources.json 的数据结构

## Decisions

### D1: 按 skill name 在 custom 目录中扫描查找

**选择**: 新增 `findInstalledCustomSkill(skillName)` 函数, 在 `~/.skills-manager/custom/` 下递归查找 `{skillName}/SKILL.md`, 支持直接子目录和 group 子目录两层.

**扫描策略**:
```
~/.skills-manager/custom/
  jt-release/SKILL.md       → 匹配 "jt-release", key = "custom/jt-release"
  my-group/
    jt-codex/SKILL.md       → 匹配 "jt-codex", key = "custom/my-group/jt-codex"
```

判断规则: 子目录含 SKILL.md 则为 skill; 不含则视为 group 目录, 再扫下一层.

**替代方案**: 继续用 sources.json 匹配, 加 fallback — 复杂度更高, 仍依赖 registry 准确性.

### D2: update local-path 流程重构

**当前流程**:
```
absPath = resolve(cwd, source)
→ sources.json 查找 url === absPath
→ 找不到就报错
```

**新流程**:
```
sourcePath = resolve(cwd, source)
→ 验证 sourcePath 存在且有 SKILL.md
→ skillName = basename(sourcePath)
→ findInstalledCustomSkill(skillName)
→ 找到 → 对比 SKILL.md → up to date / updated
→ 找不到 → "skill '{skillName}' is not installed"
→ 最后更新 sources.json (有记录则更新 url, 无记录则补写)
```

### D3: install 统一使用 findInstalledCustomSkill

**当前**: `install` 通过 `getCustomSkillDir(name, group)` 构造目标路径, 检查该路径是否存在.

**改动**: 在 `prepareTargetDir` 之前, 先调用 `findInstalledCustomSkill(skillName)`. 如果找到:
- 且 group 一致 → 现有的 overwrite 流程
- 且 group 不一致 → 提示 "skill '{name}' already installed at {existingPath}, use different name or remove first"

这避免了同名 skill 在不同 group 下重复安装(部署层是 1D 的, 同名会冲突).

### D4: sources.json 维护策略

sources.json 不再是 update 的查找依据, 但仍作为元数据维护:
- update 成功后: 如果 sources.json 有该 skill 的记录, 更新 `url` 为当前 sourcePath 和 `updatedAt`; 如果没有, 补写一条
- 这保证了 sources.json 逐步修复为正确状态

## Risks / Trade-offs

- **扫描性能**: 每次查找需读目录, 但 custom skill 数量通常 <50, 性能不是问题
- **同名 skill 不同 group**: D3 阻止了这种情况, 这是有意的限制 — 部署层是 1D 的, 同名必然冲突
