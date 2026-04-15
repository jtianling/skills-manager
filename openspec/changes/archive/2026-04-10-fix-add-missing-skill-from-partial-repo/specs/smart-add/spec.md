## ADDED Requirements

### Requirement: --skill 指定的 skill 不在本地时回退到远程安装

当 repo 已在中央仓库部分安装, 但 `--skill` 指定的 skill 不在本地已安装列表中时, `add` 命令 SHALL 回退到远程安装流程, 从远程获取缺失的 skill 后部署.

#### Scenario: repo 已部分安装, --skill 指定未安装的 skill
- **WHEN** 中央仓库中 `community/kepano/obsidian-skills/` 已安装 `obsidian-web-clipper`
- **AND** 用户执行 `skillsmgr add kepano/obsidian-skills --skill obsidian-markdown`
- **AND** `obsidian-markdown` 不在本地已安装列表中
- **THEN** 系统 SHALL 回退到远程安装流程
- **AND** 从远程仓库安装 `obsidian-markdown`
- **AND** 安装后将 `obsidian-markdown` 部署到项目

#### Scenario: repo 已部分安装, --skill 指定多个 skill, 部分不在本地
- **WHEN** 中央仓库中 `community/owner/repo/` 已安装 `skill-a`
- **AND** 用户执行 `skillsmgr add owner/repo -s skill-a -s skill-b`
- **AND** `skill-b` 不在本地已安装列表中
- **THEN** 系统 SHALL 回退到远程安装流程
- **AND** 安装 `skill-a` 和 `skill-b` (安装阶段 `skill-a` 已存在则跳过或覆盖)
- **AND** 部署 `skill-a` 和 `skill-b`

#### Scenario: repo 已部分安装, --skill 指定的 skill 全部在本地
- **WHEN** 中央仓库中 `community/owner/repo/` 已安装 `skill-a` 和 `skill-b`
- **AND** 用户执行 `skillsmgr add owner/repo -s skill-a`
- **THEN** 系统 SHALL 走本地部署路径, 不触发远程安装

## MODIFIED Requirements

### Requirement: 中央仓库匹配后的 skill 选择

匹配成功时, 展示该 repo 下所有 skills 的选择列表:
- 已部署到项目的 skill: `checked: true` 且锁定 (不可取消选中)
- 未部署的 skill: `checked: false`, 可选择

#### Scenario: 展示 skill 列表 (部分已部署)
- **WHEN** 中央仓库 `official/anthropic/skills/` 有 5 个 skills, 其中 2 个已部署
- **THEN** 展示 5 个 skills, 2 个已部署的预选且锁定, 3 个未部署的可选择

#### Scenario: 所有 skills 已部署 (无 --skill 参数)
- **WHEN** 该 repo 下所有 skills 都已部署到项目
- **AND** 未指定 `--skill` 参数
- **THEN** 输出提示 "All skills from this source are already deployed."
- **AND** 正常退出

#### Scenario: --skill 指定的 skill 已全部部署
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill-a`
- **AND** `skill-a` 在本地中央仓库中存在
- **AND** `skill-a` 已部署到项目
- **THEN** 输出 "No new skills selected."
- **AND** 正常退出

#### Scenario: 锁定 skill 不可取消
- **WHEN** 用户在选择列表中对已部署的锁定 skill 按 Space
- **THEN** 该 skill 的选中状态不变
