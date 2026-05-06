## 1. 类型与存储扩展

- [x] 1.1 `types.ts` 增加 `CollectionGroupEntry`，扩展 `GroupKind = 'virtual' | 'local-batch' | 'collection'`，扩 `GroupEntry` union
- [x] 1.2 `services/groups.ts` 新增 `validateCollectionGroupKey(key)`（复用 normalizeCollectionRef 的正则）
- [x] 1.3 `GroupsService` 区分 user-defined group key 校验（现有）和 collection key 校验（新增），按 kind 分派
- [x] 1.4 新增方法：`upsertCollectionGroup(ref, members)`、`getCollectionGroup(ref)`、`removeCollectionGroup(ref)`
- [x] 1.5 修改 `addSkill` / `removeSkill` 在目标是 collection group 时拒绝（read-only）

## 2. install --from 集成

- [x] 2.1 `install-collection.ts` 在所有 member 安装尝试结束后调用 `upsertCollectionGroup`
- [x] 2.2 仅当至少 1 个 member 成功安装时才 upsert（避免空 group）
- [x] 2.3 JSON 输出新增 `group: "<ref>"` 字段

## 3. add/remove --group 识别 collection ref

- [x] 3.1 `add.ts` 和 `remove.ts` 解析 `--group` 输入：`@<owner>/<slug>` 形式 → 查 collection group
- [x] 3.2 collection group 不存在时给出明确错误（提示 install --from）
- [x] 3.3 found 时按 members 走现有 deploy / undeploy 流程

## 4. uninstall --from 清理 collection group

- [x] 4.1 `uninstall.ts` 在 `--from` 分支执行完后调 `removeCollectionGroup(ref)`
- [x] 4.2 测试：uninstall 后 `groups.json` 中 collection 条目被删除

## 5. update 路由 collection ref

- [x] 5.1 `update.ts` 在解析 source 参数时检测 collection ref 形式（用 `normalizeCollectionRef` 试探）
- [x] 5.2 命中时走新流程：resolve → 差量安装 → 更新 group snapshot
- [x] 5.3 group 不存在时报错引导先 install
- [x] 5.4 移除的 member 仅从 group members 删除，不卸载 skill 本身

## 6. group list 显示 collection

- [x] 6.1 `group.ts` list 子命令按 kind 分组展示
- [x] 6.2 collection group 行显示 ref + members 数量

## 6b. skills list 标注 collection 归属

- [x] 6b.1 `list.ts` 构建 skill source key → collection ref 映射
- [x] 6b.2 文本输出在每个 skill 行后追加 `← <ref>`（多个用 `, ` 分隔）
- [x] 6b.3 文末输出 `── collections ──` 段汇总
- [x] 6b.4 JSON 输出每个 skill 增加 `collections` 字段

## 7. group add/remove 命令拒绝修改 collection

- [x] 7.1 `groupCommand add` 检测目标 group kind == 'collection' 时报错（包含 update 提示）
- [x] 7.2 `groupCommand remove` 同样拒绝

## 8. 测试

- [x] 8.1 `validateCollectionGroupKey` 单测（合法/非法形式）
- [x] 8.2 `upsertCollectionGroup` / `getCollectionGroup` / `removeCollectionGroup` 单测
- [x] 8.3 install --from 端到端：验证 collection group 创建 + members 正确
- [x] 8.4 install --from 二次执行：验证 installedAt 不变 / updatedAt 更新
- [x] 8.5 add --group @owner/slug 端到端
- [x] 8.6 remove --group @owner/slug 端到端
- [x] 8.7 uninstall --from：验证 group 被删除
- [x] 8.8 update @owner/slug：验证差量同步行为（增 / 删 members snapshot）
- [x] 8.9 group add/remove 命令对 collection group 报错
- [x] 8.10 group list 输出包含 collection 区段
