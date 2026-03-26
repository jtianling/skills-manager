## MODIFIED Requirements

### Requirement: 来源分类

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{providerKey}/` | 官方 skill, 由 OFFICIAL_PROVIDERS registry 定义 |
| community | `~/.skills-manager/community/{owner}/{repo}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义无分组 skill |
| custom (grouped) | `~/.skills-manager/custom/{groupName}/{name}/` | 本地自定义分组 skill |

official 提供者由 `OFFICIAL_PROVIDERS` registry 定义, 支持多个提供者.

#### Scenario: Official 安装路径
- **WHEN** 安装 official 提供者 (如 openai) 的 skills
- **THEN** 安装到 `~/.skills-manager/official/openai/{skill-name}/`

#### Scenario: Community 安装路径
- **WHEN** 安装 community 仓库 `obra/superpowers` 的 skills
- **THEN** 安装到 `~/.skills-manager/community/obra/superpowers/{skill-name}/`

#### Scenario: Custom 无分组安装路径
- **WHEN** 使用 `custom-install` 安装且不指定 `--group`
- **THEN** 安装到 `~/.skills-manager/custom/{name}/`

#### Scenario: Custom 分组安装路径
- **WHEN** 使用 `custom-install --group my-tools` 安装
- **THEN** 安装到 `~/.skills-manager/custom/my-tools/{name}/`

#### Scenario: Custom 分组目录检测
- **WHEN** `~/.skills-manager/custom/` 下的子目录不含 SKILL.md
- **THEN** 该子目录视为分组目录, 扫描其下级目录寻找 skill
