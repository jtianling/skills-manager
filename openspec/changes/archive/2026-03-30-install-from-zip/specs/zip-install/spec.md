## ADDED Requirements

### Requirement: 从本地 zip 文件安装 skill
系统 SHALL 支持从本地 zip 文件安装 skill.  输入路径以 `.zip` 结尾且文件存在时, 系统解压到临时目录, 扫描 SKILL.md, 拷贝到目标位置.

#### Scenario: 安装包含单个 skill 的 zip 文件
- **WHEN** 用户执行 `skillsmgr install ./my-skill.zip`
- **THEN** 系统解压 zip 到临时目录
- **THEN** 扫描到 SKILL.md 后将 skill 目录拷贝到 `~/.skills-manager/custom/{skillName}/`
- **THEN** 清理临时目录
- **THEN** 输出安装成功信息

#### Scenario: 安装包含多个 skill 的 zip 文件
- **WHEN** zip 文件解压后包含多个含 SKILL.md 的子目录
- **THEN** 系统展示交互式选择界面让用户选择要安装的 skill
- **THEN** 安装用户选择的 skill

#### Scenario: zip 文件中无 SKILL.md
- **WHEN** zip 文件解压后未找到任何 SKILL.md
- **THEN** 系统报错退出, 提示 "No skills found in zip file"

#### Scenario: 本地 zip 文件不存在
- **WHEN** 用户指定的 `.zip` 路径不存在
- **THEN** 系统报错退出, 提示文件不存在

#### Scenario: 使用 --group 安装 zip 中的 skill
- **WHEN** 用户执行 `skillsmgr install ./my-skill.zip -g my-tools`
- **THEN** skill 安装到 `~/.skills-manager/custom/my-tools/{skillName}/`

### Requirement: 从远程 zip URL 安装 skill
系统 SHALL 支持从 `https://` 开头且 `.zip` 结尾的 URL 下载并安装 skill.

#### Scenario: 从远程 URL 下载并安装 zip
- **WHEN** 用户执行 `skillsmgr install https://example.com/skills.zip`
- **THEN** 系统下载 zip 文件到临时目录
- **THEN** 解压并按本地 zip 相同逻辑安装
- **THEN** 清理临时文件

#### Scenario: 远程 zip 下载失败
- **WHEN** zip URL 无法访问或下载失败
- **THEN** 系统报错退出, 提示下载失败原因

### Requirement: zip 安装的 source 追踪
系统 SHALL 将 zip 安装记录到 sources.json, 并标记为不可 update.

#### Scenario: zip 安装写入 sources.json
- **WHEN** 从 zip 文件成功安装 skill
- **THEN** sources.json 中新增记录, `installMethod` 为 `'zip'`, `url` 为原始 zip 路径或 URL

#### Scenario: update 命令跳过 zip 来源
- **WHEN** 用户执行 `skillsmgr update` 且存在 zip 来源的 skill
- **THEN** 系统跳过该 skill 并提示 "Skipping {name}: installed from zip, manual reinstall required"
