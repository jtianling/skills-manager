import * as readline from 'readline';

export interface SelectChoice {
  name: string;
  description?: string;
  value: string;
  checked?: boolean;
}

interface SelectOptions {
  message: string;
  choices: SelectChoice[];
  pageSize?: number;
}

/**
 * Custom interactive checkbox that shows description only for highlighted item
 */
export async function interactiveCheckbox(
  options: SelectOptions
): Promise<string[]> {
  const { message, choices, pageSize = 15 } = options;
  const selected = new Set<number>(
    choices
      .map((c, i) => (c.checked ? i : -1))
      .filter((i) => i >= 0)
  );
  let cursor = 0;
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
      const visibleEnd = Math.min(scrollOffset + pageSize, choices.length);

      // Show scroll indicator if needed
      if (scrollOffset > 0) {
        lines.push('  \x1b[2m↑ more above\x1b[0m');
      }

      // Print choices
      for (let i = visibleStart; i < visibleEnd; i++) {
        const choice = choices[i];
        const isSelected = selected.has(i);
        const isCursor = i === cursor;

        const checkbox = isSelected ? '\x1b[32m◉\x1b[0m' : '◯';
        const prefix = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
        const highlight = isCursor ? '\x1b[36m' : '';
        const reset = '\x1b[0m';

        lines.push(`${prefix} ${checkbox} ${highlight}${choice.name}${reset}`);

        // Show description only for current item
        if (isCursor && choice.description) {
          const maxWidth = process.stdout.columns ? process.stdout.columns - 6 : 74;
          const desc =
            choice.description.length > maxWidth
              ? choice.description.substring(0, maxWidth - 3) + '...'
              : choice.description;
          lines.push(`    \x1b[2m${desc}\x1b[0m`);
        }
      }

      // Show scroll indicator if needed
      if (visibleEnd < choices.length) {
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

    const handleKeypress = (_str: string | undefined, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'up' || (key.name === 'k' && !key.ctrl)) {
        cursor = Math.max(0, cursor - 1);
        // Adjust scroll if cursor goes above visible area
        if (cursor < scrollOffset) {
          scrollOffset = cursor;
        }
        render();
      } else if (key.name === 'down' || (key.name === 'j' && !key.ctrl)) {
        cursor = Math.min(choices.length - 1, cursor + 1);
        // Adjust scroll if cursor goes below visible area
        if (cursor >= scrollOffset + pageSize) {
          scrollOffset = cursor - pageSize + 1;
        }
        render();
      } else if (key.name === 'space') {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
        render();
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
