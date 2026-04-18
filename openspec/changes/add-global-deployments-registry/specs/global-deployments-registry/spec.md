## ADDED Requirements

### Requirement: 全局 deployments 注册表 schema
系统 SHALL 维护 `~/.skills-manager/deployments.json` 全局注册表, 跟踪本机所有通过 `skillsmgr deploy` / `deploy --refresh` 部署过的项目.  Schema:

```json
{
  "version": "1.0",
  "deployments": {
    "<absolute-project-path>": {
      "mode": "link" | "copy",
      "followGroups": ["<group-name>", "..."],
      "pinnedSkills": ["<skill-key>", "..."],
      "lastDeployedAt": "<ISO 8601>"
    }
  }
}
```

项目 key 规则:
- SHALL 使用 `fs.realpathSync` 归一化后的绝对路径
- 不同写法 (相对路径, 符号链接) 映射到同一 key

非法 JSON / schema 错误 SHALL 报错并拒绝继续, 指引用户修复或删除注册表.  未知字段 SHALL 被忽略 (向前兼容).

#### Scenario: 首次写入注册表
- **GIVEN** `~/.skills-manager/deployments.json` 不存在
- **WHEN** 用户在 `/Users/jt/proj/a` 执行 `skillsmgr deploy --all`
- **THEN** 系统 SHALL 创建注册表文件, 包含 `/Users/jt/proj/a` 条目

#### Scenario: realpath 归一化
- **GIVEN** `/Users/jt/workspace/proj-a` 是 `/Volumes/ssd/proj-a` 的符号链接
- **WHEN** 用户在两个路径分别 deploy
- **THEN** 注册表 SHALL 只有一个条目, key 为 realpath 解析结果

#### Scenario: 非法 JSON 报错
- **WHEN** 用户手动把注册表改成非法 JSON 并运行 `skillsmgr deployments list`
- **THEN** 系统 SHALL 报错 "Invalid deployments registry: <path>.  Fix or delete the file to continue."
- **AND** 非 0 退出码

### Requirement: deploy / refresh 同步写入注册表
`skillsmgr deploy` (普通) 和 `skillsmgr deploy --refresh` 完成部署后, SHALL 在写项目 manifest 的同时更新全局注册表对应项目条目.  注册表写入是 **派生** 写入:

- manifest 写入失败 → 整个 deploy fail, 注册表不写
- manifest 写入成功, 注册表写入失败 → warn 但不 fail (派生数据可重建); 下次 deploy 自动重试
- 两者写入的内容 SHALL 一致 (mode / followGroups / pinnedSkills)

`deploy -g` 全局模式 SHALL **不**写注册表.

#### Scenario: deploy 同步写注册表
- **WHEN** 用户在 `/path/to/proj` 执行 `skillsmgr deploy --follow-group tdd-spec -y`
- **THEN** 项目 manifest 和全局注册表 `/path/to/proj` 条目均写入相同的 followGroups 和 pinnedSkills

#### Scenario: deploy --refresh 更新注册表
- **WHEN** 用户执行 `skillsmgr deploy --refresh`, 刷新 3 个新 skill
- **THEN** 注册表条目的 `lastDeployedAt` 更新为当前时间
- **AND** followGroups / pinnedSkills 保持不变 (refresh 不改语义, 只对齐状态)

#### Scenario: 注册表写入失败不阻塞 deploy
- **GIVEN** `~/.skills-manager/deployments.json` 所在目录无写权限
- **WHEN** 用户在项目里执行 `skillsmgr deploy -y`
- **THEN** 项目 manifest SHALL 正常写入, deploy 成功
- **AND** 系统 SHALL warn "Failed to update global deployments registry: <reason>"
- **AND** deploy 命令退出码为 0

#### Scenario: 全局 deploy 不写注册表
- **WHEN** 用户执行 `skillsmgr deploy -g -a claude-code`
- **THEN** 注册表 SHALL 不变

### Requirement: update 枚举受影响项目
`skillsmgr update` 处理完一个 bundle 后, 若 `result.added + result.removedHard + result.removedKept > 0`, SHALL 查询注册表, 输出受影响项目分组列表, 替代 `add-deployment-manifest` 的笼统提示.

分组规则:
- **follow bucket**: 项目 followGroups 包含该 bundle 的 auto-group (local-batch 的 `basename(bundle.url)`; git bundle 若显式 `--group` 指定过也适用)
- **pinned bucket**: 项目 pinnedSkills 任一 skill key 属于该 bundle/group
- **missing bucket**: 项目路径 `fileExists === false`

