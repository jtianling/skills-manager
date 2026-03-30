## Context

当前 `install` 和 `custom-install` 是两个独立的命令. `install` 处理远程源(official provider shorthand, alias, owner/repo, GitHub URL, git clone), `custom-install` 处理本地目录拷贝. 两者的 source 追踪不一致: `install` 写 sources.json, `custom-install` 不写.

`add` 命令作为上层路由, 通过 `detectArgFormat()` 区分 url/owner-repo/skill-name 三种格式, 但不涉及本地路径.

用户需要自行判断该用哪个命令, 且无法从 zip 文件安装 skill.

## Goals / Non-Goals

**Goals:**
- 统一 `install` 和 `custom-install` 为单一命令, 通过 source 格式自动路由
- 支持本地 zip 文件和远程 zip URL 安装
- 所有安装方式统一写入 sources.json
- `--group` (`-g`) 参数对所有安装方式可用

**Non-Goals:**
- 不实现 zip 来源的 `update` 功能(zip 无法增量更新)
- 不实现 skill 在 group 之间的移动功能
- 不修改 `add` 命令的部署逻辑(仅简化路由)
- 不修改 `uninstall` 命令

## Decisions

### D1: Source 识别使用确定性规则, 不做启发式推断

**选择**: 基于输入格式的确定性匹配, 裸词一律视为本地目录

**替代方案**:
- A) 裸词不存在时 fallback 到远程搜索 — 行为不可预测, 网络环境影响结果
- B) 要求所有本地路径以 `./` 开头 — 增加用户负担, 不符合 shell 习惯

**规则(按优先级)**:
1. 以 `https://` 开头且 `.zip` 结尾 → 远程 zip
2. 以 `.zip` 结尾(其他前缀) → 本地 zip
3. 以 `https://` 或 `git@` 开头 → 远程 URL(GitHub 或 git clone)
4. 匹配 `owner/repo` 格式(含一个 `/`) → GitHub 仓库
5. 以 `/` `./` `../` `~` 开头 → 本地目录路径
6. 其他裸词 → 解析为 `./name` 本地目录, 不存在则报错

### D2: Zip 安装使用临时目录解压后走已有扫描逻辑

**选择**: 解压到 temp → 扫描 SKILL.md → 复用 `custom-install` 的拷贝逻辑

**理由**: 复用已有的 SKILL.md 扫描和目录拷贝代码, 最小化新增逻辑. 解压后的处理与本地目录安装完全一致.

**流程**:
```
zip input → temp dir → unzip → scan SKILL.md → select skills → copy to target → cleanup temp
```

远程 zip 多一步 download:
```
zip URL → download to temp → (same as above)
```

### D3: sources.json 扩展 installMethod 字段

**选择**: 新增可选字段 `installMethod: 'git' | 'zip' | 'local-copy'`, 默认 `'git'`

**替代方案**: 用 `updatable: boolean` 字段 — 过于简单, 无法区分不同的不可更新原因

**影响**: `update` 命令检查 `installMethod`, zip 和 local-copy 来源跳过更新并提示用户.

### D4: --group 直接影响目标目录, 不改变 source type

**选择**: `--group` 时目标目录为 `custom/{group}/{skill}/`, source type 仍根据来源决定, source key 中编码 group 信息

**Key 格式**: `custom/{group}/{skill}` 或 `{type}/{owner}/{repo}` (无 group 时不变)

**理由**: group 是用户的组织偏好, 不是 source 的固有属性. 远程安装加 `--group` 时, url 仍保留, update 仍可工作.

### D5: 删除 official provider shorthand 和 alias 机制

**选择**: 直接删除, 不做 deprecation warning

**理由**: 这是 pre-1.0 阶段, 用户量极小, 不需要渐进迁移. `owner/repo` 形式足够简短且更明确.

## Risks / Trade-offs

- **Breaking change**: `custom-install` 用户需改用 `install` → 风险低, pre-1.0 阶段
- **Breaking change**: `skillsmgr install anthropic` 不再工作 → 文档需更新, 改用 `anthropics/skills`
- **Zip 安全性**: 解压 zip 可能包含恶意内容 → 仅解压到 temp, 只拷贝含 SKILL.md 的目录
- **大型 zip 文件**: 远程下载可能很慢 → 显示进度提示, 不做大小限制
- **裸词误判**: 用户本意是远程但输入裸词 → 报错信息明确说明 "如需远程安装请使用 owner/repo 格式"
