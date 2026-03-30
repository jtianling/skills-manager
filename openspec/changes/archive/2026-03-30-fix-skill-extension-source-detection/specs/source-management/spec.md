## MODIFIED Requirements

### Requirement: zip 包来源识别 (.zip / .skill)

源类型检测 SHALL 将 `.zip` 和 `.skill` 扩展名视为 zip 包, 但仅当输入带有明确路径前缀 (`./`, `/`, `~/`, `../`) 或 URL 前缀 (`http://`, `https://`) 时.  裸文件名 (如 `foo.zip`, `foo.skill`) SHALL 不被识别为 zip 包来源, 返回 `unknown`.

#### Scenario: 本地带前缀的 zip 包识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install ./foo.zip` 或 `skillsmgr install ./foo.skill`
- **THEN** 源类型检测 SHALL 返回 `local-zip`, 走 `installFromZip` 流程

#### Scenario: 远程 URL zip 包识别为 remote-zip
- **WHEN** 用户运行 `skillsmgr install https://example.com/foo.zip` 或 `https://example.com/foo.skill`
- **THEN** 源类型检测 SHALL 返回 `remote-zip`, 走 `installFromRemoteZip` 流程

#### Scenario: 裸 zip 包文件名不识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install foo.zip` 或 `skillsmgr install foo.skill` (无路径前缀)
- **THEN** 源类型检测 SHALL 返回 `unknown`, 不走 zip 安装流程

#### Scenario: 绝对路径 zip 包识别为 local-zip
- **WHEN** 用户运行 `skillsmgr install /path/to/foo.zip` 或 `/path/to/foo.skill`
- **THEN** 源类型检测 SHALL 返回 `local-zip`

#### Scenario: .skill 文件安装结果与 .zip 一致
- **WHEN** 安装一个 `.skill` 文件, 其内部包含有效的 skill 目录 (含 `SKILL.md`)
- **THEN** 安装行为 SHALL 与安装同内容的 `.zip` 文件完全一致, 包括目标路径、sources.json 记录和 installMethod
