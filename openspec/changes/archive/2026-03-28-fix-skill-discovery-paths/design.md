## Context

`plugin-manifest.ts` 的 `getPluginSkillPaths` 对 `plugin.json` 只调用 `parsePluginManifest` (读顶层 `skills` 字段).  但实际 marketplace 生态中, `plugin.json` 也可以用 marketplace 格式 (含 `metadata.pluginRoot` + `plugins[]`).  microsoft/skills 就是这种情况.

同时, git clone 和 GitHub API 两条发现路径的标准目录列表不完整, 缺少 ref repo 规范中的 `.agents/skills/` 和 `.claude/skills/`.

## Goals / Non-Goals

**Goals:**
- `plugin.json` 同时支持简单格式和 marketplace 格式
- 标准发现路径与 ref repo 规范对齐
- 两条安装路径 (git clone / GitHub API) 行为一致

**Non-Goals:**
- 不改变已有 marketplace.json 解析逻辑
- 不增加新的 manifest 文件类型

## Decisions

### D1: plugin.json 格式检测策略

**选择**: 检测 parsed JSON 是否有 `plugins` 数组字段, 有则走 `parseMarketplaceManifest`, 否则走 `parsePluginManifest`.  两个解析器都调用, 结果合并去重.

**替代方案**: 只走 marketplace 解析.  不选, 因为简单格式的 `plugin.json` (只有顶层 `skills`) 也要继续支持.

**实现**: 在 `getPluginSkillPaths` 中, 对 `plugin.json` 的 parsed result 判断是否有 `plugins` 属性, 有则同时调用 `parseMarketplaceManifest`.

### D2: 标准发现路径列表

**选择**: 提取为常量数组, git clone 和 GitHub API 共享:

```typescript
const STANDARD_SKILL_PATHS = [
  'skills',
  '.agents/skills',
  '.claude/skills',
  '.github/skills',
];
```

`skills/.curated/`, `skills/.experimental/`, `skills/.system/` 不需要单独列出 — 递归扫描 `skills/` 时会自然覆盖这些子目录.

## Risks / Trade-offs

- [风险: plugin.json 同时匹配两种格式] → 两种解析结果合并去重, 不会产生重复 skill, 无实际影响
- [风险: 新增标准路径增加扫描时间] → 路径不存在时快速跳过 (GitHub API 返回 404 / fs 检查不存在), 开销可忽略
