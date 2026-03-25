import * as readline from 'readline';
import { Writable } from 'stream';

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
  group?: string;
  suffix?: string;
}

interface SelectOptions {
  message: string;
  choices: SelectChoice[];
  pageSize?: number;
  searchThreshold?: number;
}

interface DisplayItem {
  type: 'separator' | 'choice';
  text?: string;
  choiceIndex?: number;
}

/**
 * Build display items from choices, optionally filtered by search query
 */
function buildDisplayItems(
  choices: SelectChoice[],
  searchQuery: string
): { displayItems: DisplayItem[]; filteredIndices: number[] } {
  const displayItems: DisplayItem[] = [];
  const filteredIndices: number[] = [];
  let currentGroup: string | undefined;

  choices.forEach((choice, index) => {
    if (searchQuery && !choice.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return;
    }

    filteredIndices.push(index);

    if (choice.group && choice.group !== currentGroup) {
      currentGroup = choice.group;
      displayItems.push({ type: 'separator', text: `── ${choice.group} ──` });
    }
    displayItems.push({ type: 'choice', choiceIndex: index });
  });

  return { displayItems, filteredIndices };
}

/**
 * Custom interactive checkbox with vi-style navigation
 */
export async function interactiveCheckbox(
  options: SelectOptions
): Promise<string[]> {
  const { message, choices, pageSize = 15, searchThreshold = 20 } = options;
  const enableSearch = choices.length > searchThreshold;

  const selected = new Set<number>(
    choices
      .map((c, i) => (c.checked ? i : -1))
      .filter((i) => i >= 0)
  );

  let searchQuery = '';
  let isSearchMode = false;
  let { displayItems, filteredIndices } = buildDisplayItems(choices, searchQuery);

  let cursor = displayItems.findIndex((item) => item.type === 'choice');
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
          } else {
            const choice = choices[item.choiceIndex!];
            const isSelected = selected.has(item.choiceIndex!);
            const isCursor = i === cursor;

            const lineNum = String(choiceCount).padStart(lineNumberWidth, ' ');
            const checkbox = isSelected ? '\x1b[32m◉\x1b[0m' : '◯';
            const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
            const highlight = isCursor ? '\x1b[36m' : '';
            const reset = '\x1b[0m';
            const suffix = choice.suffix ? ` \x1b[33m${choice.suffix}\x1b[0m` : '';

            lines.push(
              `${lineNum} ${prefix} ${checkbox} ${highlight}${choice.name}${reset}${suffix}`
            );

            if (isCursor && choice.description) {
              const descIndent = lineNumberWidth + 5;
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
          '\x1b[2m(↑↓ move, esc exit search, space select, ctrl+a toggle filtered, enter confirm)\x1b[0m'
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
      lastRenderedLines = lines.length;
    };

    render(true);

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', handleKeypress);
      rl.close();
    };

    const findPrevChoice = (from: number): number => {
      for (let i = from - 1; i >= 0; i--) {
        if (displayItems[i].type === 'choice') return i;
      }
      return from;
    };

    const findNextChoice = (from: number): number => {
      for (let i = from + 1; i < displayItems.length; i++) {
        if (displayItems[i].type === 'choice') return i;
      }
      return from;
    };

    const findFirstChoice = (): number => {
      const idx = displayItems.findIndex(item => item.type === 'choice');
      return idx >= 0 ? idx : 0;
    };

    const findLastChoice = (): number => {
      for (let i = displayItems.length - 1; i >= 0; i--) {
        if (displayItems[i].type === 'choice') return i;
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

    const updateSearch = (newQuery: string) => {
      searchQuery = newQuery;
      const result = buildDisplayItems(choices, searchQuery);
      displayItems = result.displayItems;
      filteredIndices = result.filteredIndices;

      cursor = displayItems.findIndex((item) => item.type === 'choice');
      if (cursor === -1) cursor = 0;
      scrollOffset = 0;
    };

    const handleKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\nCancelled.');
        process.exit(0);
      }

      if (key.name === 'return') {
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
        if (item && item.type === 'choice') {
          const choiceIndex = item.choiceIndex!;
          if (selected.has(choiceIndex)) {
            selected.delete(choiceIndex);
          } else {
            selected.add(choiceIndex);
          }
          render();
        }
        return;
      }

      if (key.name === 'a' && key.ctrl) {
        resetViState();
        const indicesToToggle = enableSearch && searchQuery
          ? filteredIndices
          : choices.map((_, i) => i);

        const allSelected = indicesToToggle.every((i) => selected.has(i));
        if (allSelected) {
          indicesToToggle.forEach((i) => selected.delete(i));
        } else {
          indicesToToggle.forEach((i) => selected.add(i));
        }
        render();
        return;
      }

      if (key.name === 'up') {
        resetViState();
        cursor = findPrevChoice(cursor);
        if (cursor < scrollOffset) {
          scrollOffset = cursor;
        }
        render();
        return;
      }

      if (key.name === 'down') {
        resetViState();
        cursor = findNextChoice(cursor);
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
            cursor = findLastChoice();
          }
          resetViState();
          ensureCursorVisible();
          render();
          return;
        }

        if (str === 'g') {
          if (lastKeyWasG) {
            cursor = findFirstChoice();
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
          cursor = findNextChoice(cursor);
          if (cursor >= scrollOffset + pageSize) {
            scrollOffset = cursor - pageSize + 1;
          }
          render();
          return;
        }
        if (str === 'k') {
          cursor = findPrevChoice(cursor);
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
