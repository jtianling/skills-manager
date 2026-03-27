## ADDED Requirements

### Requirement: 统一的 source 类型识别
系统 SHALL 根据输入字符串的格式自动判断安装方式, 使用确定性规则, 不做启发式推断.

#### Scenario: 裸词解析为本地目录
- **WHEN** 用户执行 `skillsmgr install my-skill`
- **THEN** 系统将输入解析为 `./my-skill`
- **THEN** 如果目录存在且包含 SKILL.md, 按本地目录安装
- **THEN** 如果目录不存在, 报错退出并提示 "Directory ./my-skill not found. For remote install, use owner/repo format."

#### Scenario: 以路径前缀开头识别为本地路径
- **WHEN** 用户输入以 `/`, `./`, `../`, `~` 任一开头
- **THEN** 系统识别为本地目录路径

#### Scenario: 以 .zip 结尾识别为 zip 安装
- **WHEN** 用户输入以 `.zip` 结尾
- **THEN** 如果以 `https://` 开头, 识别为远程 zip
- **THEN** 否则识别为本地 zip

#### Scenario: 以 https:// 开头且非 zip 识别为远程 URL
- **WHEN** 用户输入以 `https://` 开头且不以 `.zip` 结尾
- **THEN** 系统识别为远程 URL, 走 GitHub API 或 git clone 流程

#### Scenario: 含单个 / 识别为 owner/repo
- **WHEN** 用户输入匹配 `owner/repo` 格式(含且仅含一个 `/`)
- **THEN** 系统识别为 GitHub 仓库, 转换为 `https://github.com/{owner}/{repo}`

#### Scenario: 识别优先级
- **WHEN** 输入同时匹配多个规则(如 `https://example.com/file.zip` 同时是 URL 和 zip)
- **THEN** 按以下优先级判断: 远程 zip > 本地 zip > 远程 URL > owner/repo > 本地路径 > 裸词
