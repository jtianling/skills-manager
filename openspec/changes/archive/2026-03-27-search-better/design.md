## Context

interactiveCheckbox 组件中, `searchQuery` 同时承担两个职责: 存储用户输入的搜索文本, 以及驱动 `buildDisplayItems` 的过滤逻辑.  这导致无法独立控制 "保留搜索文本" 和 "清除过滤结果".

当前按键行为:
- Enter: 无论是否在搜索模式, 直接确认选择并退出选择器
- Esc: 退出搜索模式, 保留 searchQuery 和过滤结果

## Goals / Non-Goals

**Goals:**
- 搜索模式下 Enter 退出搜索但保留过滤, 用户继续在过滤后的列表中选择
- Esc 退出搜索并清除过滤, 恢复完整列表, 但保留 searchQuery 文本供再次搜索使用
- 非搜索模式下 Enter 行为不变 (确认选择并退出)

**Non-Goals:**
- 不改变搜索模式的进入方式 (`/` 键)
- 不改变搜索过滤算法 (大小写不敏感子串匹配)
- 不改变 space, Ctrl+A 等其他按键行为

## Decisions

### 引入 isFiltered 状态

将过滤控制从 searchQuery 解耦为独立的 `isFiltered: boolean` 状态.

- `searchQuery`: 纯文本存储, 仅在搜索模式下用于显示和输入
- `isFiltered`: 控制 `buildDisplayItems` 是否应用 searchQuery 过滤

**传递给 buildDisplayItems 的 query**: `isFiltered ? searchQuery : ''`

**备选方案**: 使用 `activeFilter` 独立字符串存储当前生效的过滤词.  更灵活但引入冗余状态, 当前需求不需要 searchQuery 和 activeFilter 不同的场景.

**选择理由**: boolean 更简单, 语义清晰, 减少状态不一致的可能性.

### 按键行为映射

| 操作 | isSearchMode | isFiltered | searchQuery |
|------|-------------|------------|-------------|
| `/` 进入搜索 | true | (不变) | (不变) |
| 输入字符 | true | true | 追加字符 |
| Backspace (有文本) | true | true | 删除末字符 |
| Backspace (空文本) | false | false | '' |
| Enter (搜索模式) | false | true (保留) | (不变) |
| Esc (搜索模式) | false | false (清除) | (不变, 保留文本) |
| Enter (非搜索模式) | - | - | resolve 退出 |

### 搜索输入时自动激活过滤

输入搜索字符时, `isFiltered` 自动设为 true.  这样 Enter 退出搜索后过滤自然保留.

### 再次进入搜索模式

按 `/` 再次进入搜索时, 如果 searchQuery 有值, 用户看到之前的文本.  如果 isFiltered 为 false (Esc 退出过), 重新输入字符会重新激活过滤.

## Risks / Trade-offs

[状态复杂度增加] 从 1 个状态 (searchQuery) 变为 3 个 (searchQuery + isSearchMode + isFiltered) → 影响可控, 状态转换表清晰, 测试可覆盖所有组合.

[搜索栏显示逻辑] 非搜索模式下有 searchQuery 但 isFiltered 为 false 时, 搜索栏应如何显示 → 变灰显示 searchQuery 文本, 与当前行为一致, 但过滤不生效.
