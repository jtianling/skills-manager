## MODIFIED Requirements

### Requirement: Source 元数据结构
SourceInfo SHALL 包含可选的 `installMethod` 字段, 用于记录安装方式. 字段值为 `'git'`, `'zip'`, 或 `'local-copy'`. 未设置时默认视为 `'git'`.

#### Scenario: 本地目录安装记录 source
- **WHEN** 通过本地目录路径安装 skill
- **THEN** sources.json 中新增记录, `installMethod` 为 `'local-copy'`, `url` 为原始绝对路径

#### Scenario: zip 安装记录 source
- **WHEN** 通过 zip 文件安装 skill
- **THEN** sources.json 中新增记录, `installMethod` 为 `'zip'`, `url` 为 zip 文件路径或 URL

#### Scenario: 远程 git 安装记录 source(行为不变)
- **WHEN** 通过 GitHub URL 或 git clone 安装 skill
- **THEN** sources.json 中记录 `installMethod` 为 `'git'`(或省略, 默认值)

#### Scenario: --group 安装时的 source key
- **WHEN** 使用 `--group` 参数安装 skill
- **THEN** source key 格式为 `custom/{group}/{skillName}`

## ADDED Requirements

### Requirement: 本地安装统一写入 sources.json
所有安装方式(含本地目录和 zip)SHALL 统一写入 sources.json.

#### Scenario: 本地目录安装写入 source
- **WHEN** 从本地目录安装 skill 到 `~/.skills-manager/custom/{name}/`
- **THEN** sources.json 包含 key `custom/{name}` 的记录

#### Scenario: 带 group 的本地安装写入 source
- **WHEN** 从本地目录安装 skill 到 `~/.skills-manager/custom/{group}/{name}/`
- **THEN** sources.json 包含 key `custom/{group}/{name}` 的记录
