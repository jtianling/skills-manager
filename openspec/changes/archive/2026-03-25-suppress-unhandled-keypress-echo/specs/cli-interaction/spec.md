## MODIFIED Requirements

### Requirement: 未识别按键忽略
非搜索模式下, 未被 interactiveCheckbox 识别的按键 SHALL 被静默忽略, 不产生任何效果或副作用.  readline interface SHALL NOT 将任何字符回显到终端输出.

#### Scenario: 未识别按键无效果
- **WHEN** 用户在非搜索模式下按未识别的键 (如 x, z, 等)
- **THEN** 无任何效果, 列表状态不变, 不触发渲染, 终端无字符输出

#### Scenario: readline 不回显字符
- **WHEN** interactiveCheckbox 创建 readline interface
- **THEN** readline 的 output SHALL 为一个不产生任何输出的 stream, 而非 process.stdout
