import * as readline from 'readline';
import { Writable } from 'stream';

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function countPhysicalLines(lines: string[], columns: number): number {
  let total = 0;
  for (const line of lines) {
    const visible = stripAnsi(line).length;
    total += visible === 0 ? 1 : Math.ceil(visible / columns);
  }
  return total;
}

/**
 * Wrap text to fit within maxWidth, breaking at word boundaries
 */
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

export interface SelectChoice {
  name: string;
  description?: string;
  value: string;
  checked?: boolean;
  locked?: boolean;
  group?: string;
  subGroup?: string;
  suffix?: string;
  selectedSuffix?: string;
}

interface SelectOptions {
  message: string;
  choices: SelectChoice[];
  pageSize?: number;
  searchThreshold?: number;
  onToggle?: (selected: Set<number>, choices: SelectChoice[]) => void;
}

export interface DisplayItem {
  type: 'separator' | 'choice' | 'group-header';
  text?: string;
  choiceIndex?: number;
  childIndices?: number[];
  subGroupName?: string;
}

export type GroupState = 'all' | 'partial' | 'none';

export function getGroupState(childIndices: number[], selected: Set<number>): GroupState {
  if (childIndices.length === 0) return 'none';
  let selectedCount = 0;
  for (const idx of childIndices) {
    if (selected.has(idx)) selectedCount++;
  }
  if (selectedCount === 0) return 'none';
  if (selectedCount === childIndices.length) return 'all';
  return 'partial';
}

/**
 * Build display items from choices, optionally filtered by search query
 */
export function buildDisplayItems(
  choices: SelectChoice[],
  searchQuery: string
): { displayItems: DisplayItem[]; filteredIndices: number[] } {
  const displayItems: DisplayItem[] = [];
  const filteredIndices: number[] = [];
  let currentGroup: string | undefined;
  let currentSubGroup: string | undefined;
  let currentGroupHeader: DisplayItem | undefined;

  choices.forEach((choice, index) => {
    if (searchQuery && !choice.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return;
    }

    filteredIndices.push(index);

    if (choice.group && choice.group !== currentGroup) {
      currentGroup = choice.group;
      currentSubGroup = undefined;
      currentGroupHeader = undefined;
      displayItems.push({ type: 'separator', text: `── ${choice.group} ──` });
    }

    if (choice.subGroup !== undefined && choice.subGroup !== currentSubGroup) {
      currentSubGroup = choice.subGroup;
      currentGroupHeader = {
        type: 'group-header',
        subGroupName: choice.subGroup,
        childIndices: [],
      };
      displayItems.push(currentGroupHeader);
    } else if (choice.subGroup === undefined && currentSubGroup !== undefined) {
      currentSubGroup = undefined;
      currentGroupHeader = undefined;
    }

    if (currentGroupHeader && choice.subGroup !== undefined) {
      currentGroupHeader.childIndices!.push(index);
    }

    displayItems.push({ type: 'choice', choiceIndex: index });
  });

  return { displayItems, filteredIndices };
}

function isFocusable(item: DisplayItem): boolean {
  return item.type === 'choice' || item.type === 'group-header';
}

/**
 * Custom interactive checkbox with vi-style navigation
 */
