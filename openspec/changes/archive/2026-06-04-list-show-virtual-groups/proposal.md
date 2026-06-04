## Why

`skillsmgr list` 的 body 渲染用一套独立的、纯 source-path 分组逻辑 (`byCategory` / `ungroupedByCategory`), 完全不读 `groups.json`.  导致 `kind: "virtual"` 的虚拟 group (如 `develop`) 在 `list` 输出里完全隐形: 成员散落在 custom 的平铺列表里, 看不出它们属于一个 group.  而交互式选择界面 (`add` / `deploy` / `remove`, 经 `buildSourceGroupedChoices`) 早已把虚拟 group 作为子标题正常展示 —— 两套分组实现不一致, `list` 掉队.

## What Changes

- `list` 命令的 `listAvailable` body 渲染纳入虚拟 group (`kind: "virtual"`) 归属: 虚拟 group 作为子标题出现在对应 category 下, 成员缩进列在其下
- 属于某个虚拟 group 的 skill 不再出现在 category 的平铺 (ungrouped) 列表里
- 一个 skill 同时属于多个虚拟 group 时, 在每个所属 group 子标题下各列一次
- 虚拟 group 成员跨 category 时, 成员在其所属 category 区块内以该 group 子标题缩进 (同名 group 标题可在多个 category 区块各出现一次)
- 子标题排序: 物理 (source-path / local-batch) 子组在前, 虚拟 group 子组在后, 各自按名字排序; 平铺 skill 最后
- 不改 `renderName` 的 `← collection` 标注逻辑, 不为虚拟 group 成员加 `← develop` 标注
- 不改末尾 `── collections ──` 块 (collection 是另一种 kind, 不在本次范围)
- 不改 `list --json` 输出 (json 的 `collections` 字段语义保持, 虚拟 group 归属暂不进 json)

## Capabilities

### New Capabilities

<!-- 无新增 capability -->

### Modified Capabilities

- `skill-grouping`: 其中 **"list 命令二级缩进输出"** requirement 当前只描述 source-path 分组; 扩展为纳入虚拟 group 归属 (虚拟 group 作为子标题, 成员从平铺移入, 多 group 各列一次, 物理子组在前虚拟子组在后)

## Impact

- 代码: `src/commands/list.ts` 的 `listAvailable` (body 文本渲染); 复用 `src/services/groups.ts` (`GroupsService`) 读取虚拟 group 成员
- 测试: `src/commands/list.test.ts` 增加虚拟 group 渲染断言
- 不影响: 交互式选择流程 (`prompts.ts`)、`list --json`、`list --deployed`、`── collections ──` 末尾块
