## MODIFIED Requirements

### Requirement: 来源分类存储路径
custom 类型 SHALL 只有一种路径格式, 不再区分分组与非分组:

| 类型 | 存储路径 |
|------|---------|
| official | `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}/` |
| community | `~/.skills-manager/community/{owner}/{repo}/{skillName}/` |
| custom | `~/.skills-manager/custom/{name}/` |

#### Scenario: Custom 安装路径
- **WHEN** 安装本地 skill
- **THEN** 安装到 `~/.skills-manager/custom/{name}/`

#### Scenario: Custom 分组目录不再识别
- **WHEN** `~/.skills-manager/custom/` 下的子目录不含 SKILL.md
- **THEN** 该子目录 SHALL 被忽略, 不再视为分组目录

### Requirement: install --group 不影响 source key
`install --group` 时, source key SHALL 不包含 group 信息.  source key 格式与不带 `--group` 时一致.

#### Scenario: 带 --group 安装的 custom skill source key
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** source key SHALL 为 `"custom/my-linter"`, 不含 group 信息
