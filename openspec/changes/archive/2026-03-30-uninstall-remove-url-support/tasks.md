## 1. Core: extractOwnerRepo 函数

- [x] 1.1 在 `src/utils/source-detection.ts` 中实现 `extractOwnerRepo(input): string | null`, 支持 HTTPS URL(GitHub/GitLab 等), SSH URL, owner/repo 直传, 末尾斜杠和 .git 后缀处理
- [x] 1.2 为 `extractOwnerRepo` 编写单元测试, 覆盖 specs 中所有 scenario

## 2. detectArgFormat 修改

- [x] 2.1 修改 `src/utils/repo-lookup.ts` 中的 `detectArgFormat()`, 当 `detectSourceType` 返回 `remote-url` 且 `extractOwnerRepo` 能提取时返回 `'owner-repo'`
- [x] 2.2 为修改后的 `detectArgFormat` 编写单元测试

## 3. uninstall 命令支持 URL

- [x] 3.1 修改 `src/commands/uninstall.ts` 中 `executeUninstall()`, 在 identifier 判断逻辑中增加 URL → owner/repo 提取分支
- [x] 3.2 为 uninstall URL 场景编写单元测试

## 4. remove 命令支持 URL

- [x] 4.1 修改 `src/commands/remove.ts` 中 `executeRemove()`, 对 URL 输入调用 `extractOwnerRepo()` 转换后传给 `removeByOwnerRepo()`
- [x] 4.2 为 remove URL 场景编写单元测试

## 5. 验证

- [x] 5.1 运行全量单元测试确认无回归
- [x] 5.2 构建确认编译通过
