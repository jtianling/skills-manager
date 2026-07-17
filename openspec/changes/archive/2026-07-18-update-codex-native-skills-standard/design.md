## Context

项目级 skill 主体统一部署到 `.agents/skills`。工具配置中的 `native` 同时控制
项目级 UI 分组、configured 扫描方式和是否创建 symlink bridge。Codex 当前被配置为
`native: false`，但新版 Codex 已直接扫描仓库层级的 `.agents/skills`。

项目级 UI 使用 `agents-skills-standard` 作为虚拟值代表全部 native agent，而
`targetAgents` 和 companion 部署需要真实的 `SUPPORTED_TOOLS` 名称。当前代码直接把
虚拟值传入这两条路径，因此把 Codex 改为 native 后必须同时补齐真实 agent 展开。

## Goals / Non-Goals

**Goals:**

- 让 Codex 通过 `.agents/skills` 原生发现项目 skill。
- 消除新部署对 `.codex/skills` bridge 的创建和依赖。
- 保留 `codex` 作为 manifest 兼容性与 companion 的真实 agent ID。
- 保持 `add` 锁定已部署 skill、`deploy` 可取消已部署 skill 的既有差异。

**Non-Goals:**

- 不主动删除用户已有 `.codex/skills` 路径。
- 不改变全局部署的逐 agent 选择和 `$CODEX_HOME/skills` 目标。
- 不修改其他工具的 native/non-native 分类。

## Decisions

1. **通过工具配置声明 Codex native。** 将 Codex 的 `native` 改为 `true` 并移除
   `symlinkDir`，复用所有现有 native 工具的 prompt、scanner 和 list 行为。相比增加
   Codex 特判，这能维持单一配置真相源。

2. **引入项目级选择的规范化边界。** 原始 UI/CLI 选择仍保留用于 bridge 生命周期；
   在 `targetAgents` 与 companion 部署前，将 `agents-skills-standard` 展开为所有
   `native && showInList` 的真实 agent ID，并与显式选择去重。这样既不把虚拟值写入
   manifest 语义，也不影响 `-a codex` 和全局部署。

3. **保留已有 Codex bridge。** scanner 不再把它当作 Codex configured 的依据，
   deploy/remove 也不再新建或主动删除它。升级行为保持非破坏性，用户可自行清理。

4. **用单元测试覆盖分类与规范化。** 更新 config/prompt/scanner/add/deployer 相关测试，
   特别断言没有 `.codex/skills` 时 Codex仍 configured，以及标准选择能匹配 Codex
   targetAgents 并部署 Codex companion。

## Risks / Trade-offs

- [标准聚合项表示多个真实 agent，可能部署更多 native companion] → 这是聚合项展示
  “全部 native agent”的既有语义；仅 manifest 显式声明的 companion 会被写入。
- [旧 `.codex/skills` bridge 留存] → 避免删除用户路径；list/scanner 不再依赖它，
  后续可另行提供迁移清理命令。
- [内部结果仍可能展示虚拟 agent 名] → 对外 CLI 选择保持兼容，仅在需要真实 agent
  身份的业务边界规范化。
