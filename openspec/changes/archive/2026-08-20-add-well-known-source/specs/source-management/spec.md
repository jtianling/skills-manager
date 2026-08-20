## ADDED Requirements

### Requirement: well-known 来源分类与存储路径

来源分类 SHALL 新增 well-known 类别:

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| well-known | `~/.skills-manager/well-known/{hostname}/{skillName}/` | 按 well-known 发现协议从站点安装的 skill |

`SKILL_SOURCES` 常量 SHALL 新增 `'well-known'`, 使 `registry.ts` 的 skill 枚举与 `scanner.ts` 的已部署扫描自动覆盖该目录.

`{hostname}` SHALL 为小写归一化后的 host.  host 含端口时, 冒号 SHALL 替换为下划线 (如 `localhost:8787` → `localhost_8787`), 以保证跨文件系统的目录名安全.

一个 hostname SHALL 对应唯一一个 well-known source, 不支持同域名下并存多个 skill 集合.

#### Scenario: well-known 安装路径
- **WHEN** 从 `https://docs.stripe.com` 安装 skill `stripe-apps`
- **THEN** 安装到 `~/.skills-manager/well-known/docs.stripe.com/stripe-apps/`

#### Scenario: 带端口的 host 目录名
- **WHEN** 从 `http://127.0.0.1:8787` 安装 skill `demo`
- **THEN** 安装到 `~/.skills-manager/well-known/127.0.0.1_8787/demo/`

#### Scenario: hostname 大小写归一
- **WHEN** 用户输入 `https://Docs.Stripe.Com`
- **THEN** 存储路径与 source key 中的 hostname SHALL 为 `docs.stripe.com`

#### Scenario: 新目录被 skill 枚举覆盖
- **GIVEN** `~/.skills-manager/well-known/docs.stripe.com/stripe-apps/SKILL.md` 存在
- **WHEN** 用户执行 `skillsmgr list`
- **THEN** 该 skill SHALL 出现在列表中

### Requirement: well-known source key 与元数据字段

`SourceInfo.type` SHALL 新增取值 `'well-known'`, `SourceInfo.installMethod` SHALL 新增取值 `'well-known'`.

source key SHALL 为 `well-known/{hostname}` (两段, 与 `registry/{packageName}` 同形).

`SourceInfo` 字段取值:

| 字段 | 值 |
|------|-----|
| url | `https://{hostname}` (loopback 的 http 源记 `http://{host}`) |
| type | `'well-known'` |
| installMethod | `'well-known'` |
| repoName | `{hostname}` |
| skillDigests | `Record<skillName, 'sha256:<64hex>'>`, 记录每个已安装 skill 的 digest |

`sources.json` 的 `version` SHALL 保持 `'3.0'`, 不因本变更升版, 也不产生数据迁移.  well-known source SHALL NOT 写入 `bundles` 字段.

#### Scenario: 安装后记录 source 元数据
- **WHEN** 从 `https://docs.stripe.com` 成功安装 skill
- **THEN** `sources.json` SHALL 含 key `well-known/docs.stripe.com`
- **THEN** 该条目 `type` 与 `installMethod` 均为 `'well-known'`, `url` 为 `https://docs.stripe.com`, `repoName` 为 `docs.stripe.com`

#### Scenario: 记录每个 skill 的 digest
- **WHEN** 从同一站点安装 skill `a` 与 `b`
- **THEN** `skillDigests` SHALL 含 `a` 与 `b` 两个键, 值均匹配 `^sha256:[a-f0-9]{64}$`

#### Scenario: sources.json 版本不变
- **WHEN** 安装 well-known source 后读取 `sources.json`
- **THEN** `version` SHALL 仍为 `'3.0'`
- **THEN** `bundles` 字段 SHALL NOT 新增任何条目

#### Scenario: 无副作用验证
- **GIVEN** `sources.json` 已有 1 个 git source 与 1 个 registry source
- **WHEN** 安装一个 well-known source
- **THEN** 原有两个 source 条目 SHALL 保持不变

### Requirement: update 分流识别 well-known source

`SourceUpdater.updateSource` SHALL 在现有分流链上新增 well-known 分支, 判定依据为 `info.type === 'well-known'`, 位置在 registry 分支之后、`installMethod` 系列判定之前.

该分支 SHALL 按 `well-known-source` capability 的 "skill digest 记录与更新检测" 需求执行, SHALL NOT 调用 `parseGitHubUrl` 或 `cloneRepoToTemp`.

`update` 的 source 匹配 SHALL 复用现有规则, 即 `well-known/docs.stripe.com` 可由 `skillsmgr update docs.stripe.com` 匹配 (key 以 `/{source}` 结尾).

#### Scenario: 按 hostname 匹配 well-known source
- **WHEN** 用户执行 `skillsmgr update docs.stripe.com`
- **THEN** 系统 SHALL 匹配 key `well-known/docs.stripe.com`

#### Scenario: 全量 update 覆盖 well-known source
- **WHEN** 用户执行 `skillsmgr update` (无参数)
- **THEN** well-known source SHALL 走其 update 路径
- **THEN** SHALL NOT 对该 source 调用 git clone

#### Scenario: 未知 type 不导致崩溃
- **GIVEN** `sources.json` 含一个 `type` 为系统不认识的值的 source 条目
- **WHEN** 用户执行 `skillsmgr update`
- **THEN** 系统 SHALL 跳过该条目并打印说明, SHALL NOT 抛出未捕获异常

### Requirement: remove / uninstall 通过 well-known URL 定位 source

`SourceResolver.resolve` SHALL 为 `'well-known'` 类型新增分支, 该分支 SHALL 按归一化 URL 在已安装 sources 中精确匹配 (复用现有 `findSourceByNormalizedUrl`).

匹配成功时 SHALL 返回 `kind: 'source'` 与匹配到的 key; 无匹配时 SHALL 返回 `kind: 'not-found'`, `reason` 指出未找到该站点对应的已安装 source.

`detectArgFormat` 对无法提取 owner/repo 的 URL SHALL 继续返回 `'install-source'`, 由 `SourceResolver` 完成定位, 本变更 SHALL NOT 修改 `detectArgFormat` 的返回值规则.

#### Scenario: 通过 URL 卸载 well-known source
- **GIVEN** 已从 `https://docs.stripe.com` 安装 skill
- **WHEN** 用户执行 `skillsmgr uninstall https://docs.stripe.com`
- **THEN** 系统 SHALL 定位到 key `well-known/docs.stripe.com` 并执行卸载

#### Scenario: 通过 URL 移除已部署 skill
- **GIVEN** 已从 `https://docs.stripe.com` 部署 skill 到项目
- **WHEN** 用户执行 `skillsmgr remove https://docs.stripe.com`
- **THEN** 系统 SHALL 定位到 key `well-known/docs.stripe.com` 并移除其部署

#### Scenario: 末尾斜杠不影响匹配
- **WHEN** 用户执行 `skillsmgr uninstall https://docs.stripe.com/`
- **THEN** 系统 SHALL 匹配到 key `well-known/docs.stripe.com`

#### Scenario: 未安装的站点 URL 报未找到
- **WHEN** 用户对未安装过的 `https://example.com` 执行 uninstall
- **THEN** 系统 SHALL 报告未找到对应已安装 source, SHALL NOT 发起 well-known 发现请求

#### Scenario: 卸载后清理 source 条目
- **GIVEN** 已安装 well-known source 且该 source 下所有 skill 被卸载
- **WHEN** 卸载完成
- **THEN** `sources.json` 中 key `well-known/docs.stripe.com` SHALL 被删除
- **THEN** 其他 source 条目 SHALL 保持不变
