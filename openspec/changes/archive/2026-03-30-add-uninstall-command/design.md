## Context

`skillsmgr` 当前有 `install` 命令从远程源下载 skills 到 `~/.skills-manager/`, 有 `remove` 命令从项目中移除已部署的 skill, 但缺少从中央仓库删除 skills 的命令.  需要新增 `uninstall` 命令填补这个空缺.

现有可复用的基础设施:
- `SkillsService.getAllSkills()` / `findSkillsByName()` 可用于搜索已安装的 skills
- `SourcesService.removeSource()` 已实现, 可直接用于清理 `sources.json`
- `removeDir()` 工具函数可用于删除目录
- `OFFICIAL_PROVIDERS` / `resolveProviderAlias()` 可用于 provider 解析

## Goals / Non-Goals

**Goals:**
- 提供 `install` 的逆操作, 从中央仓库删除已安装的 skills
- 支持 provider 级别, source 级别, skill 名称级别三种粒度
- 删除前给出明确的警告和确认流程
- 删除后自动清理 `sources.json` 中的无效记录和空目录

**Non-Goals:**
- 不扫描所有项目来查找已部署的 skill(不可能做到)
- 不自动删除项目中已部署的 skill(由 `remove` 命令负责)
- 不支持从远程源选择性卸载(只操作本地已安装的文件)

## Decisions

### 1. Identifier 解析策略

按优先级顺序匹配:

1. 精确匹配 `OFFICIAL_PROVIDERS` key 或其 alias -> provider 级别卸载
2. 匹配 `owner/repo` 格式 -> community source 级别卸载
3. 其他输入 -> 作为 skill 名称在所有来源中搜索

**理由**: 与 `install` 命令的解析逻辑保持一致.  provider key 优先是因为它是最常用且无歧义的输入形式.

### 2. 文件删除策略

- Provider 级别: 删除 `~/.skills-manager/official/<providerKey>/` 整个目录
- Community source 级别: 删除 `~/.skills-manager/community/<owner>/<repo>/` 目录, 若 `<owner>/` 为空则一并清理
- Skill 名称级别: 仅删除匹配的 skill 目录, 检查父级目录是否为空并清理

**理由**: 自底向上清理空目录, 保持文件系统整洁.

### 3. 命令文件结构

新建 `src/commands/uninstall.ts`, 遵循现有命令的模式:
- 导出 `executeUninstall()` 函数用于逻辑实现
- 导出 `uninstallCommand` 用于 Commander 注册
- 在 `src/index.ts` 中注册

**理由**: 保持与其他命令一致的代码组织方式.

### 4. 确认交互

使用 `inquirer` 的 `confirm` prompt, 与项目中已有的交互模式一致.  `--force` 标志跳过.

## Risks / Trade-offs

- [Broken symlinks] 删除中央仓库的 skill 后, 项目中已部署的 symlink 会失效 -> 通过删除前的警告信息提示用户先清理部署
- [同名 skill 歧义] 多个来源存在同名 skill 时需要用户选择 -> 列出所有匹配并提示选择
- [空目录残留] 删除 skill 后父级目录可能为空 -> 自底向上检查并清理空目录
