export function formatReinstallConflictMessage(
  kind: 'Skill' | 'A local-batch group',
  name: string,
  existingPath: string,
  newPath: string,
): string {
  return (
    `${kind} '${name}' is already installed from ${existingPath}. ` +
    `To move it to ${newPath}, run: skillsmgr update ${newPath}`
  );
}

export function formatBatchConflictList(
  dirName: string,
  candidates: Array<{ name: string; url: string }>,
): string {
  const lines = candidates
    .map((candidate) => `  - ${candidate.name}: ${candidate.url}`)
    .join('\n');
  return (
    `Multiple local-batch groups named '${dirName}' are already installed:\n${lines}\n` +
    'Clean up the duplicate group entries and try again.'
  );
}