无受影响项目时 SHALL **不**输出项目列表, 仅保留单行摘要.

输出格式:
```
Projects using this bundle's group:
  follow (will auto-add on next refresh):
    - /path/a
  pinned (re-deploy to include):
    - /path/b
  (path missing, run `skillsmgr deployments prune`):
    - /path/c
```

#### Scenario: 有 follow 项目时列出
- **GIVEN** 注册表中 `/path/a` 的 followGroups 包含 `tdd-spec`
- **WHEN** 用户执行 `skillsmgr update ./tdd-spec`, 源目录新增 skill
- **THEN** 摘要行后 SHALL 输出 "follow: /path/a"

#### Scenario: 无受影响项目时不输出分组列表
- **GIVEN** 注册表空 / 无项目 follow 或 pin 此 bundle
- **WHEN** update 完成且 bundle 有变化
- **THEN** SHALL 只输出单行 "Note: projects following this bundle's group may need `skillsmgr deploy --refresh` to pick up changes." (退化为笼统提示)

#### Scenario: 路径失效标记
- **GIVEN** 注册表条目 `/old-project`, 路径已不存在
- **WHEN** update 输出受影响列表
- **THEN** `/old-project` SHALL 出现在 "path missing" 分组
- **AND** 提示 `skillsmgr deployments prune`

### Requirement: deployments list 子命令
`skillsmgr deployments list` (或 `skillsmgr deployments` 默认) SHALL 输出所有注册项目的概览, 按路径排序.  每个条目显示:
- 项目路径
- follow groups 列表
- pinned skills 计数 (详细列表过长时可折叠)
- mode
- lastDeployedAt (相对时间, 如 "3 days ago")
- 路径失效标识

`--json` 支持结构化输出.

#### Scenario: 列出所有项目
- **WHEN** 用户执行 `skillsmgr deployments list`
- **THEN** 系统 SHALL 输出所有条目, 按路径排序

#### Scenario: 路径失效在 list 中标识
- **GIVEN** 注册表有 `/gone` 条目, 路径已不存在
- **WHEN** 用户执行 `skillsmgr deployments list`
- **THEN** `/gone` SHALL 显示 `(missing)` 后缀

#### Scenario: 空注册表
- **WHEN** 用户执行 `skillsmgr deployments list`, 注册表为空或不存在
- **THEN** 系统 SHALL 输出 "No deployments registered.  Run `skillsmgr deploy` in a project to register one."

### Requirement: deployments prune 子命令
`skillsmgr deployments prune` SHALL 交互式移除所有路径已失效的条目.  `-y` 跳过交互直接删.

Prune 只删注册表条目, **不**触达项目 manifest 或 `.agents/skills/` 内容 (它们已随项目目录消失).

#### Scenario: 交互式 prune
- **GIVEN** 注册表有 2 个路径失效条目 `/gone-a`, `/gone-b`
- **WHEN** 用户执行 `skillsmgr deployments prune`
- **THEN** 系统 SHALL 列出两个失效条目, prompt 确认删除
- **WHEN** 用户确认
- **THEN** 两个条目 SHALL 从注册表移除

#### Scenario: -y 跳过确认
- **WHEN** 用户执行 `skillsmgr deployments prune -y`
- **THEN** 系统 SHALL 直接删除所有失效条目, 不 prompt

#### Scenario: 无失效条目
- **WHEN** 用户执行 `skillsmgr deployments prune`, 所有路径都存在
- **THEN** 系统 SHALL 输出 "No stale entries found."
- **AND** 退出码 0, 不修改注册表

### Requirement: deployments remove 子命令
`skillsmgr deployments remove <path>` SHALL 从注册表移除指定项目条目.  路径 SHALL 先做 realpath 归一化再匹配.  不存在时报错.  remove 不触达项目 manifest 内容 (用户可能只想让 update 不再提示这个项目, 保留项目本身部署).

#### Scenario: 精准移除
- **WHEN** 用户执行 `skillsmgr deployments remove /path/a`
- **THEN** 注册表中 `/path/a` 条目 SHALL 被移除
- **AND** `/path/a/skillsmgr-deploy.json` SHALL 保持不变

#### Scenario: 路径不存在于注册表
- **WHEN** 用户执行 `skillsmgr deployments remove /not-registered`
- **THEN** 系统 SHALL 报错 "Path not found in registry: /not-registered"
- **AND** 退出码非 0
