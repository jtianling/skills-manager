## MODIFIED Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时, 系统 SHALL 按照已记录 source URL 与当前 install 路径是否一致区分处理:

- **相同 URL** (归一化后 `normalizeLocalPath(info.url) === normalizeLocalPath(skillDir)`): 视为重新安装同一位置, 提示 overwrite 确认, 保持现有行为
- **不同 URL**: 视为命名冲突(同 basename 不同目录), 系统 SHALL 报错终止安装, 错误文案 SHALL 明确指出已安装的原路径, 并引导用户使用 `skillsmgr update ./<name>` 进行 rebind

`findInstalledCustomSkill` SHALL 支持两层查找: 先查 `custom/{name}/SKILL.md`, 再扫描 `custom/*/{name}/SKILL.md`.

#### Scenario: Existing skill with same URL prompts overwrite
- **WHEN** 用户执行 `skillsmgr install ./abc`, `findInstalledCustomSkill("abc")` 返回非 null, 且已记录 source 的 `url` 归一化后等于 `./abc` 的绝对路径
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** 用户拒绝 overwrite 确认
- **THEN** 系统输出 "Cancelled." 并以退出码 0 正常结束

#### Scenario: Existing skill with different URL is rejected
- **WHEN** 用户执行 `skillsmgr install /new/path/abc`, `findInstalledCustomSkill("abc")` 返回非 null, 已记录 source 的 `url` 归一化后为 `/old/path/abc` (不等于 `/new/path/abc`)
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 形如 `Error: Skill 'abc' is already installed from /old/path/abc. To move it to /new/path/abc, run: skillsmgr update /new/path/abc`
- **AND** 系统 SHALL 以非 0 退出码终止, 不写入 `sources.json`, 不修改物理目录

#### Scenario: skill 在子目录中被找到
- **WHEN** 用户执行 `skillsmgr install ./abc`, 且 `custom/abc/SKILL.md` 不存在, 但 `custom/openspec/abc/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("abc")` SHALL 返回 `{ key: "custom/abc", path: "...custom/openspec/abc" }`
