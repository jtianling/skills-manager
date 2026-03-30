## 1. 修改源类型检测逻辑

- [x] 1.1 修改 `src/utils/source-detection.ts` 中 `detectSourceType()`, 裸 `.skill` 字符串不再匹配 `local-zip`, 仅当带路径前缀时才匹配

## 2. 更新测试

- [x] 2.1 更新 `src/utils/source-detection.test.ts` 中裸 `.skill` 的期望结果从 `local-zip` 改为 `unknown`
- [x] 2.2 添加带路径前缀的 `.skill` 文件仍返回 `local-zip` 的测试用例 (`./foo.skill`, `/path/to/foo.skill`, `~/foo.skill`)

## 3. 更新 spec

- [x] 3.1 同步 delta spec 到主 spec `openspec/specs/source-management/spec.md`
