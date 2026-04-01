import * as readline from 'readline';
import { Writable } from 'stream';
import {
  countFocusableItems,
  countPhysicalLines,
  renderChoiceLines,
  renderHeaderLine,
  renderInstructionLine,
  renderSearchLine,
  renderSeparatorLine,
} from './interactive-select-render.js';
import {
  buildDisplayItems,
  getDisplayIndexForLineNumber,
  getGroupState,
  getInnerGroupKey,
  isFocusable,
  isHeaderItem,
} from './interactive-select-utils.js';
import type {
  DisplayItem,
  SelectChoice,
} from './interactive-select-utils.js';

export {
  buildDisplayItems,
  getDisplayIndexForLineNumber,
  getGroupState,
  getInnerGroupKey,
  isFocusable,
  isHeaderItem,
};

export type {
  DisplayItem,
  GroupState,
  SelectChoice,
} from './interactive-select-utils.js';

interface SelectOptions {
  message: string;
  choices: SelectChoice[];
  pageSize?: number;
  searchThreshold?: number;
  onToggle?: (selected: Set<number>, choices: SelectChoice[]) => void;
}

interface CursorTarget {
  choiceIndex?: number;
  subGroupName?: string;
  innerGroupName?: string;
  parentSubGroup?: string;
  displayIndex: number;
}

