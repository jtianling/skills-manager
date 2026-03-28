## Why

Anthropic 发布了 `.skill` 打包格式用于分发 skill 包, 该格式实际上是标准 ZIP 压缩包, 内部结构与现有 `.zip` skill 包完全一致 (顶层目录 + `SKILL.md`).  当前 `detectSourceType()` 仅识别 `.zip` 扩展名, 导致 `.skill` 文件被判定为 `unknown` 而报错.

## What Changes

- 扩展源类型检测逻辑, 使 `.skill` 扩展名与 `.zip` 走相同的安装路径
- 支持本地 `.skill` 文件安装 (`skillsmgr install ./foo.skill`)
- 支持远程 `.skill` URL 安装 (`skillsmgr install https://example.com/foo.skill`)

## Capabilities

### New Capabilities

(无新增能力, 仅扩展已有能力)

### Modified Capabilities

- `source-management`: 源类型检测需识别 `.skill` 扩展名, 将其路由到 zip 安装流程

## Impact

- `src/utils/source-detection.ts`: `detectSourceType()` 函数需扩展扩展名匹配
- `src/utils/source-detection.test.ts`: 补充 `.skill` 扩展名的测试用例
- 安装流程 (`installFromZip`, `installFromRemoteZip`) 无需修改 — `.skill` 内部结构与 `.zip` 完全兼容
