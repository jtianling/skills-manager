## Context

`install-from-zip` 变更统一了 install 和 custom-install, 引入了 `detectSourceType` 做 source 格式识别. 但裸词 (`foo`) 会 fallback 到 `local-path`, 导致 install 和 update 对裸词的语义不一致. 同时 `update` 对 local-copy 来源仅跳过, `custom-update` 命令仍独立存在.

当前 `source-detection.ts:36` 的 fallback:
```typescript
return 'local-path'; // 裸词 fallback
```

当前 `update.ts:39-42` 的行为:
```typescript
if (info.installMethod === 'local-copy') {
  console.log(`  Skipping ...`);
}
```

## Goals / Non-Goals

**Goals:**
- `detectSourceType` 对未识别格式返回 `'unknown'`, 不做 fallback
- `update` 支持从 sources.json 记录的原始路径更新 local-copy 来源
- `update` 接受本地路径参数, 按路径匹配已安装 source
- 删除 `custom-update` 命令

**Non-Goals:**
- 不修改 zip 来源的 update 行为 (仍为跳过)
- 不修改 install 命令的其他逻辑
- 不支持从本地路径更新远程安装的 skill

## Decisions

### D1: detectSourceType 返回 'unknown' 而非 fallback

**选择**: 新增 `'unknown'` 类型, 裸词不再 fallback 到 `'local-path'`

**理由**: install 和 update 可以共用同一套识别规则. 裸词在 install 中报错("未知格式, 用 `./foo` 指定本地路径"), 在 update 中按已安装 source 名匹配.

### D2: local-copy update 通过 SKILL.md 内容对比决定是否重新拷贝

**选择**: 读取 sources.json 中的 `url` (原始路径), 对比原始路径和已安装路径的 SKILL.md 内容. 内容不同则重新拷贝整个目录.

**替代方案**: 每次都重新拷贝 — 无差异检测, 浪费 IO

**流程**:
```
updateLocalCopy(key, info):
  originalPath = info.url
  if !exists(originalPath) → 报错 "原始路径不存在"
  if !exists(originalPath/SKILL.md) → 报错 "SKILL.md 不存在"
  localContent = read(targetDir/SKILL.md)
  remoteContent = read(originalPath/SKILL.md)
  if same → "up to date"
  else → removeDir(targetDir) + copyDir(originalPath, targetDir) → "updated"
```

### D3: update 接受本地路径参数时按 url 字段匹配

**选择**: 当 `detectSourceType(source)` 返回 `'local-path'` 时, resolve 为绝对路径, 在 sources.json 中查找 `url` 匹配的记录, 找到则执行 local-copy update.

**流程**:
```
executeUpdate("./my-skill"):
  detectSourceType → 'local-path'
  absPath = resolve(cwd, "./my-skill")
  matchingKey = find source where info.url === absPath
  if found → updateLocalCopy(key, info)
  else → "No installed skill found from path: ..."
```

### D4: 直接删除 custom-update, 不做 deprecation

**理由**: pre-1.0, 用户量极小, 不需要渐进迁移.

## Risks / Trade-offs

- **原始路径失效**: local-copy source 的原始路径可能被移动或删除 → 报错提示, 用户可 `install ./new-path --force` 重装
- **Breaking change**: `install foo` 不再工作 → 报错信息明确引导用户使用 `./foo`
