## MODIFIED Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 `findInstalledCustomSkill` 返回非 null 时, 系统 SHALL 使用返回的 `path` 作为 targetDir 并提示 overwrite 确认, 不再按"已记录 source URL 与当前 install 路径是否一致"分支处理 (不再有 URL 记录可供比较).

`findInstalledCustomSkill` SHALL 支持两层查找: 先查 `custom/{name}/SKILL.md`, 再扫描 `custom/*/{name}/SKILL.md`.

install 本地 skill 完成后 SHALL NOT 向 `~/.skills-manager/sources.json` 写入 `installMethod: 'local-copy'` 条目.  `custom/<name>/` 磁盘目录本身就是此 skill 已安装的唯一权威证据.

#### Scenario: Existing skill prompts overwrite
- **WHEN** 用户执行 `skillsmgr install ./abc`, `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** 用户拒绝 overwrite 确认
- **THEN** 系统输出 "Cancelled." 并以退出码 0 正常结束

#### Scenario: User accepts overwrite from different path
- **WHEN** 用户先后执行 `skillsmgr install /path/a/abc`, 再 `skillsmgr install /path/b/abc`, 第二次 `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统 SHALL 提示 overwrite
- **AND** 用户确认后, 从 `/path/b/abc` 覆盖已安装副本
- **AND** 系统 SHALL NOT 报"URL mismatch"类错误 (已无 URL 记录可比较)

#### Scenario: skill 在子目录中被找到
- **WHEN** 用户执行 `skillsmgr install ./abc`, 且 `custom/abc/SKILL.md` 不存在, 但 `custom/openspec/abc/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("abc")` SHALL 返回 `{ key: "custom/openspec/abc", path: "...custom/openspec/abc" }`

#### Scenario: Install 完成不写 sources.json
- **WHEN** 用户执行 `skillsmgr install ./abc` 并完成拷贝
- **THEN** `~/.skills-manager/sources.json` 的 `sources` 字段 SHALL NOT 包含 `custom/abc` 或任何 `installMethod === 'local-copy'` 的新条目

## REMOVED Requirements

(无独立 requirement 被移除; URL-mismatch 分支作为原 `Overwrite confirmation for existing skill` requirement 的内部逻辑被移除, 通过上方 MODIFIED 反映)
