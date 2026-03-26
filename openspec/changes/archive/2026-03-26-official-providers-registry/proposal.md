## Why

当前 official 仅硬编码支持 `anthropics/skills` 一个仓库, 无法覆盖 OpenAI, Microsoft, Vercel 等同样提供 skills 仓库的厂商.  同时 community 安装使用 repo name 作为本地目录名, 会导致不同 owner 的同名仓库冲突(如 `owner1/superpowers` 和 `owner2/superpowers`), 且丢失来源信息.

## What Changes

- 新增 `OFFICIAL_PROVIDERS` registry, 以配置方式支持多个 official 提供者, 每个提供者包含 `owner`, `repo`, 可选 `skillsPath`
- 初始 official 列表: anthropic, openai, microsoft, vercel-labs
- install 命令支持所有 official 提供者的快捷名(如 `skillsmgr install openai`)
- install 命令对 `owner/repo` 格式输入自动反查 registry, 匹配则视为 official
- **BREAKING**: community 本地目录结构从 `community/{repo}/` 改为 `community/{owner}/{repo}/`
- **BREAKING**: source key 格式从 `community/{repo}` 改为 `community/{owner}/{repo}`

## Capabilities

### New Capabilities

- `official-registry`: 可配置的 official 提供者注册表, 支持快捷名安装和自动识别, 支持自定义 skillsPath 以适配不同仓库结构

### Modified Capabilities

- `source-management`: official 判断逻辑从硬编码改为 registry 查询; community 目录结构从 `{repo}/` 改为 `{owner}/{repo}/`; source key 格式变化

## Impact

- `src/constants.ts` — 新增 OFFICIAL_PROVIDERS 类型和数据
- `src/commands/install.ts` — 重构 official 判断逻辑, 统一 installFromAnthropic 为通用 installFromOfficial; community 目录路径改为 owner/repo
- `src/services/github.ts` — getTargetDir 适配新逻辑
- `src/services/git.ts` — clone/cloneSpecificSkill 适配新逻辑
- `src/services/sources.ts` — source key 格式变化
- `src/services/skills.ts` — skill source 识别逻辑适配
- 现有测试需要适配新目录结构和 source key 格式
