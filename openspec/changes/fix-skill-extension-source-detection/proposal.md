## Why

`detectSourceType()` 将任何以 `.skill` 结尾的裸字符串判定为 `local-zip`.  `add` 命令用它区分 "已安装 skill 名称" 和 "安装来源", 导致名为 `foo.skill` 的合法 skill 会走本地压缩包分支, 跳过中央仓库查找并报文件不存在.  skill 名来自 frontmatter, 当前没有禁止此类命名.

## What Changes

- 调整 `detectSourceType()` 中 `.skill` 扩展名的判断逻辑, 仅在输入带有明确路径前缀 (`./`, `/`, `~/`, `../`) 或 URL 前缀时才识别为 zip 包来源
- 裸字符串 `foo.skill` 不再匹配 `local-zip`, 而是落入 `unknown` 分支, 从而被 `add` 正确路由到中央仓库查找

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `source-management`: `.skill` 扩展名的源类型检测规则变更, 裸 `.skill` 不再视为 zip 包

## Impact

- `src/utils/source-detection.ts`: 修改 `detectSourceType()` 逻辑
- `src/utils/source-detection.test.ts`: 更新相关测试用例
- 不影响 `./foo.skill`, `~/foo.skill`, URL `.skill` 等带路径/URL 前缀的场景
