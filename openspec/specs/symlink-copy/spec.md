## Purpose
TBD - update after review.

## Requirements

### Requirement: copyDir 保留 symlink
`copyDir` 遇到 symlink 条目时, SHALL 用 `symlinkSync(readlinkSync(src), dest)` 在目标路径创建相同指向的 symlink, 而非调用 `copyFileSync`.

#### Scenario: symlink 指向同级目录
- **WHEN** 源目录包含 `link-a -> target-dir/`(symlink 指向一个目录)
- **THEN** 目标目录出现 `link-a` symlink, `readlinkSync` 返回 `target-dir`, 目标目录的 `target-dir/` 内容正常存在

#### Scenario: symlink 指向同级文件
- **WHEN** 源目录包含 `link-b -> real-file.txt`(symlink 指向一个文件)
- **THEN** 目标目录出现 `link-b` symlink, `readlinkSync` 返回 `real-file.txt`

#### Scenario: 嵌套目录中的 symlink
- **WHEN** 源目录的子目录中包含 symlink
- **THEN** 递归复制后, 子目录中的 symlink 被保留

### Requirement: copyDir 跳过非常规文件
`copyDir` 遇到既非 directory、非 file、非 symlink 的条目时, SHALL 静默跳过, 不抛出异常.

#### Scenario: 目录包含非常规文件类型
- **WHEN** 源目录包含 socket 或 FIFO 等非常规文件
- **THEN** `copyDir` 正常完成, 非常规文件不出现在目标目录, 其他文件正常复制