export async function interactiveCheckbox(
  options: SelectOptions
): Promise<string[]> {
  const { message, choices, pageSize = 15, searchThreshold = 20, onToggle } = options;
  const enableSearch = choices.length > searchThreshold;

  const selected = new Set<number>(
    choices
      .map((choice, index) => (choice.checked ? index : -1))
      .filter((index) => index >= 0)
  );

  const allSubGroups = Array.from(
    new Set(choices.flatMap((choice) => (
      choice.subGroup === undefined ? [] : [choice.subGroup]
    )))
  );
  const allInnerGroups = Array.from(
    new Set(
      choices.flatMap((choice) => (
        choice.subGroup !== undefined && choice.innerGroup !== undefined
          ? [getInnerGroupKey(choice.subGroup, choice.innerGroup)]
          : []
      ))
    )
  );

  const valueToIndices = new Map<string, number[]>();
  for (let i = 0; i < choices.length; i++) {
    const indices = valueToIndices.get(choices[i].value) ?? [];
    valueToIndices.set(choices[i].value, [...indices, i]);
  }

  let searchQuery = '';
  let isSearchMode = false;
  let isFiltered = false;
  let collapsed = new Set<string>();
  let innerCollapsed = new Set<string>();
  let { displayItems, filteredIndices } = buildDisplayItems(choices, '');

  let cursor = displayItems.findIndex((item) => isFocusable(item));
  if (cursor === -1) cursor = 0;

  let scrollOffset = 0;
  let lastRenderedLines = 0;
  let numberBuffer = '';
  let lastKeyWasG = false;

  return new Promise((resolve) => {
    const nullOutput = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
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

      const lines: string[] = [`? ${message}`];
      const searchLine = renderSearchLine(
        enableSearch,
        isSearchMode,
        searchQuery,
        filteredIndices.length,
        choices.length,
      );
      if (searchLine) {
        lines.push(searchLine);
      }

      const totalFocusable = countFocusableItems(displayItems);
      const lineNumberWidth = totalFocusable > 0 ? String(totalFocusable).length : 1;
      const visibleStart = scrollOffset;
      const visibleEnd = Math.min(scrollOffset + pageSize, displayItems.length);
      const columns = process.stdout.columns || 80;

      if (scrollOffset > 0) {
        lines.push('  \x1b[2m↑ more above\x1b[0m');
      }

      if (displayItems.length === 0) {
        lines.push('  \x1b[2mNo matching skills found\x1b[0m');
      }

      let focusableCount = 0;
      for (let i = 0; i < displayItems.length; i++) {
        const item = displayItems[i];
        if (isFocusable(item)) {
          focusableCount++;
        }
        if (i < visibleStart) {
          continue;
        }
        if (i >= visibleEnd) {
          break;
        }

        if (!isFocusable(item)) {
          lines.push(renderSeparatorLine(item, lineNumberWidth));
          continue;
        }

        const lineNum = String(focusableCount).padStart(lineNumberWidth, ' ');
        if (isHeaderItem(item)) {
          lines.push(renderHeaderLine({
            item,
            lineNum,
            index: i,
            cursor,
            selected,
            collapsed,
            innerCollapsed,
            isFiltered,
          }));
          continue;
        }

        lines.push(...renderChoiceLines({
          item: item as DisplayItem & { type: 'choice'; choiceIndex: number },
          lineNum,
          index: i,
          cursor,
          selected,
          choices,
          columns,
          lineNumberWidth,
        }));
      }

      if (visibleEnd < displayItems.length) {
        lines.push('  \x1b[2m↓ more below\x1b[0m');
      }

      lines.push(renderInstructionLine(enableSearch, isSearchMode));
      console.log(lines.join('\n'));
      lastRenderedLines = countPhysicalLines(lines, columns);
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
      const first = displayItems.findIndex((item) => isFocusable(item));
      return first >= 0 ? first : 0;
    };

    const findLastFocusable = (): number => {
      for (let i = displayItems.length - 1; i >= 0; i--) {
        if (isFocusable(displayItems[i])) return i;
      }
      return 0;
    };

    const jumpToLineNumber = (lineNum: number): number =>
      getDisplayIndexForLineNumber(displayItems, lineNum);

    const ensureCursorVisible = () => {
      if (cursor < scrollOffset) {
        scrollOffset = cursor;
        while (scrollOffset > 0 && !isFocusable(displayItems[scrollOffset - 1])) {
          scrollOffset--;
        }
        return;
      }
      if (cursor >= scrollOffset + pageSize) {
        scrollOffset = cursor - pageSize + 1;
      }
    };

    const resetViState = () => {
      numberBuffer = '';
      lastKeyWasG = false;
    };

    const syncLinked = (triggerIndex: number) => {
      const value = choices[triggerIndex].value;
      const indices = valueToIndices.get(value);
      if (!indices || indices.length <= 1) return;
      const isSelected = selected.has(triggerIndex);
      for (const idx of indices) {
        if (choices[idx].locked) continue;
        if (isSelected) selected.add(idx);
        else selected.delete(idx);
      }
    };

    const getCursorTarget = (): CursorTarget => {
      const item = displayItems[cursor];
      if (!item) return { displayIndex: cursor };
      if (item.type === 'choice') {
        const choice = choices[item.choiceIndex!];
        return {
          choiceIndex: item.choiceIndex,
          subGroupName: choice.subGroup,
          innerGroupName: choice.innerGroup,
          parentSubGroup: choice.subGroup,
          displayIndex: cursor,
        };
      }
      if (item.type === 'group-header') {
        return { subGroupName: item.subGroupName, displayIndex: cursor };
      }
      if (item.type === 'inner-group-header') {
        return {
          subGroupName: item.parentSubGroup,
          innerGroupName: item.innerGroupName,
          parentSubGroup: item.parentSubGroup,
          displayIndex: cursor,
        };
      }
      return { displayIndex: cursor };
    };

    const resolveCursor = (items: DisplayItem[], target?: CursorTarget): number => {
      if (items.length === 0) return 0;
      if (target?.choiceIndex !== undefined) {
        const choiceIndex = items.findIndex((item) => (
          item.type === 'choice' && item.choiceIndex === target.choiceIndex
        ));
        if (choiceIndex >= 0) return choiceIndex;
      }
      if (target?.innerGroupName !== undefined && target.parentSubGroup !== undefined) {
        const innerGroupIndex = items.findIndex((item) => (
          item.type === 'inner-group-header'
          && item.innerGroupName === target.innerGroupName
          && item.parentSubGroup === target.parentSubGroup
        ));
        if (innerGroupIndex >= 0) return innerGroupIndex;
      }
      if (target?.subGroupName !== undefined) {
        const groupIndex = items.findIndex((item) => (
          item.type === 'group-header' && item.subGroupName === target.subGroupName
        ));
        if (groupIndex >= 0) return groupIndex;
      }
      const preferred = Math.min(target?.displayIndex ?? 0, items.length - 1);
      if (isFocusable(items[preferred])) return preferred;
      for (let offset = 1; offset < items.length; offset++) {
        if (preferred - offset >= 0 && isFocusable(items[preferred - offset])) {
          return preferred - offset;
        }
        if (preferred + offset < items.length && isFocusable(items[preferred + offset])) {
          return preferred + offset;
        }
      }
      const firstFocusable = items.findIndex((item) => isFocusable(item));
      return firstFocusable >= 0 ? firstFocusable : 0;
    };

    const rebuildDisplay = (target?: CursorTarget) => {
      const result = buildDisplayItems(
        choices,
        isFiltered ? searchQuery : '',
        isFiltered ? new Set<string>() : collapsed,
        isFiltered ? new Set<string>() : innerCollapsed,
      );
      displayItems = result.displayItems;
      filteredIndices = result.filteredIndices;
      cursor = resolveCursor(displayItems, target);
      ensureCursorVisible();
    };

    const updateSearch = (newQuery: string) => {
      searchQuery = newQuery;
      isFiltered = true;
      rebuildDisplay(getCursorTarget());
    };

    const collapseCurrentGroup = (): boolean => {
      const item = displayItems[cursor];
      if (!isHeaderItem(item)) return false;
      const target = getCursorTarget();
      if (item.type === 'group-header') {
        if (!item.subGroupName || collapsed.has(item.subGroupName)) return false;
        collapsed = new Set([...collapsed, item.subGroupName]);
      } else {
        if (!item.parentSubGroup || !item.innerGroupName) return false;
        const key = getInnerGroupKey(item.parentSubGroup, item.innerGroupName);
        if (innerCollapsed.has(key)) return false;
        innerCollapsed = new Set([...innerCollapsed, key]);
      }
      rebuildDisplay(target);
      return true;
    };

    const expandCurrentGroup = (): boolean => {
      const item = displayItems[cursor];
      if (!isHeaderItem(item)) return false;
      const childCount = item.childIndices?.length ?? 0;
      const target = getCursorTarget();
      if (item.type === 'group-header') {
        if (!item.subGroupName || !collapsed.has(item.subGroupName)) return false;
        const next = new Set(collapsed);
        next.delete(item.subGroupName);
        collapsed = next;
      } else {
        if (!item.parentSubGroup || !item.innerGroupName) return false;
        const key = getInnerGroupKey(item.parentSubGroup, item.innerGroupName);
        if (!innerCollapsed.has(key)) return false;
        const next = new Set(innerCollapsed);
        next.delete(key);
        innerCollapsed = next;
      }
      rebuildDisplay(target);
      if (cursor + childCount >= scrollOffset + pageSize) {
        scrollOffset = Math.max(0, cursor - Math.floor(pageSize / 2));
      }
      return true;
    };

    const toggleAllGroups = (): boolean => {
      if (allSubGroups.length === 0 && allInnerGroups.length === 0) return false;
      const target = getCursorTarget();
      const hasExpanded = allSubGroups.some((subGroup) => !collapsed.has(subGroup))
        || allInnerGroups.some((key) => !innerCollapsed.has(key));
      collapsed = hasExpanded ? new Set(allSubGroups) : new Set<string>();
      innerCollapsed = hasExpanded ? new Set(allInnerGroups) : new Set<string>();
      rebuildDisplay(target);
      return true;
    };

    const finishSelection = () => {
      cleanup();
      process.stdout.write(`\x1b[${lastRenderedLines}A\x1b[J`);

      const selectedNames = Array.from(selected)
        .sort((a, b) => a - b)
        .map((index) => choices[index].name);

      if (selectedNames.length === 0) {
        console.log(`? ${message} \x1b[2mNone selected\x1b[0m`);
      } else if (selectedNames.length <= 3) {
        console.log(`? ${message} \x1b[36m${selectedNames.join(', ')}\x1b[0m`);
      } else {
        console.log(`? ${message} \x1b[36m${selectedNames.length} skills selected\x1b[0m`);
      }

      resolve(
        [...new Set(
          Array.from(selected)
            .sort((a, b) => a - b)
            .map((index) => choices[index].value)
        )]
      );
    };

    const cancelPrompt = () => {
      cleanup();
      console.log('\nCancelled.');
      process.exit(0);
    };

    const handleInterruptKey = (key: readline.Key): boolean => {
      if (key.name !== 'c' || !key.ctrl) {
        return false;
      }
      cancelPrompt();
      return true;
    };

    const handleToggleOrSelectKeys = (key: readline.Key): boolean => {
      if (key.name === 'return') {
        if (isSearchMode) {
          isSearchMode = false;
          render();
        } else {
          finishSelection();
        }
        return true;
      }

      if (key.name === 'space') {
        resetViState();
        const item = displayItems[cursor];
        if (isHeaderItem(item)) {
          const unlocked = item.childIndices!.filter((index) => !choices[index].locked);
          if (unlocked.length === 0) {
            render();
            return true;
          }
          const state = getGroupState(unlocked, selected);
          if (state === 'all') {
            unlocked.forEach((index) => selected.delete(index));
          } else {
            unlocked.forEach((index) => selected.add(index));
          }
          for (const index of unlocked) {
            syncLinked(index);
          }
          onToggle?.(selected, choices);
          render();
          return true;
        }
        if (item?.type === 'choice') {
          const choiceIndex = item.choiceIndex!;
          if (choices[choiceIndex].locked) {
            render();
            return true;
          }
          if (selected.has(choiceIndex)) {
            selected.delete(choiceIndex);
          } else {
            selected.add(choiceIndex);
          }
          syncLinked(choiceIndex);
          onToggle?.(selected, choices);
          render();
        }
        return true;
      }

      if (key.name === 'a' && key.ctrl) {
        resetViState();
        const indicesToToggle = (enableSearch && isFiltered
          ? filteredIndices
          : choices.map((_, index) => index)
        ).filter((index) => !choices[index].locked);

        const allSelected = indicesToToggle.every((index) => selected.has(index));
        if (allSelected) {
          indicesToToggle.forEach((index) => selected.delete(index));
        } else {
          indicesToToggle.forEach((index) => selected.add(index));
        }
        for (const index of indicesToToggle) {
          syncLinked(index);
        }
        onToggle?.(selected, choices);
        render();
        return true;
      }

      return false;
    };

    const handleNavigationKeys = (str: string | undefined, key: readline.Key): boolean => {
      if (key.name === 'up') {
        resetViState();
        cursor = findPrevFocusable(cursor);
        ensureCursorVisible();
        render();
        return true;
      }

      if (key.name === 'down') {
        resetViState();
        cursor = findNextFocusable(cursor);
        ensureCursorVisible();
        render();
        return true;
      }

      if (isSearchMode) {
        return false;
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
        return true;
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
        return true;
      }

      if (str && /^[0-9]$/.test(str)) {
        numberBuffer += str;
        lastKeyWasG = false;
        return true;
      }

      if (str === 'j') {
        resetViState();
        cursor = findNextFocusable(cursor);
        ensureCursorVisible();
        render();
        return true;
      }

      if (str === 'k') {
        resetViState();
        cursor = findPrevFocusable(cursor);
        ensureCursorVisible();
        render();
        return true;
      }

      return false;
    };

    const handleSearchKeys = (str: string | undefined, key: readline.Key): boolean => {
      if (str === '/') {
        if (enableSearch) {
          resetViState();
          isSearchMode = !isSearchMode;
          render();
        }
        return true;
      }

      if (key.name === 'escape') {
        if (isSearchMode) {
          isSearchMode = false;
          isFiltered = false;
          rebuildDisplay(getCursorTarget());
          render();
        }
        return true;
      }

      if (key.name === 'backspace') {
        if (isSearchMode) {
          if (searchQuery.length > 0) {
            updateSearch(searchQuery.slice(0, -1));
          } else {
            isSearchMode = false;
            isFiltered = false;
            rebuildDisplay(getCursorTarget());
          }
          render();
        }
        return true;
      }

      if (
        isSearchMode
        && str
        && str.length === 1
        && !key.ctrl
        && !key.meta
        && key.name !== 'space'
      ) {
        if (/^[a-zA-Z0-9\-_.]$/.test(str)) {
          updateSearch(searchQuery + str);
          render();
        }
        return true;
      }

      return false;
    };

    const handleFoldKeys = (str: string | undefined, key: readline.Key): boolean => {
      if (isSearchMode) {
        return false;
      }

      if (str === 'h' || key.name === 'left') {
        resetViState();
        if (collapseCurrentGroup()) {
          render();
        }
        return true;
      }

      if (str === 'l' || key.name === 'right') {
        resetViState();
        if (expandCurrentGroup()) {
          render();
        }
        return true;
      }

      if (str === 'c') {
        resetViState();
        if (toggleAllGroups()) {
          render();
        }
        return true;
      }

      return false;
    };

    const handleQuitKey = (str: string | undefined): boolean => {
      if (isSearchMode || str !== 'q') {
        return false;
      }
      cancelPrompt();
      return true;
    };

    const handleKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key) return;

      if (handleInterruptKey(key)) return;
      if (handleToggleOrSelectKeys(key)) return;
      if (handleSearchKeys(str, key)) return;
      if (handleFoldKeys(str, key)) return;
      if (handleQuitKey(str)) return;
      if (handleNavigationKeys(str, key)) return;

      if (!isSearchMode) {
        resetViState();
      }
    };

    process.stdin.on('keypress', handleKeypress);
  });
}
