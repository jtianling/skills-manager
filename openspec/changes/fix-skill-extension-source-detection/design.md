## Context

`detectSourceType()` 用 `isZipLikeExtension()` 判断输入是否为 `.zip` 或 `.skill` 后缀.  该判断位于所有其他检查之前 (URL 检查之后), 导致裸字符串 `foo.skill` 直接返回 `local-zip`.  `add` 命令依赖此函数区分 "skill 名称" 和 "安装来源", 合法 skill 名 `foo.skill` 因此被错误路由.

当前检测顺序:
1. URL + zip-like → `remote-zip`
2. zip-like → `local-zip` ← 问题: 裸 `foo.skill` 在这里命中
3. URL → `remote-url`
4. owner/repo → `owner-repo`
5. 路径前缀 → `local-path`
6. 其他 → `unknown`

## Goals / Non-Goals

**Goals:**
- 裸 `.skill` 字符串 (无路径前缀) 不再被识别为 `local-zip`
- 带路径前缀 (`./`, `/`, `~/`, `../`) 的 `.skill` 文件仍正确识别为 `local-zip`
- 带 URL 前缀的 `.skill` 仍正确识别为 `remote-zip`

**Non-Goals:**
- 不修改 `.zip` 扩展名的处理逻辑 (`.zip` 不是合法 skill 名, 无此问题)
- 不在 frontmatter 层面禁止 `.skill` 命名

## Decisions

### 裸 `.skill` 判断增加路径前缀要求

将第 2 步的 `isZipLikeExtension(input)` 条件收紧为: 仅当输入同时满足 zip-like 扩展名 **且** 带有明确路径前缀时, 才返回 `local-zip`.

**替代方案**: 在 `add` 命令侧特殊处理 `.skill` 后缀 — 先查中央仓库, 查不到再走 zip 分支.  拒绝原因: 改动面更大, 且 `install` 命令也有同样问题.

## Risks / Trade-offs

- [Risk] 用户直接 `skillsmgr install foo.skill` (裸名, 无 `./` 前缀) 安装本地 `.skill` 文件将不再生效, 需改为 `./foo.skill` → 这是行为变更, 但现有 spec 中示例已使用 `./foo.skill` 形式, 影响极小.  注意: 裸 `foo.zip` 目前也返回 `local-zip`, 本次仅修改 `.skill` 的处理, 不改 `.zip` (因为 `.zip` 不可能是合法 skill 名).
