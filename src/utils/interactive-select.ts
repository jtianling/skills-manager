import * as readline from 'readline';

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
  group?: string; // Optional group name for separators
  suffix?: string; // Optional suffix like "[deployed]"
}

interface SelectOptions {
  message: string;
  choices: SelectChoice[];
  pageSize?: number;
  searchThreshold?: number; // Enable search when choices exceed this number
}

interface DisplayItem {
  type: 'separator' | 'choice';
  text?: string; // For separators
  choiceIndex?: number; // Index in choices array for choice items
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
    // Filter by search query (case-insensitive, name only)
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
 * Custom interactive checkbox that shows description only for highlighted item
 * With optional search functionality for large lists
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
  let { displayItems, filteredIndices } = buildDisplayItems(choices, searchQuery);

  // Find first choice item for initial cursor
  let cursor = displayItems.findIndex((item) => item.type === 'choice');
  if (cursor === -1) cursor = 0;

  let scrollOffset = 0;
  let lastRenderedLines = 0;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Enable raw mode for keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    const render = (isInitial = false) => {
      // Clear previous output if not initial render
      if (!isInitial && lastRenderedLines > 0) {
        process.stdout.write(`\x1b[${lastRenderedLines}A\x1b[J`);
      }

      const lines: string[] = [];

      // Print message
      lines.push(`? ${message}`);

      // Show search input if enabled
      if (enableSearch) {
        const searchDisplay = searchQuery || '';
        lines.push(`  \x1b[33m🔍 Search:\x1b[0m ${searchDisplay}\x1b[2m│\x1b[0m \x1b[2m(${filteredIndices.length}/${choices.length} skills)\x1b[0m`);
      }

      // Calculate visible range
      const visibleStart = scrollOffset;
      const visibleEnd = Math.min(scrollOffset + pageSize, displayItems.length);

      // Show scroll indicator if needed
      if (scrollOffset > 0) {
        lines.push('  \x1b[2m↑ more above\x1b[0m');
      }

      // Show message if no results
      if (displayItems.length === 0) {
        lines.push('  \x1b[2mNo matching skills found\x1b[0m');
      }

      // Print items
      for (let i = visibleStart; i < visibleEnd; i++) {
        const item = displayItems[i];

        if (item.type === 'separator') {
          lines.push(`  \x1b[33m${item.text}\x1b[0m`);
        } else {
          const choice = choices[item.choiceIndex!];
          const isSelected = selected.has(item.choiceIndex!);
          const isCursor = i === cursor;

          const checkbox = isSelected ? '\x1b[32m◉\x1b[0m' : '◯';
          const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
          const highlight = isCursor ? '\x1b[36m' : '';
          const reset = '\x1b[0m';
          const suffix = choice.suffix ? ` \x1b[33m${choice.suffix}\x1b[0m` : '';

          lines.push(
            `${prefix} ${checkbox} ${highlight}${choice.name}${reset}${suffix}`
          );

          // Show description only for current item (multi-line wrapped)
          if (isCursor && choice.description) {
            const maxWidth = process.stdout.columns
              ? process.stdout.columns - 6
              : 74;
            const descLines = wrapText(choice.description, maxWidth);
            for (const descLine of descLines) {
              lines.push(`    \x1b[2m${descLine}\x1b[0m`);
            }
          }
        }
      }

      // Show scroll indicator if needed
      if (visibleEnd < displayItems.length) {
        lines.push('  \x1b[2m↓ more below\x1b[0m');
      }

      // Show instructions
      if (enableSearch) {
        lines.push(
          '\x1b[2m(Type to search, ↑↓ move, space select, ctrl+a toggle filtered, enter confirm)\x1b[0m'
        );
      } else {
        lines.push(
          '\x1b[2m(↑↓ move, space select, ctrl+a toggle all, enter confirm)\x1b[0m'
        );
      }

      // Output all lines
      console.log(lines.join('\n'));
      lastRenderedLines = lines.length;
    };

    // Initial render
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
      return from; // Stay at current if no previous choice
    };

    const findNextChoice = (from: number): number => {
      for (let i = from + 1; i < displayItems.length; i++) {
        if (displayItems[i].type === 'choice') return i;
      }
      return from; // Stay at current if no next choice
    };

    const updateSearch = (newQuery: string) => {
      searchQuery = newQuery;
      const result = buildDisplayItems(choices, searchQuery);
      displayItems = result.displayItems;
      filteredIndices = result.filteredIndices;

      // Reset cursor to first choice
      cursor = displayItems.findIndex((item) => item.type === 'choice');
      if (cursor === -1) cursor = 0;
      scrollOffset = 0;
    };

    const handleKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key) return;

      // When search is enabled, prioritize typing over shortcuts
      // Check for typeable characters first (but not control sequences)
      if (enableSearch && str && str.length === 1 && !key.ctrl && !key.meta) {
        if (/^[a-zA-Z0-9\-_. ]$/.test(str)) {
          updateSearch(searchQuery + str);
          render();
          return;
        }
      }

      // Navigation: arrow keys only
      if (key.name === 'up') {
        cursor = findPrevChoice(cursor);
        // Adjust scroll if cursor goes above visible area
        if (cursor < scrollOffset) {
          scrollOffset = cursor;
        }
        render();
      } else if (key.name === 'down') {
        cursor = findNextChoice(cursor);
        // Adjust scroll if cursor goes below visible area
        if (cursor >= scrollOffset + pageSize) {
          scrollOffset = cursor - pageSize + 1;
        }
        render();
      } else if (key.name === 'space') {
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
      } else if (key.name === 'a' && key.ctrl) {
        // Ctrl+A: Toggle all (or filtered items if search is active)
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
      } else if (key.name === 'return') {
        cleanup();

        // Clear the UI
        process.stdout.write(`\x1b[${lastRenderedLines}A\x1b[J`);

        // Show result
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
      } else if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\nCancelled.');
        process.exit(0);
      } else if (key.name === 'backspace') {
        // Handle backspace for search
        if (enableSearch && searchQuery.length > 0) {
          updateSearch(searchQuery.slice(0, -1));
          render();
        }
      }
    };

    process.stdin.on('keypress', handleKeypress);
  });
}
