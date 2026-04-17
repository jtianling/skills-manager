# 2026-04-17 local skill disk-as-truth

## Breaking

- 裸 `skillsmgr update` 不再更新单个本地 skill。  CLI 会统计并提示跳过数量, 更新本地 skill 需要显式运行 `skillsmgr update ./path`。
- `skillsmgr install ./path` 不再为单个本地 skill 写入 `sources.json`。  `~/.skills-manager/custom/<name>/` 的磁盘存在性现在是唯一权威信号。
- 同名但来自不同本地路径的再次安装不再报 URL mismatch。  只要目标 skill 已存在, CLI 会统一走 overwrite 确认流程。

## Notes

- legacy `sources.json` 里的顶层 `custom/<name>` + `installMethod: "local-copy"` 条目会在读取时被静默忽略, 后续任意正常写入会自然清理这些旧条目。
- physical group 成员 `custom/<group>/<name>` 仍然保留在 `sources.json`, 因为它们需要支持 physical group rebind。
