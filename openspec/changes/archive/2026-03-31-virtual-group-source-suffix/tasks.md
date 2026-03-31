## 1. 来源 suffix 工具函数

- [x] 1.1 在 `prompts.ts` 中添加 `getSourceSuffix(source: string): string | undefined` 工具函数: custom 开头返回 undefined, 否则去除首段 (official/community) 后返回 `(剩余部分)`
- [x] 1.2 添加 suffix 合并函数 `mergeSuffix(...parts: (string | undefined)[]): string | undefined`, 过滤空值后用空格拼接

## 2. buildVirtualGroupChoices 改造

- [x] 2.1 `toChoice` 中调用 `getSourceSuffix(skill.source)` 生成来源 suffix, 通过 `mergeSuffix` 与 `getSuffix` 回调结果合并
- [x] 2.2 添加单元测试: official/community skill 在虚拟 group 中带来源 suffix, custom skill 无来源 suffix
- [x] 2.3 添加单元测试: 来源 suffix 与功能 suffix 共存 `(anthropic/skills) [deployed]`

## 3. buildSourceGroupedChoices 改造

- [x] 3.1 在分类前先扫描 `skillToGroup`, 将属于虚拟 group 的非 custom skill 从 source 分类中移出, 收集到虚拟 group 对应的 bucket 中
- [x] 3.2 在 custom 分类的虚拟 group 渲染中, 合并移入的非 custom skills, 带来源 suffix
- [x] 3.3 source 分类下 sub-group 中所有 skill 都被移出时, 隐藏该 sub-group; 分类下所有 sub-group 都空时, 隐藏该分类
- [x] 3.4 添加单元测试: official skill 属于虚拟 group 时出现在 custom 分类的虚拟 group 下, 不在 official 分类重复
- [x] 3.5 添加单元测试: 无虚拟 group 时行为不变

## 4. group list 显示改造

- [x] 4.1 `executeGroupList` 中 skill key 解析为 name + 来源 suffix, 使用 `getSourceSuffix` 保持一致
- [x] 4.2 添加单元测试: 混合来源 group 和纯 custom group 的显示格式

## 5. 验证

- [x] 5.1 运行 `pnpm test` 确保所有单元测试通过
- [ ] 5.2 运行 `pnpm test:e2e` 确保 E2E 测试通过
