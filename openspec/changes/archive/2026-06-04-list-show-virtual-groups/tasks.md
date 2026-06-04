## 1. 测试先行 (RED)

- [x] 1.1 在 `src/commands/list.test.ts` 增加用例: 虚拟 group 作为子标题出现, 成员缩进列在其下 (mock `GroupsService` 返回含 `kind: "virtual"` 的 `develop`)
- [x] 1.2 增加用例: 虚拟 group 成员不再出现在 custom 平铺列表中
- [x] 1.3 增加用例: 物理子组 (`custom/openspec`) 排在虚拟 group 子组 (`develop`) 之前
- [x] 1.4 增加用例: skill 同属多个虚拟 group 时, 在每个子组下各列一次
- [x] 1.5 增加用例: 跨 category 虚拟 group, 成员在其所属 category 区块内成组
- [x] 1.6 增加用例: 悬空成员 (skillKey 无对应已安装 skill) 不渲染, 子组计数只算已解析成员
- [x] 1.7 增加用例: 无 `kind: "virtual"` group 时输出与变更前一致 (回归)
- [x] 1.8 运行确认新用例 RED

## 2. 实现 (GREEN)

- [x] 2.1 在 `listAvailable` 读取 `kind: "virtual"` 的 group 及成员, 构建 `skillKey → virtualGroupNames[]` 映射 (经 `GroupsService.getGroupKind` 过滤)
- [x] 2.2 每个 category 渲染: 命中虚拟 group 的 skill 从平铺桶移出, 在每个所属虚拟 group 子组下各列一次
- [x] 2.3 子组排序: 物理子组 (按名升序) → 虚拟 group 子组 (按名升序) → 平铺 skill
- [x] 2.4 子组计数为实际呈现成员数; category 头计数保持去重 skill 数
- [x] 2.5 不改 `renderName` 标注、`── collections ──` 块、`--json` 分支
- [x] 2.6 运行确认用例 GREEN

## 3. 验证与无副作用

- [x] 3.1 `pnpm run build` 通过
- [x] 3.2 `pnpm test` 全绿 (含既有 list 测试无回归)
- [x] 3.3 用真实 `~/.skills-manager/groups.json` 跑 `node dist/index.js list`, 确认 `develop` 子组出现且成员从平铺移出
- [x] 3.4 确认未受影响项: `list --json`、`list --deployed`、交互式选择流程输出不变
