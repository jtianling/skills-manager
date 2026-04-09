## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新
update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`), 按路径匹配已安装的 local-copy source 或 local-batch bundle 并更新.  匹配失败时 SHALL 进入 basename fallback 流程 (见 `basename fallback 与 rebind` 需求); fallback 也未命中则报错.

#### Scenario: 路径精确匹配已安装 source
- **WHEN** 用户执行 `skillsmgr update ./my-skill`
- **THEN** 系统将 `./my-skill` resolve 为绝对路径
- **THEN** 在 `sources.json` 中查找 `url` 等于该绝对路径的记录 (含 local-copy source 和 local-batch bundle)
- **THEN** 找到后执行 local-copy 更新流程或 bundle sync 流程

#### Scenario: 路径未匹配任何已安装 source 且 fallback 未命中
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill`, 精确路径匹配失败, basename fallback 也未找到候选
- **THEN** 系统 SHALL 报错 "No installed skill found from path: {absPath}"

## ADDED Requirements

### Requirement: basename fallback 与 rebind
update 命令在 `resolveLocalPath` 精确路径匹配失败时, SHALL 按 basename 在已安装的 local-copy source 和 local-batch bundle 中查找候选, 并根据旧路径状态和类型匹配决定是否进入 rebind 流程.

basename 匹配规则:
- local-copy source: 候选为 `installMethod === 'local-copy'` 且 `repoName === basename(absolutePath)` 的 source
- local-batch bundle: 候选为 `bundle.type === 'local-batch'` 且 `basename(normalizeLocalPath(bundle.url)) === basename(absolutePath)` 的 bundle

找到唯一候选后 SHALL 依次检查:
1. 候选的旧 URL 是否仍 `fileExists`: 仍存在则**不**触发 rebind, 返回 not-found, 错误文案 SHALL 提示旧路径仍存在并引导用户先处理旧路径
2. 新路径结构类型是否与候选类型一致: 类型不一致则拒绝 rebind, 错误文案 SHALL 明确指出 "path type mismatch"
3. 全部通过后 SHALL prompt 用户确认 rebind, 默认选项 No; `--force` 或 `-y` SHALL 跳过 prompt 直接 rebind
4. 用户确认后 SHALL 原子重写 `sources.json`: 对 bundle 更新 `bundle.url` 并通过 `makeBundleId` 重算 bundle key, 对所有 member 更新 `source.url`; 对单 skill 更新 `source.url`
5. Rebind 完成后 SHALL 继续执行正常 update 流程 (复用 bundle sync / local-copy update)

类型匹配规则:
- 单 skill 候选: 新路径的根目录必须直接含 `SKILL.md`
- batch 候选: 新路径的根目录必须**不**含 `SKILL.md` 且必须有至少一个含 `SKILL.md` 的子目录

多候选处理: basename 匹配返回 > 1 个候选时, SHALL 报错列出所有候选的 key/bundleId 和 URL, 提示用户手动清理后重试, 不进入交互式选择.

