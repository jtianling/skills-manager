## ADDED Requirements

### Requirement: 识别 .skill 扩展名为 zip 包来源

源类型检测 SHALL 将 `.skill` 扩展名视为 zip 包, 与 `.zip` 走相同的安装路径.  检测逻辑 SHALL 使用辅助函数统一判断 `.zip` 和 `.skill` 扩展名.

#### Scenario: 本地 .skill 文件识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install ./foo.skill`
- **THEN** 源类型检测 SHALL 返回 `local-zip`, 走 `installFromZip` 流程

#### Scenario: 远程 .skill URL 识别为 remote-zip
- **WHEN** 用户运行 `skillsmgr install https://example.com/foo.skill`
- **THEN** 源类型检测 SHALL 返回 `remote-zip`, 走 `installFromRemoteZip` 流程

#### Scenario: 裸 .skill 文件名识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install foo.skill` (无路径前缀)
- **THEN** 源类型检测 SHALL 返回 `local-zip`

#### Scenario: .skill 文件安装结果与 .zip 一致
- **WHEN** 安装一个 `.skill` 文件, 其内部包含有效的 skill 目录 (含 `SKILL.md`)
- **THEN** 安装行为 SHALL 与安装同内容的 `.zip` 文件完全一致, 包括目标路径、sources.json 记录和 installMethod
