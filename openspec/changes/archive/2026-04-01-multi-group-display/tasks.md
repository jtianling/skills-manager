## 1. interactiveCheckbox 联动机制

- [x] 1.1 在 `interactiveCheckbox` 中构建 `valueToIndices: Map<string, number[]>` 索引, 将同 value 的 choice indices 关联
- [x] 1.2 修改 space 键 toggle 逻辑: toggle 一个 choice 时, 同时 add/delete `valueToIndices` 中同 value 的所有非 locked indices
- [x] 1.3 修改 group-header toggle 逻辑: 批量 toggle 后, 对每个被操作的 value 做联动同步
- [x] 1.4 修改 ctrl+a 全选逻辑: 操作完成后无需额外处理 (联动在单个 toggle 中已覆盖)
- [x] 1.5 修改 resolve 返回值: `[...new Set(Array.from(selected).map(i => choices[i].value))]` 去重

## 2. buildVirtualGroupChoices 多 group 支持

- [x] 2.1 将 `skillToGroup: Map<string, string>` 改为 `skillToGroups: Map<string, string[]>`, 移除 first-match-wins 的 `if (!has)` 判断
- [x] 2.2 遍历 skills 时, 对每个 skill 的所有归属 group 各生成一份 choice (不同 subGroup, 相同 value)
- [x] 2.3 对 groupsData 中存在但无匹配 skill 的 group, 插入空占位确保 group header 可见
- [x] 2.4 更新 `prompts.test.ts` 中 `buildVirtualGroupChoices` 的相关测试: 多 group 归属场景返回多份 choice, 空 group 显示 header

## 3. buildSourceGroupedChoices 多 group 支持

- [x] 3.1 将 `skillToGroup: Map<string, string>` 改为 `skillToGroups: Map<string, string[]>`
- [x] 3.2 删除 `movedToVirtualGroup` / `movedKeys` 逻辑 — 非 custom skill 不再从 byCategory 中移除
- [x] 3.3 在 custom 分区渲染时, 遍历 groupsData 所有 group, 查找每个 group 的 skill 并生成 clone choice (带来源 suffix)
- [x] 3.4 确保空 group 在 custom 分区下仍显示 header
- [x] 3.5 更新 `prompts.test.ts` 中 `buildSourceGroupedChoices` 的相关测试: skill 同时在 source 分组和虚拟 group 出现, 空 group 显示

## 4. 验证

- [x] 4.1 运行 `pnpm test` 确保所有测试通过
- [x] 4.2 `pnpm build` 确保编译成功
