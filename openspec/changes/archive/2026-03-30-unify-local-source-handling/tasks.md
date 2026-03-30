## 1. detectSourceType 移除裸词 fallback

- [x] 1.1 在 `SourceType` 联合类型中新增 `'unknown'`
- [x] 1.2 将 `detectSourceType` 的裸词 fallback (`return 'local-path'`) 改为 `return 'unknown'`
- [x] 1.3 更新 `source-detection.test.ts`, 裸词用例期望返回 `'unknown'`

## 2. install 命令适配 unknown 类型

- [x] 2.1 在 `installSource` 和 `executeInstall` 的 switch 中处理 `'unknown'`: 报错 "Unknown source format. Use ./name for local, owner/repo for GitHub."
- [x] 2.2 更新 `install.test.ts` 中裸词相关的测试用例
- [x] 2.3 更新 `e2e/install-local.e2e.ts` 中裸词测试: 改为使用 `./` 前缀

## 3. update 命令支持 local-copy 更新

- [x] 3.1 在 `update.ts` 中新增 `updateLocalCopy(key, info)` 函数: 从原始路径对比 SKILL.md, 有变化则重新拷贝
- [x] 3.2 将 `updateSource` 中 local-copy 的 "skip" 逻辑替换为调用 `updateLocalCopy`
- [x] 3.3 编写 `updateLocalCopy` 的测试用例 (路径存在/不存在, 内容相同/不同)

## 4. update 命令接受本地路径参数

- [x] 4.1 在 `executeUpdate` 中使用 `detectSourceType` 判断输入, `'local-path'` 时按 url 字段匹配 source
- [x] 4.2 编写按路径更新的测试用例 (匹配成功/失败)

## 5. 删除 custom-update 命令

- [x] 5.1 删除 `src/commands/custom-update.ts`
- [x] 5.2 从 `src/index.ts` 移除 `customUpdateCommand` 的 import 和注册
- [x] 5.3 删除 custom-update 相关测试文件 (如有)

## 6. 集成验证

- [x] 6.1 确保 `pnpm test --run` 全部通过
- [x] 6.2 确保 `pnpm build` 成功
