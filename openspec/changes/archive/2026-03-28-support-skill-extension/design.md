## Context

当前 `detectSourceType()` 使用 `input.endsWith('.zip')` 判断 zip 包来源.  Anthropic 推出 `.skill` 打包格式, 本质是 ZIP 压缩包, 内部结构与 `.zip` skill 包完全一致.  现有安装流程 (`installFromZip`, `installFromRemoteZip`) 无需任何修改即可处理 `.skill` 文件.

## Goals / Non-Goals

**Goals:**
- `.skill` 扩展名的本地/远程文件走 zip 安装流程
- 保持与 `.zip` 完全一致的安装行为

**Non-Goals:**
- 不引入新的 SourceType 枚举值 (复用 `local-zip` / `remote-zip`)
- 不区分 `installMethod` (统一使用 `'zip'`)
- 不做 `.skill` 格式的特殊校验或解析

## Decisions

### 决策 1: 复用现有 SourceType, 不新增类型

`.skill` 映射到 `local-zip` / `remote-zip`, 不引入 `local-skill` / `remote-skill`.

**理由**: `.skill` 本质就是 zip, 安装流程完全一致. 新增类型会增加 switch 分支、测试用例和维护成本, 无实际收益.

**替代方案**: 新增 `local-skill` / `remote-skill` 类型 → 拒绝, 因为会在 `installBySourceType` 的 exhaustive switch 中新增两个分支, 而它们的处理逻辑与 zip 完全相同.

### 决策 2: 提取扩展名判断为辅助函数

将 `.endsWith('.zip')` 扩展为一个 `isZipLikeExtension()` 辅助函数, 同时检查 `.zip` 和 `.skill`.

**理由**: 避免在 remote-zip 和 local-zip 两处判断中重复扩展名列表, 未来若有更多 zip-like 扩展名也易于扩展.

## Risks / Trade-offs

- [风险] 未来其他工具可能使用 `.skill` 但内部结构不同 → 当前无需处理, 现有 `scanSkillDirectories` 会在找不到 `SKILL.md` 时给出明确错误
