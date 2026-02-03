/**
 * Simple progress indicator for CLI
 */
export class ProgressBar {
  private current = 0;
  private total: number;
  private label: string;
  private barWidth = 30;

  constructor(total: number, label: string = 'Progress') {
    this.total = total;
    this.label = label;
  }

  /**
   * Start the progress bar
   */
  start(): void {
    this.current = 0;
    this.render();
  }

  /**
   * Increment progress by 1
   */
  tick(): void {
    this.current++;
    this.render();
  }

  /**
   * Update to specific value
   */
  update(value: number): void {
    this.current = value;
    this.render();
  }

  /**
   * Complete the progress bar
   */
  complete(): void {
    this.current = this.total;
    this.render();
    console.log(''); // New line after completion
  }

  /**
   * Render the progress bar
   */
  private render(): void {
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    const filled = Math.round((this.current / this.total) * this.barWidth);
    const empty = this.barWidth - filled;

    const bar = '\x1b[32m' + '█'.repeat(filled) + '\x1b[0m' + '░'.repeat(empty);
    const status = `${this.current}/${this.total}`;

    // Clear line and write progress
    process.stdout.write(`\r\x1b[K${this.label} ${bar} ${percent}% (${status})`);
  }
}

/**
 * Simple spinner for indeterminate progress
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private current = 0;
  private interval: NodeJS.Timeout | null = null;
  private label: string;

  constructor(label: string = 'Loading') {
    this.label = label;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r\x1b[K\x1b[33m${this.frames[this.current]}\x1b[0m ${this.label}`);
      this.current = (this.current + 1) % this.frames.length;
    }, 80);
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (message) {
      process.stdout.write(`\r\x1b[K${message}\n`);
    } else {
      process.stdout.write('\r\x1b[K');
    }
  }
}