export async function interactiveCheckbox(
  options: SelectOptions
): Promise<string[]> {
  const { message, choices, pageSize = 15, searchThreshold = 20, onToggle } = options;
  const enableSearch = choices.length > searchThreshold;

  const selected = new Set<number>(
    choices
      .map((c, i) => (c.checked ? i : -1))
      .filter((i) => i >= 0)
  );

  let searchQuery = '';
  let isSearchMode = false;
  let isFiltered = false;
  let { displayItems, filteredIndices } = buildDisplayItems(choices, '');

  let cursor = displayItems.findIndex((item) => isFocusable(item));
  if (cursor === -1) cursor = 0;

  let scrollOffset = 0;
  let lastRenderedLines = 0;
  let numberBuffer = '';
  let lastKeyWasG = false;

  return new Promise((resolve) => {
    const nullOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    const rl = readline.createInterface({
      input: process.stdin,
      output: nullOutput,
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    const render = (isInitial = false) => {
      if (!isInitial && lastRenderedLines > 0) {
        process.stdout.write(`\x1b[${lastRenderedLines}A\x1b[J`);
      }

      const lines: string[] = [];
      lines.push(`? ${message}`);

      if (enableSearch) {
        const searchDisplay = searchQuery || '';
        if (isSearchMode) {
          lines.push(`  \x1b[33m🔍 Search:\x1b[0m ${searchDisplay}│ \x1b[2m(${filteredIndices.length}/${choices.length} skills)\x1b[0m`);
        } else {
          lines.push(`  \x1b[2m🔍 Search: ${searchDisplay} (${filteredIndices.length}/${choices.length} skills)\x1b[0m`);
        }
      }

      const totalChoices = displayItems.filter(item => item.type === 'choice').length;
      const lineNumberWidth = totalChoices > 0 ? String(totalChoices).length : 1;

      const visibleStart = scrollOffset;
      const visibleEnd = Math.min(scrollOffset + pageSize, displayItems.length);

      if (scrollOffset > 0) {
        lines.push('  \x1b[2m↑ more above\x1b[0m');
      }

      if (displayItems.length === 0) {
        lines.push('  \x1b[2mNo matching skills found\x1b[0m');
      }

      let choiceCount = 0;
      for (let i = 0; i < displayItems.length; i++) {
        if (displayItems[i].type === 'choice') {
          choiceCount++;
        }
        if (i >= visibleStart && i < visibleEnd) {
          const item = displayItems[i];

          if (item.type === 'separator') {
            const padding = ' '.repeat(lineNumberWidth);
            lines.push(`${padding}  \x1b[33m${item.text}\x1b[0m`);
          } else if (item.type === 'group-header') {
            const childCount = item.childIndices!.length;
            const state = getGroupState(item.childIndices!, selected);
            const triIcon = state === 'all' ? '\x1b[32m◉\x1b[0m'
              : state === 'partial' ? '\x1b[33m◐\x1b[0m'
              : '◯';
            const isCursor = i === cursor;
            const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
            const highlight = isCursor ? '\x1b[36m' : '';
            const reset = '\x1b[0m';
            const padding = ' '.repeat(lineNumberWidth);
            lines.push(
              `${padding} ${prefix} ${triIcon} ${highlight}${item.subGroupName} (${childCount})${reset}`
            );
          } else {
            const choice = choices[item.choiceIndex!];
            const isSelected = selected.has(item.choiceIndex!);
            const isCursor = i === cursor;
            const isGroupChild = choice.subGroup !== undefined;

            const lineNum = String(choiceCount).padStart(lineNumberWidth, ' ');
            const isLocked = choice.locked ?? false;
            const checkbox = isLocked
              ? '\x1b[2m◉\x1b[0m'
              : isSelected ? '\x1b[32m◉\x1b[0m' : '◯';
            const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
            const highlight = isLocked ? '\x1b[2m' : isCursor ? '\x1b[36m' : '';
            const reset = '\x1b[0m';
            const suffixText = isSelected && choice.selectedSuffix ? choice.selectedSuffix : choice.suffix;
            const suffix = suffixText ? ` \x1b[33m${suffixText}\x1b[0m` : '';
            const indent = isGroupChild ? '  ' : '';

            lines.push(
              `${lineNum} ${indent}${prefix} ${checkbox} ${highlight}${choice.name}${reset}${suffix}`
            );

            if (isCursor && choice.description) {
              const descIndent = lineNumberWidth + 5 + (isGroupChild ? 2 : 0);
              const maxWidth = process.stdout.columns
                ? process.stdout.columns - descIndent - 1
                : 80 - descIndent - 1;
              const descPadding = ' '.repeat(descIndent);
              const descLines = wrapText(choice.description, maxWidth);
              for (const descLine of descLines) {
                lines.push(`${descPadding}\x1b[2m${descLine}\x1b[0m`);
              }
            }
          }
        } else if (i >= visibleEnd) {
          break;
        }
      }

      if (visibleEnd < displayItems.length) {
        lines.push('  \x1b[2m↓ more below\x1b[0m');
      }

      if (enableSearch && isSearchMode) {
        lines.push(
          '\x1b[2m(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)\x1b[0m'
        );
      } else if (enableSearch) {
        lines.push(
          '\x1b[2m(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)\x1b[0m'
        );
      } else {
        lines.push(
          '\x1b[2m(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)\x1b[0m'
        );
      }

      console.log(lines.join('\n'));
      const termColumns = process.stdout.columns || 80;
      lastRenderedLines = countPhysicalLines(lines, termColumns);
    };

    render(true);

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', handleKeypress);
      rl.close();
    };

    const findPrevFocusable = (from: number): number => {
      for (let i = from - 1; i >= 0; i--) {
        if (isFocusable(displayItems[i])) return i;
      }
      return from;
    };

    const findNextFocusable = (from: number): number => {
      for (let i = from + 1; i < displayItems.length; i++) {
        if (isFocusable(displayItems[i])) return i;
      }
      return from;
    };

    const findFirstFocusable = (): number => {
      const idx = displayItems.findIndex(item => isFocusable(item));
      return idx >= 0 ? idx : 0;
    };

    const findLastFocusable = (): number => {
      for (let i = displayItems.length - 1; i >= 0; i--) {
        if (isFocusable(displayItems[i])) return i;
      }
      return 0;
    };

    const jumpToLineNumber = (lineNum: number): number => {
      let count = 0;
      let firstIdx = -1;
      let lastIdx = -1;
      for (let i = 0; i < displayItems.length; i++) {
        if (displayItems[i].type === 'choice') {
          count++;
          if (firstIdx === -1) firstIdx = i;
          lastIdx = i;
          if (count === lineNum) return i;
        }
      }
      if (lineNum <= 0) return firstIdx >= 0 ? firstIdx : 0;
      return lastIdx >= 0 ? lastIdx : 0;
    };

    const ensureCursorVisible = () => {
      if (cursor < scrollOffset) {
        scrollOffset = cursor;
      } else if (cursor >= scrollOffset + pageSize) {
        scrollOffset = cursor - pageSize + 1;
      }
    };

    const resetViState = () => {
      numberBuffer = '';
      lastKeyWasG = false;
    };

    const rebuildDisplay = () => {
      const result = buildDisplayItems(choices, isFiltered ? searchQuery : '');
      displayItems = result.displayItems;
      filteredIndices = result.filteredIndices;
      cursor = displayItems.findIndex((item) => isFocusable(item));
      if (cursor === -1) cursor = 0;
      scrollOffset = 0;
    };

    const updateSearch = (newQuery: string) => {
      searchQuery = newQuery;
      isFiltered = true;
      rebuildDisplay();
    };

    const handleKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\nCancelled.');
        process.exit(0);
      }

      if (key.name === 'return') {
        if (isSearchMode) {
          isSearchMode = false;
          render();
          return;
        }

        cleanup();
        process.stdout.write(`\x1b[${lastRenderedLines}A\x1b[J`);

        const selectedNames = Array.from(selected)
          .sort((a, b) => a - b)
          .map((i) => choices[i].name);

        if (selectedNames.length === 0) {
          console.log(`? ${message} \x1b[2mNone selected\x1b[0m`);
        } else if (selectedNames.length <= 3) {
          console.log(
            `? ${message} \x1b[36m${selectedNames.join(', ')}\x1b[0m`
          );
        } else {
          console.log(
            `? ${message} \x1b[36m${selectedNames.length} skills selected\x1b[0m`
          );
        }

        resolve(
          Array.from(selected)
            .sort((a, b) => a - b)
            .map((i) => choices[i].value)
        );
        return;
      }

      if (key.name === 'space') {
        resetViState();
        const item = displayItems[cursor];
        if (item && item.type === 'group-header') {
          const unlocked = item.childIndices!.filter((idx) => !choices[idx].locked);
          if (unlocked.length === 0) { render(); return; }
          const state = getGroupState(unlocked, selected);
          if (state === 'all') {
            unlocked.forEach((idx) => selected.delete(idx));
          } else {
            unlocked.forEach((idx) => selected.add(idx));
          }
          onToggle?.(selected, choices);
          render();
        } else if (item && item.type === 'choice') {
          const choiceIndex = item.choiceIndex!;
          if (choices[choiceIndex].locked) { render(); return; }
          if (selected.has(choiceIndex)) {
            selected.delete(choiceIndex);
          } else {
            selected.add(choiceIndex);
          }
          onToggle?.(selected, choices);
          render();
        }
        return;
      }

      if (key.name === 'a' && key.ctrl) {
        resetViState();
        const indicesToToggle = (enableSearch && isFiltered
          ? filteredIndices
          : choices.map((_, i) => i)
        ).filter((i) => !choices[i].locked);

        const allSelected = indicesToToggle.every((i) => selected.has(i));
        if (allSelected) {
          indicesToToggle.forEach((i) => selected.delete(i));
        } else {
          indicesToToggle.forEach((i) => selected.add(i));
        }
        onToggle?.(selected, choices);
        render();
        return;
      }

      if (key.name === 'up') {
        resetViState();
        cursor = findPrevFocusable(cursor);
        if (cursor < scrollOffset) {
          scrollOffset = cursor;
        }
        render();
        return;
      }

      if (key.name === 'down') {
        resetViState();
        cursor = findNextFocusable(cursor);
        if (cursor >= scrollOffset + pageSize) {
          scrollOffset = cursor - pageSize + 1;
        }
        render();
        return;
      }

      if (str === '/') {
        if (enableSearch) {
          resetViState();
          isSearchMode = !isSearchMode;
          render();
        }
        return;
      }

      if (key.name === 'escape') {
        if (isSearchMode) {
          isSearchMode = false;
          isFiltered = false;
          rebuildDisplay();
          render();
        }
        return;
      }

      if (key.name === 'backspace') {
        if (isSearchMode) {
          if (searchQuery.length > 0) {
            updateSearch(searchQuery.slice(0, -1));
          } else {
            isSearchMode = false;
            isFiltered = false;
            rebuildDisplay();
          }
          render();
        }
        return;
      }

      if (isSearchMode && str && str.length === 1 && !key.ctrl && !key.meta && key.name !== 'space') {
        if (/^[a-zA-Z0-9\-_.]$/.test(str)) {
          updateSearch(searchQuery + str);
          render();
        }
        return;
      }

      if (!isSearchMode) {
        if (str === 'q') {
          cleanup();
          console.log('\nCancelled.');
          process.exit(0);
        }

        if (str === 'G') {
          if (numberBuffer.length > 0) {
            const targetLine = Number.parseInt(numberBuffer, 10);
            cursor = jumpToLineNumber(targetLine);
          } else {
            cursor = findLastFocusable();
          }
          resetViState();
          ensureCursorVisible();
          render();
          return;
        }

        if (str === 'g') {
          if (lastKeyWasG) {
            cursor = findFirstFocusable();
            resetViState();
            ensureCursorVisible();
            render();
          } else {
            lastKeyWasG = true;
          }
          return;
        }

        if (str && /^[0-9]$/.test(str)) {
          numberBuffer += str;
          lastKeyWasG = false;
          return;
        }

        resetViState();

        if (str === 'j') {
          cursor = findNextFocusable(cursor);
          if (cursor >= scrollOffset + pageSize) {
            scrollOffset = cursor - pageSize + 1;
          }
          render();
          return;
        }
        if (str === 'k') {
          cursor = findPrevFocusable(cursor);
          if (cursor < scrollOffset) {
            scrollOffset = cursor;
          }
          render();
          return;
        }
      }

      return;
    };

    process.stdin.on('keypress', handleKeypress);
  });
}
