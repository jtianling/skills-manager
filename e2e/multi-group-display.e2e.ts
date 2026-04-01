import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

function stripAnsi(output: string): string {
  return output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

describe('multi-group display E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  const fixturePath = join(import.meta.dirname, 'fixtures', 'multi-group-linkage.ts');
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
    await tmux.waitForText(/group-a \(2\)/, 10_000);
  }

  async function captureOutput(): Promise<string> {
    return stripAnsi(await tmux.capturePane());
  }

  it('toggling a skill selects all copies with same value', async () => {
    await startFixture();

    // Cursor starts on group-a header. Move down to first skill-x.
    await tmux.pressKey('j');
    // Toggle skill-x in group-a
    await tmux.pressSpace();

    const output = await captureOutput();

    // Both skill-x copies should be selected (◉)
    // Count selected indicators for skill-x lines
    const lines = output.split('\n');
    const skillXLines = lines.filter(l => l.includes('skill-x'));
    const selectedSkillX = skillXLines.filter(l => l.includes('◉'));
    expect(selectedSkillX).toHaveLength(2);

    // unique-a and unique-b should remain unselected
    const uniqueALine = lines.find(l => l.includes('unique-a'));
    expect(uniqueALine).toContain('◯');
    const uniqueBLine = lines.find(l => l.includes('unique-b'));
    expect(uniqueBLine).toContain('◯');

    // group-a and group-b headers should show partial (◐)
    const groupAHeader = lines.find(l => l.includes('group-a (2)'));
    expect(groupAHeader).toContain('◐');
    const groupBHeader = lines.find(l => l.includes('group-b (2)'));
    expect(groupBHeader).toContain('◐');

    await tmux.pressEnter();
    const result = await tmux.waitForText(/RESULT:/, 5_000);
    expect(result).toContain('RESULT:["custom/skill-x"]');
  });

  it('group-header toggle links to copies in other groups', async () => {
    await startFixture();

    // Cursor starts on group-a header. Toggle it to select all children.
    await tmux.pressSpace();

    const output = await captureOutput();

    // group-a children: skill-x and unique-a both selected
    // group-b: skill-x should also be linked (selected), unique-b not
    const lines = output.split('\n');
    const skillXLines = lines.filter(l => l.includes('skill-x'));
    const selectedSkillX = skillXLines.filter(l => l.includes('◉'));
    expect(selectedSkillX).toHaveLength(2);

    const uniqueALine = lines.find(l => l.includes('unique-a'));
    expect(uniqueALine).toContain('◉');

    const uniqueBLine = lines.find(l => l.includes('unique-b'));
    expect(uniqueBLine).toContain('◯');

    // group-a: all selected, group-b: partial (only skill-x)
    const groupAHeader = lines.find(l => l.includes('group-a (2)'));
    expect(groupAHeader).toContain('◉');
    const groupBHeader = lines.find(l => l.includes('group-b (2)'));
    expect(groupBHeader).toContain('◐');

    await tmux.pressEnter();
    const result = await tmux.waitForText(/RESULT:/, 5_000);
    expect(result).toContain('RESULT:["custom/skill-x","custom/unique-a"]');
  });

  it('deselecting one copy deselects all linked copies', async () => {
    await startFixture();

    // Select skill-x via group-a
    await tmux.pressKey('j');
    await tmux.pressSpace();

    // Navigate to skill-x in group-b and deselect
    await tmux.pressKey('j'); // unique-a
    await tmux.pressKey('j'); // group-b header
    await tmux.pressKey('j'); // skill-x in group-b
    await tmux.pressSpace(); // deselect

    const output = await captureOutput();

    // Both skill-x should now be unselected
    const lines = output.split('\n');
    const skillXLines = lines.filter(l => l.includes('skill-x'));
    const unselectedSkillX = skillXLines.filter(l => l.includes('◯'));
    expect(unselectedSkillX).toHaveLength(2);

    await tmux.pressEnter();
    const result = await tmux.waitForText(/RESULT:/, 5_000);
    expect(result).toContain('RESULT:[]');
  });
});
