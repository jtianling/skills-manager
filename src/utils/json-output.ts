export function jsonOutput(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + '\n');
}

export function jsonError(message: string, code: string): void {
  jsonOutput({ error: message, code });
}
