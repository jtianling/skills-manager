## Context

四个命令 (install, uninstall, add, remove) 目前通过交互式 UI 选择 skill 和 agent. 用户无法在命令行中精确指定操作目标. add 命令的 `-a` 使用逗号分隔字符串, `-s` 被 `--same-agents` 占用.

当前参数解析和交互跳过逻辑分散在各命令文件和 `prompts.ts` 中:
- `install-utils.ts` 中的 `selectSkills()` 处理 install 的 skill 选择
- `prompts.ts` 中的 `resolveTargetAgents()` 处理 add 的 agent 解析
- 各命令直接调用 `interactiveCheckbox()` 或 `promptSkills()` 进行交互

## Goals / Non-Goals

**Goals:**
- 四个命令支持 `-s/--skill` 可重复参数精确指定 skill
- install, add, remove 支持 `-a/--agent` 可重复参数精确指定 agent
- 当信息充足时 (两者都提供) 完全跳过交互
- 保持与现有 `--all`, `--same-agents` 等选项的兼容

**Non-Goals:**
- 不改变交互式选择 UI 本身的行为
- 不引入 `*` 通配符 (已有 `--all` 覆盖此场景)
- 不改变 install 的安装目标目录逻辑
- 不改变 uninstall 的 provider/owner-repo 匹配逻辑

## Decisions

### D1: 使用 Commander.js collector 模式实现可重复参数

Commander.js 的 variadic option (`<names...>`) 会消费后续所有非 flag 参数, 这与 positional arg 冲突. 使用 collector 函数可以精确地每次只消费一个值.

```typescript
function collect(val: string, acc: string[]) {
  return [...acc, val];
}

.option('-s, --skill <name>', 'Specific skill (repeatable)', collect, [])
.option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
```

**备选方案**: 手动解析 `process.argv` (参考仓库做法). 但我们已经使用 Commander.js, 应保持一致.

### D2: 类型变更 — agent 从 string 改为 string[]

`AddOptions.agent` 从 `string` 改为 `string[]`, `ResolveAgentsOptions.agent` 同步变更. `resolveTargetAgents()` 不再 split 逗号, 直接使用数组.

install, remove 的 options 类型也需要扩展 `skill` 和 `agent` 字段.

### D3: skill 过滤作为通用工具函数

各命令的 skill 选择逻辑不同 (install 用 `InstallableSkill`, add 用 `SkillInfo`, uninstall 用路径), 但 `--skill` 参数的过滤逻辑相同: 按名称精确匹配. 在各命令中就地实现过滤, 不抽取公共函数, 因为上下文差异大.

### D4: remove 的 positional arg 与 -s 合并

`remove [name] -s s1 -s s2` 中, positional `name` 和 `-s` 的值合并为一个 skill 列表. 实现方式: action handler 中将 `name` (如果有) 拼入 `options.skill` 数组.

### D5: -s 与 --same-agents 的互斥处理

`-s` 短参数从 `--same-agents` 转移给 `--skill` 后, `--same-agents` 只保留长参数. 在 add 命令中, `--skill` 和 `--same-agents` 无冲突 (一个选 skill, 一个选 agent), 但 `--agent` 和 `--same-agents` 仍然互斥.

### D6: --skill 指定不存在的 skill 时的错误处理

当 `--skill` 指定的名称在候选列表中不存在时, 输出错误信息并 exit(1). 格式: `Skill '<name>' not found.`

## Risks / Trade-offs

- **Breaking change: -a 语法变更** → 用户需从 `-a a,b` 改为 `-a a -a b`. 风险较低, 项目尚在早期, 用户量小.
- **Breaking change: -s 含义变更** → `add` 命令的 `-s` 从 `--same-agents` 变为 `--skill`. 用户需改用 `--same-agents` 长参数. 同样风险较低.
- **remove 从必填参数变可选** → 需要处理 `remove` 无参数也无 `-s` 的情况, 应报错提示.
