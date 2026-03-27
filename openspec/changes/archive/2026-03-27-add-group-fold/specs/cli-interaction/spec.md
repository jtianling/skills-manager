## MODIFIED Requirements

### Requirement: interactiveCheckbox 帮助栏
interactiveCheckbox SHALL 在底部显示操作提示, 包含折叠操作.

#### Scenario: 非搜索模式帮助栏 (有搜索功能)
- **WHEN** interactiveCheckbox 在非搜索模式下渲染, 且 enableSearch 为 true
- **THEN** 帮助栏显示 `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, h/l fold, c fold all, q quit, enter confirm)` 或等效内容

#### Scenario: 非搜索模式帮助栏 (无搜索功能)
- **WHEN** interactiveCheckbox 在非搜索模式下渲染, 且 enableSearch 为 false
- **THEN** 帮助栏显示包含 `h/l fold, c fold all` 或等效折叠提示

#### Scenario: 搜索模式帮助栏不变
- **WHEN** interactiveCheckbox 在搜索模式下渲染
- **THEN** 帮助栏保持现有内容, 不包含折叠快捷键提示 (搜索模式下折叠不生效)
