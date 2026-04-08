# Release Notes: bundle tracking v2

## 变更摘要

- `sources.json` schema 从 `1.0` 升级到 `2.0`, 新增顶层 `bundles` 字段.
- multi-skill install 现在会写入 bundle 元数据, 覆盖 local batch, git, zip 三种来源.
- 旧版 `sources.json` 会在首次被 `SourcesService` 读取时自动迁移到 v2.
- `update ./batch-dir` 不再报"暂不支持", 而是按 bundle 同步新增/删除成员.
- `uninstall ./batch-dir` 和 `uninstall owner/repo` 在命中 bundle 时会走统一的批量删除流程.
- `update` 新增 `--sync` 和 `-v/--verbose`, 分别用于硬删除已移除成员和展开逐项状态输出.

## 升级提醒

- 升级后请不要再用旧版本 `skillsmgr` 回写同一个 `sources.json`, 旧版本不会保留 `bundles` 字段.
- 如果曾被旧版本覆盖, 重新执行对应的 install 即可重建 bundle 条目.
- 默认 `update` 只提示源里已删除但本地保留的成员; 如需严格对齐源状态, 请显式加 `--sync`.
