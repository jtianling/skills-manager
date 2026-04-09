## ADDED Requirements

### Requirement: 批量安装重名 bundle 冲突检测
`install` 批量本地目录时, 系统 SHALL 在物理写入前检查 `sources.json` 中是否已存在同 basename 的 `local-batch` bundle:
- **相同 URL** (`normalizeLocalPath(existing.url) === normalizeLocalPath(skillDir)`): 正常进入批量安装流程 (后续每个子 skill 的 overwrite 行为保持现状)
- **不同 URL**: 系统 SHALL 报错终止安装, 不写入 `sources.json`, 不修改物理目录.  错误文案 SHALL 指出已记录的原路径并引导用户运行 `skillsmgr update ./<dirName>` 触发 rebind

basename 定义: `basename(normalizeLocalPath(skillDir))`, 其中 `skillDir` 是用户 install 的目标目录.

#### Scenario: 批量安装同路径 idempotent
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`, `sources.json` 中已存在 `local-batch` bundle 的 `url` 归一化后等于 `./tdd-spec` 的绝对路径
- **THEN** 系统 SHALL 正常进入批量安装流程, 不报冲突错误

#### Scenario: 批量安装同 basename 不同路径被拒绝
- **WHEN** 用户执行 `skillsmgr install /new/path/tdd-spec`, `sources.json` 中已存在 `local-batch` bundle, 其 `url` 归一化后为 `/old/path/tdd-spec` (basename 相同, 路径不同)
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 形如 `Error: A local bundle 'tdd-spec' is already installed from /old/path/tdd-spec. To move it to /new/path/tdd-spec, run: skillsmgr update /new/path/tdd-spec`
- **AND** 系统 SHALL 以非 0 退出码终止, 不写入 `sources.json`, 不修改 `~/.skills-manager/custom/tdd-spec/` 下任何内容

#### Scenario: 批量安装与同名单 skill 共存不冲突
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec` (batch), 已存在单 skill `custom/tdd-spec` 但无 `local-batch` bundle
- **THEN** 系统 SHALL 按现有行为处理 (不触发本需求的冲突检测), 因为目标物理路径和 source key 结构不同 (`custom/tdd-spec/{child}` vs `custom/tdd-spec`)

#### Scenario: 批量安装遇到历史脏数据多 bundle
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`, `sources.json` 中已存在多个同 basename 的 `local-batch` bundle (历史脏数据)
- **THEN** 系统 SHALL 报错列出所有冲突的 bundle key 和 URL, 提示用户手动清理后重试
