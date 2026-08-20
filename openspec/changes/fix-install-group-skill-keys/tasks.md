## 1. 类型与契约

- [x] 1.1 `src/commands/install-utils.ts`: `InstallResult` 新增 `skillKeys?: string[]`, 语义为"每个已安装 skill 的完整 skill key (`{source}/{name}`)", 与 `installedPaths` 一一对应; 在类型上方加一行意图注释区分它与 `sourceKeys`
- [x] 1.2 `createInstallResult` 增加可选的 `skillKeys` 入参并透传, 不改变现有位置参数顺序
- [x] 1.3 `pnpm run build` 通过

## 2. 回归护栏先行 (TDD, RED)

- [x] 2.1 新建 `src/commands/install-group-keys.test.ts`, 按 `custom-install` delta 的 scenario 写 RED 测试: community / registry / well-known 三种多段 source 的 `install --group` 后, `groups.json` 成员为完整 skill key 且**不含** source key
- [x] 2.2 补 "成员数量与安装 skill 数量一致" scenario: 8 个可选只选 3 个, 断言恰好 3 条成员且未选中的 5 个不在组内
- [x] 2.3 补 "无副作用" scenario: 已存在的 `develop` group 成员在本次 install 后保持不变
- [x] 2.4 补 custom 平铺路径不回归的 scenario (`install ./x --group g` 仍写 `custom/x`)
- [x] 2.5 确认 2.1–2.4 全部 RED (当前实现下失败), 再进入实现

## 3. 四条 install 分支填充 skill key

- [x] 3.1 `src/commands/install-git.ts:158` 单 skill 路径: 补 `skillKeys`
- [x] 3.2 `src/commands/install-git.ts:267` 多 skill 路径: 遍历选中 skill 用 `${sourceKey}/${skill.name}` 构造
- [x] 3.3 `src/commands/install-registry.ts:125`: 用 `selectedSkills.map((s) => `${sourceKey}/${s.name}`)` 替代 `map(() => sourceKey)`
- [x] 3.4 `src/commands/install-wellknown.ts:150`: 同上, 用 `selected` 的 skill name 构造
- [x] 3.5 `src/commands/install-local.ts:69` 与 `:134`: 补 `skillKeys` (custom 源两者同形, 显式填写而非依赖巧合)
- [x] 3.6 2.1–2.4 转 GREEN

## 4. 消费侧切换

- [x] 4.1 `src/commands/install.ts:131`: `--group` 入组改用 `result.skillKeys`
- [x] 4.2 `src/commands/install.ts`: `options.group` 已指定但 `skillKeys` 为空/缺失时报错, 不静默跳过入组 (对应 delta 的"无法确定 skill key 时报错" scenario) 并补测
- [x] 4.3 `src/commands/install.ts:142`: `--json` 输出的 `skills` 字段改用 `result.skillKeys`; 补一条断言 JSON 输出的 skills 与 groups.json 成员一致
- [x] 4.4 `src/commands/install-collection.ts:227`: `--group` 入组改用 skill key
- [x] 4.5 `src/commands/install-collection.ts:235`: `upsertCollectionGroup` 改用 skill key
- [x] 4.6 按 `virtual-group` delta 的 collection scenario 补测 (collection group 成员为 skill key / `--from` + `--group` 两条路径一致 / 可被 `add --group` 解析)

## 5. 回滚与相邻字段的安全确认

- [x] 5.1 断言 `rollback.ts` 仍消费 `sourceKeys` 且仍是 source key: 构造安装中途失败的用例, 验证 `sources.json` 条目被正确清理
- [x] 5.2 解决 design.md Open Question 1: 查 `bundle-manager.ts` 读取侧, 确定 `install-local.ts:141` 的 bundle `members` 要的是 source key 还是 skill key; 若是 skill key 则一并修正并补测, 若是 source key 则保持不动并加意图注释
- [x] 5.3 逐一复核 `sourceKeys` 的其余消费点 (`uninstall.ts:164/267/276`, `update.ts:306/435`, `add.ts:517`, `source-resolver.ts`) 语义未被本变更影响, 结论写入 PR 描述

## 6. 正反向对称性自查

- [x] 6.1 核对 `bundle-manager.ts:222` 的 `removeSkillFromAll(`${sourceKey}/${skillName}`)` 与本次修正后的写入格式一致
- [x] 6.2 核对 `uninstall` 后 `groups.json` 中对应 skill key 成员被清理干净, 且不误删其他 group 的成员; 补无副作用断言
- [x] 6.3 端到端: `install <多段 source> --group g` → `add --group g` → `uninstall <source>` → 断言 group 成员被清空且其他 group 不变

## 7. 收尾

- [x] 7.1 `pnpm test` 全绿
- [x] 7.2 e2e 由 team 内独立 tester 验收 (证据 `.e2e-test/runs/skillsmgr-two-changes-20260820-201725/`): 全量 e2e 170 PASS / 25 FAIL, 干净 HEAD 基线复跑同 9 个红文件同样 25 FAIL, 本变更新增失败 0; `install --group` → `add --group` 全链路与负向报错路径均独立复现通过.  那 25 个失败为既有债务 (e2e 按 V1 顶层 Record 读 groups.json / 两处依赖外部真实数据漂移), 应单开 change 处理
  - 未执行: 本机有其他 agent 的实时 tmux session, 会话内禁止跑 tmux 型 e2e.  静态复核: 全部 e2e 用例中没有把 `--group` 与多段 source (community / registry / well-known) 组合的断言, 也没有断言 `--from` collection group 成员或 `install --json` 的 `skills` 字段, 故不预期回归.
- [ ] 7.3 CHANGELOG 记录: 修复前用多段 source 建的 group 需要重建一次 (不自动迁移, 理由见 design)
  - 未执行: 仓库没有 CHANGELOG.md, 也无同类发布说明文件, 新建属于超出本变更范围.  迁移说明当前落在 proposal.md 与 design.md 的 Migration Plan, 需要由维护者决定落到何处.

## 8. update <collection-ref> 写入路径 (实现中发现, 补入)

- [x] 8.1 `src/commands/update.ts` 的 `updateCollectionGroup`: `desiredKeys` 由 source key 改为 skill key, 新增 `collectionMemberSkillKeys` 按"新装结果 → 快照同前缀成员 → 磁盘枚举 → 原样保留"四级优先级推导
- [x] 8.2 包"是否已跟踪"的 diff 判定改为前缀匹配, 兼容 legacy 的精确 source key 条目, 避免重复安装
- [x] 8.3 推导不出 skill key 时保留旧条目, 不静默清空 group; 刚装的包若未报告 skill key 也继续往下推导而非直接丢弃
- [x] 8.4 移除因此不再使用的 `memberToSkillName` import 及其 `void` 占位
- [x] 8.5 `update-collection.test.ts` 既有 3 个用例更新到 skill key 契约, 新增 2 个用例覆盖"不用 source key 覆盖 skill key"与"推导不出时保留旧条目"
- [x] 8.6 `virtual-group` delta 补 "update <collection-ref> 重写成员时保持 skill key" 需求
