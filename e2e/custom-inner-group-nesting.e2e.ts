import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

function stripAnsi(output: string): string {
  return output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

describe('custom inner-group nesting E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  const fixturePath = join(import.meta.dirname, 'fixtures', 'custom-inner-group-nesting.ts');
  const command = `tsx "${fixturePath}"`;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function startFixture(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(command, env.projectDir);
    await tmux.waitForText(/Select skills/, 10_000);
    await tmux.waitForText(/develop/, 10_000);
  }

  async function captureOutput(): Promise<string> {
    return stripAnsi(await tmux.capturePane());
  }

  // Core regression test: custom/openspec skills MUST generate innerGroup
  // headers inside a different-named virtual group (develop).
  //
  // Bug: getSourceInnerGroup() excluded all "custom" sources, so
  //      custom/openspec skills appeared flat under develop — no "openspec"
  //      inner-group-header.
  //
  // With the fix, the display should contain TWO "openspec (2)" headers:
  //   1. Inner-group-header inside develop group
  //   2. Top-level group-header for the openspec group
  // Without the fix, only ONE exists (the top-level openspec group).
  it('custom/openspec skills in develop group generate openspec inner-group-header', async () => {
    await startFixture();

    const output = await captureOutput();
    const lines = output.split('\n');

    // Count occurrences of "openspec (2)" — this is the discriminator.
    // Bug present (no innerGroup for custom): 1 (only top-level openspec group)
    // Fix applied with same-name skip:        2 (develop inner + top-level openspec)
    // Fix applied without same-name skip:     3 (develop inner + top-level + redundant inner)
    const openspecHeaderCount = lines.filter(l => l.includes('openspec (2)')).length;
    expect(openspecHeaderCount).toBeGreaterThanOrEqual(2);

    // Also verify community inner-group-header exists in develop
    const mattIdx = lines.findIndex(l => l.includes('mattpocock/skills (2)'));
    expect(mattIdx).toBeGreaterThan(-1);

    await tmux.pressKey('q');
  });

  // Verify same-name skip: openspec group itself should NOT have a
  // redundant "openspec" inner-group-header (since subGroup === innerGroup).
  it('openspec group does not show redundant openspec inner-group-header', async () => {
    await startFixture();

    const output = await captureOutput();
    const lines = output.split('\n');

    // Exactly 2 "openspec (2)" headers:
    //   1. Inner-group in develop
    //   2. Top-level openspec group
    // A 3rd would mean the same-name skip is missing.
    const openspecHeaderCount = lines.filter(l => l.includes('openspec (2)')).length;
    expect(openspecHeaderCount).toBe(2);

    // Find the top-level openspec group header (it has less indentation).
    // After it, os-apply should appear without another "openspec" header
    // between them.
    const allOpenspecLines = lines
      .map((l, i) => ({ line: l, idx: i }))
      .filter(({ line }) => line.includes('openspec (2)'));

    // The last "openspec (2)" is the top-level group header
    const topGroupLine = allOpenspecLines[allOpenspecLines.length - 1];
    const afterTopGroup = lines.slice(topGroupLine.idx + 1);
    const osApplyIdx = afterTopGroup.findIndex(l => l.includes('os-apply'));
    expect(osApplyIdx).toBeGreaterThan(-1);

    // No "openspec" header between the top-level group and os-apply
    const linesBetween = afterTopGroup.slice(0, osApplyIdx);
    const extraHeaders = linesBetween.filter(l => l.includes('openspec'));
    expect(extraHeaders).toHaveLength(0);

    await tmux.pressKey('q');
  });

  // Flat custom source (just "custom", no sub-path) should not nest.
  it('flat custom skill has no inner-group nesting', async () => {
    await startFixture();

    const output = await captureOutput();
    const lines = output.split('\n');

    // my-linter should appear in the display
    const myLinterLine = lines.find(l => l.includes('my-linter'));
    expect(myLinterLine).toBeDefined();

    // There should be no inner-group-header with just "custom" as label
    // (pattern: "custom (N)" as a header, excluding separators "── custom ──")
    const customInnerGroupHeader = lines.find(
      l => /\bcustom\b.*\(\d+\)/.test(l) && !l.includes('──'),
    );
    expect(customInnerGroupHeader).toBeUndefined();

    await tmux.pressKey('q');
  });
});
