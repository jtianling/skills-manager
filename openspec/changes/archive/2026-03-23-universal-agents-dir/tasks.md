## 1. 修改工具配置

- [x] 1.1 修改 `src/tools/configs.ts` 中 codex, gemini-cli, opencode, openclaw, antigravity, cline 的 skillsDir 为 `.agents/skills`

## 2. 更新 spec

- [x] 2.1 更新 `openspec/specs/tool-integration/spec.md` 中的工具目录映射表

## 3. 更新测试

- [x] 3.1 更新 `src/tools/configs.test.ts` 中涉及 skillsDir 的断言 (无该文件, 跳过)
- [x] 3.2 更新 `src/services/scanner.test.ts` 中涉及旧目录路径的测试用例 (无该文件, 现有测试不引用旧路径, 跳过)
- [x] 3.3 运行全量测试确认无回归
