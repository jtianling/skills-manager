## MODIFIED Requirements

### Requirement: add 命令参数路由
`add` 命令 SHALL 使用统一的 `install` 命令处理所有安装场景, 不再区分 `install` 和 `custom-install`.

#### Scenario: 裸词 skill name 路由
- **WHEN** 用户执行 `skillsmgr add my-skill`
- **THEN** 先在中央仓库中搜索已安装的 skill
- **THEN** 如果找到, 直接部署
- **THEN** 如果未找到, 将 `my-skill` 传给 `install` 命令(会被解析为本地目录 `./my-skill`)

#### Scenario: owner/repo 路由(行为不变)
- **WHEN** 用户执行 `skillsmgr add owner/repo`
- **THEN** 先搜索中央仓库, 未找到则调用 `install` 远程安装

#### Scenario: URL 路由(行为不变)
- **WHEN** 用户执行 `skillsmgr add https://github.com/owner/repo`
- **THEN** 调用 `install` 远程安装

#### Scenario: --group 参数透传
- **WHEN** 用户执行 `skillsmgr add ./my-skill -g my-tools`
- **THEN** `--group` 参数透传给 `install` 命令
