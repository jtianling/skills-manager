# Proposal: w01-refactor-source-resolver

## Why

`install` 命令接受 7+ 种 input 形式 (owner/repo, URL, 本地路径, zip, registry 包等), 但 `update` 和 `uninstall` 只支持其中少数, 且 `update anthropics/skills` 这种 official owner 输入因 fuzzy 匹配没走 owner 翻译而失败.  违反 CLAUDE.md 的"命令对称性"硬规则.

本 change 引入 **SourceResolver** 共享查找层, 集中处理所有 input 形式到已安装 source key 的归一化, 让 update / uninstall 自动获得和 install 对等的 input 接受能力 (单 skill 范围).  batch / group 同步语义留给 w03.

## What Changes

- 新增 `src/services/source-resolver.ts`, 提供 `resolve(input: string): Promise<ResolvedTarget>` 单一入口
- `update` 命令改用 SourceResolver 分发, **BREAKING** fallback fuzzy 匹配行为被替换为 SourceResolver 的归一化查找
- `uninstall` 命令改用 SourceResolver 分发 (替换 `extractOwnerRepo` + `uninstallByName` 二分)
- SourceResolver 内部集中处理 `findOfficialProvider` 翻译 (修洞 2: `update anthropics/skills` 生效)
- SourceResolver 支持以下 input 形式到已安装 source 的映射: owner/repo (含 official/community 翻译), owner/repo:skill 单 skill, HTTPS/SSH URL, registry 包名 (含 @version 解析为版本切换语义), 本地单 skill 路径, 裸词 (按 source key 或 repoName 或 skill name 兜底)
- 本地 batch 目录 (无根 SKILL.md 的目录) 的支持 **不在本 change 范围**, 暂保留现有报错行为, 留待 w03
- zip 源保持现有"manual reinstall"语义, 不变
- 本 change 不动 sources.json schema, 不改数据模型

## Capabilities

### New Capabilities
- `source-resolver`: 统一的 input → 已安装 source key 归一化查找层, 被 update/uninstall 共享使用

### Modified Capabilities
- `unified-source-detection`: 新增 update/uninstall 经 SourceResolver 路径的 input 识别描述
- `local-update`: update 命令本地路径匹配逻辑归到 SourceResolver, 单 skill 行为不变
- `custom-update`: 受 SourceResolver 接管影响, fuzzy 匹配规则重定义
- `uninstall`: 从 `extractOwnerRepo` + byName 二分改为走 SourceResolver, 新增 URL / registry 输入支持描述

## Impact

- **代码**: 新增 `src/services/source-resolver.ts`; 重构 `src/commands/update.ts`, `src/commands/uninstall.ts`; 可能触及 `src/utils/source-detection.ts` 以导出 `parseOwnerRepoSkill` 等辅助
- **测试**: 为 `source-resolver` 写单元测试覆盖所有 input 形式, 更新 `update.test.ts` 和 `uninstall.test.ts` 测试新 input 形式通过
- **用户感知**:
  - `update anthropics/skills` 从报错变成正常工作
  - `update https://github.com/obra/superpowers`, `uninstall https://github.com/...` 等 URL 形式开始生效
  - `update code-review@1.2.0` 明确为"切换到指定版本"
  - 本地 batch 目录 (`update ./spec-tdd`) 仍然报错, 错误信息改进为"batch 路径更新暂不支持, 请手动更新各 skill 或等待 w03"
- **向后兼容**: fallback fuzzy 匹配规则被 SourceResolver 替代, 部分边缘 case 的行为可能变化 (例如 `update skills` 裸词, 现在依赖 `endsWith('/skills')`, 新实现按 source key 后缀 + repoName 后缀 + skill name 依次尝试)
- **依赖**: 无新增第三方依赖
