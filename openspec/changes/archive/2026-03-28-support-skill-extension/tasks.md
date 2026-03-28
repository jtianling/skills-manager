## 1. 源类型检测扩展

- [x] 1.1 在 `src/utils/source-detection.ts` 中提取 `isZipLikeExtension(input)` 辅助函数, 同时匹配 `.zip` 和 `.skill`
- [x] 1.2 重构 `detectSourceType()` 使用 `isZipLikeExtension()` 替代 `input.endsWith('.zip')`

## 2. 测试

- [x] 2.1 在 `src/utils/source-detection.test.ts` 中为 `.skill` 扩展名添加测试: 本地路径、远程 URL、裸文件名
- [x] 2.2 运行全量测试确认无回归
