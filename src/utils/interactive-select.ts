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
}

interface DisplayItem {
  type: 'separator' | 'choice';
  text?: string; // For separators
  choiceIndex?: number; // Index in choices array for choice items
}

/**
 * Custom interactive checkbox that shows description only for highlighted item
 */
export async function interactiveCheckbox(
  options: SelectOptions
): Promise<string[]> {
  const { message, choices, pageSize = 15 } = options;

  // Build display items with group separators
  const displayItems: DisplayItem[] = [];
  let currentGroup: string | undefined;

  choices.forEach((choice, index) => {
    if (choice.group && choice.group !== currentGroup) {
      currentGroup = choice.group;
      displayItems.push({ type: 'separator', text: `── ${choice.group} ──` });
    }
    displayItems.push({ type: 'choice', choiceIndex: index });
  });

  const selected = new Set<number>(
    choices
      .map((c, i) => (c.checked ? i : -1))
      .filter((i) => i >= 0)
  );

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

      // Calculate visible range
      const visibleStart = scrollOffset;
      const visibleEnd = Math.min(scrollOffset + pageSize, displayItems.length);

      // Show scroll indicator if needed
      if (scrollOffset > 0) {
        lines.push('  \x1b[2m↑ more above\x1b[0m');
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
      lines.push(
        '\x1b[2m(↑↓ move, space select, a toggle all, enter confirm)\x1b[0m'
      );

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

    const handleKeypress = (_str: string | undefined, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'up' || (key.name === 'k' && !key.ctrl)) {
        cursor = findPrevChoice(cursor);
        // Adjust scroll if cursor goes above visible area
        if (cursor < scrollOffset) {
          scrollOffset = cursor;
        }
        render();
      } else if (key.name === 'down' || (key.name === 'j' && !key.ctrl)) {
        cursor = findNextChoice(cursor);
        // Adjust scroll if cursor goes below visible area
        if (cursor >= scrollOffset + pageSize) {
          scrollOffset = cursor - pageSize + 1;
        }
        render();
      } else if (key.name === 'space') {
        const item = displayItems[cursor];
        if (item.type === 'choice') {
          const choiceIndex = item.choiceIndex!;
          if (selected.has(choiceIndex)) {
            selected.delete(choiceIndex);
          } else {
            selected.add(choiceIndex);
          }
          render();
        }
      } else if (key.name === 'a' && !key.ctrl) {
        // Toggle all
        if (selected.size === choices.length) {
          selected.clear();
        } else {
          for (let i = 0; i < choices.length; i++) {
            selected.add(i);
          }
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
      }
    };

    process.stdin.on('keypress', handleKeypress);
  });
}
