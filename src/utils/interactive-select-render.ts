import {
  getGroupState,
  getInnerGroupKey,
  isFocusable,
} from './interactive-select-utils.js';
import type {
  DisplayItem,
  SelectChoice,
} from './interactive-select-utils.js';

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

interface HeaderLineParams {
  item: DisplayItem & { type: 'group-header' | 'inner-group-header' };
  lineNum: string;
  index: number;
  cursor: number;
  selected: Set<number>;
  collapsed: Set<string>;
  innerCollapsed: Set<string>;
  isFiltered: boolean;
}

interface ChoiceLineParams {
  item: DisplayItem & { type: 'choice'; choiceIndex: number };
  lineNum: string;
  index: number;
  cursor: number;
  selected: Set<number>;
  choices: SelectChoice[];
  columns: number;
  lineNumberWidth: number;
}

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

export function countPhysicalLines(lines: string[], columns: number): number {
  let total = 0;
  for (const line of lines) {
    const visible = stripAnsi(line).length;
    total += visible === 0 ? 1 : Math.ceil(visible / columns);
  }
  return total;
}

export function renderHeaderLine({
  item,
  lineNum,
  index,
  cursor,
  selected,
  collapsed,
  innerCollapsed,
  isFiltered,
}: HeaderLineParams): string {
  const childCount = item.childIndices!.length;
  const state = getGroupState(item.childIndices!, selected);
  const isInnerGroup = item.type === 'inner-group-header';
  const collapseKey = isInnerGroup
    ? getInnerGroupKey(item.parentSubGroup!, item.innerGroupName!)
    : item.subGroupName!;
  const isCollapsed = !isFiltered && (
    isInnerGroup
      ? innerCollapsed.has(collapseKey)
      : collapsed.has(collapseKey)
  );
  const foldIcon = isCollapsed ? '▶' : '▼';
  const triIcon = state === 'all'
    ? '\x1b[32m◉\x1b[0m'
    : state === 'partial'
      ? '\x1b[33m◐\x1b[0m'
      : '◯';
  const isCursor = index === cursor;
  const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
  const highlight = isCursor ? '\x1b[36m' : '';
  const reset = '\x1b[0m';
  const indent = isInnerGroup ? '    ' : '';
  const label = isInnerGroup ? item.innerGroupName : item.subGroupName;
  return `${lineNum} ${indent}${prefix} ${foldIcon} ${triIcon} ${highlight}${label} (${childCount})${reset}`;
}

export function renderChoiceLines({
  item,
  lineNum,
  index,
  cursor,
  selected,
  choices,
  columns,
  lineNumberWidth,
}: ChoiceLineParams): string[] {
  const choice = choices[item.choiceIndex];
  const isSelected = selected.has(item.choiceIndex);
  const isCursor = index === cursor;
  const isLocked = choice.locked ?? false;
  const checkbox = isLocked
    ? '\x1b[2;32m◉\x1b[0m'
    : isSelected ? '\x1b[32m◉\x1b[0m' : '◯';
  const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
  const highlight = isCursor ? '\x1b[36m' : '';
  const reset = '\x1b[0m';
  const suffixText = isSelected && choice.selectedSuffix
    ? choice.selectedSuffix
    : choice.suffix;
  const suffix = suffixText ? ` \x1b[33m${suffixText}\x1b[0m` : '';
  const indent = choice.subGroup === undefined
    ? ''
    : choice.innerGroup === undefined ? '    ' : '        ';
  const lines = [
    `${lineNum} ${indent}${prefix} ${checkbox} ${highlight}${choice.name}${reset}${suffix}`,
  ];

  if (!isCursor || !choice.description) {
    return lines;
  }

  const descIndent = lineNumberWidth + indent.length + 5;
  const maxWidth = columns - descIndent - 1;
  const descPadding = ' '.repeat(descIndent);
  const descLines = wrapText(choice.description, maxWidth);
  return [
    ...lines,
    ...descLines.map((descLine) => `${descPadding}\x1b[2m${descLine}\x1b[0m`),
  ];
}

export function renderSearchLine(
  enableSearch: boolean,
  isSearchMode: boolean,
  searchQuery: string,
  filteredCount: number,
  totalCount: number,
): string | undefined {
  if (!enableSearch) {
    return undefined;
  }
  if (isSearchMode) {
    return `  \x1b[33m🔍 Search:\x1b[0m ${searchQuery}│ \x1b[2m(${filteredCount}/${totalCount} skills)\x1b[0m`;
  }
  return `  \x1b[2m🔍 Search: ${searchQuery} (${filteredCount}/${totalCount} skills)\x1b[0m`;
}

export function renderSeparatorLine(item: DisplayItem, lineNumberWidth: number): string {
  const padding = ' '.repeat(lineNumberWidth);
  return `${padding}  \x1b[33m${item.text}\x1b[0m`;
}

export function renderInstructionLine(
  enableSearch: boolean,
  isSearchMode: boolean,
): string {
  if (enableSearch && isSearchMode) {
    return '\x1b[2m(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)\x1b[0m';
  }
  if (enableSearch) {
    return '\x1b[2m(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, h/l fold, c fold all, q quit, enter confirm)\x1b[0m';
  }
  return '\x1b[2m(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, h/l fold, c fold all, q quit, enter confirm)\x1b[0m';
}

export function countFocusableItems(displayItems: DisplayItem[]): number {
  return displayItems.filter((item) => isFocusable(item)).length;
}