#### Scenario: batch bundle 搬家后 rebind 成功
- **GIVEN** `sources.json` 中有 `local-batch` bundle, `url = /old/path/tdd-spec`, members 为 `custom/tdd-spec/ts-apply` 等 11 个
- **AND** `/old/path/tdd-spec` 已不存在
- **AND** `/new/path/tdd-spec/` 存在, 无根 SKILL.md, 但有 `ts-apply/SKILL.md` 等子目录
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`, 精确匹配失败
- **THEN** 系统进入 basename fallback, 找到唯一候选 bundle
- **AND** 确认旧路径 `/old/path/tdd-spec` 不存在
- **AND** 确认新路径为 batch 类型, 与候选 bundle 类型一致
- **AND** prompt 用户确认 rebind
- **WHEN** 用户确认
- **THEN** 系统原子重写 `sources.json`: bundle key 从 `local-batch:/old/path/tdd-spec` 变为 `local-batch:/new/path/tdd-spec`, `bundle.url` 更新为新路径, 所有 member 的 `source.url` 更新为新路径
- **AND** 系统继续执行 bundle sync, 更新新路径下的 skill 内容

#### Scenario: 单 skill 搬家后 rebind 成功
- **GIVEN** `sources.json` 中有 source key `custom/my-lint`, `installMethod = 'local-copy'`, `url = /old/path/my-lint`, `repoName = 'my-lint'`
- **AND** `/old/path/my-lint` 已不存在
- **AND** `/new/path/my-lint/SKILL.md` 存在
- **WHEN** 用户执行 `skillsmgr update /new/path/my-lint`
- **THEN** 系统进入 basename fallback, 找到唯一候选 source
- **AND** 确认类型匹配 (单 skill)
- **AND** prompt 用户确认 rebind
- **WHEN** 用户确认
- **THEN** 系统原子更新 `sources[custom/my-lint].url` 为新路径
- **AND** 继续执行 local-copy update 流程

#### Scenario: 用户拒绝 rebind
- **GIVEN** 同"batch bundle 搬家后 rebind 成功"的前置条件
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`, 系统 prompt rebind, 用户拒绝
- **THEN** 系统 SHALL 输出 "Cancelled." 并以退出码 0 结束
- **AND** `sources.json` 保持不变, 不执行 update

#### Scenario: --force 跳过 rebind prompt
- **GIVEN** 同"batch bundle 搬家后 rebind 成功"的前置条件
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec --force`
- **THEN** 系统 SHALL 跳过 rebind prompt 直接 rebind 并继续 update

#### Scenario: 旧路径仍存在时不触发 rebind
- **GIVEN** `sources.json` 中有 `local-batch` bundle, `url = /old/path/tdd-spec`
- **AND** `/old/path/tdd-spec` 仍然存在
- **AND** 用户在不同路径 `/other/path/tdd-spec` 下也创建了同名目录结构
- **WHEN** 用户执行 `skillsmgr update /other/path/tdd-spec`
- **THEN** 系统精确匹配失败, basename fallback 找到候选, 但旧路径仍存在, 不触发 rebind
- **AND** 系统 SHALL 报错, 错误文案 SHALL 形如 `No installed skill found from path: /other/path/tdd-spec. A bundle with the same name is installed from /old/path/tdd-spec (still exists). Remove or rename the old path first to rebind.`

#### Scenario: 类型不匹配拒绝 rebind
- **GIVEN** `sources.json` 中有 `local-batch` bundle, `url = /old/path/tdd-spec`, 旧路径已不存在
- **AND** `/new/path/tdd-spec/SKILL.md` 存在 (即新路径是单 skill 结构)
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统进入 basename fallback, 找到候选 bundle, 但类型不一致
- **AND** 系统 SHALL 报错, 错误文案 SHALL 形如 `Path type mismatch: existing bundle 'tdd-spec' is a batch, but /new/path/tdd-spec looks like a single skill.`
- **AND** 系统不进入 rebind prompt, 以非 0 退出码结束

#### Scenario: basename 多候选报错列出
- **GIVEN** `sources.json` 历史脏数据, 存在两个 `local-batch` bundle 基名都等于 `tdd-spec` 但 URL 不同, 两者旧路径都不存在
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统进入 basename fallback, 发现多个候选
- **AND** 系统 SHALL 报错列出所有候选的 bundle key 和 URL, 提示用户手动清理后重试
- **AND** 不进入任何交互式选择或 rebind

#### Scenario: bareword update 不走 basename fallback
- **WHEN** 用户执行 `skillsmgr update tdd-spec` (无 `./` 前缀, 无绝对路径)
- **THEN** 系统按现有 bareword 解析 (suffix key / repoName / skill name), 不新增 URL basename 匹配
- **AND** 不进入 rebind 流程
