import { describe, it, expect } from 'vitest';
import { computeSkillDigest } from './digest.js';

describe('computeSkillDigest', () => {
  it('produces a sha256 digest in the recorded format', () => {
    const digest = computeSkillDigest(new Map([['SKILL.md', Buffer.from('# hello')]]));

    expect(digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('is stable regardless of insertion order', () => {
    const forward = new Map([
      ['SKILL.md', Buffer.from('a')],
      ['references/b.md', Buffer.from('b')],
    ]);
    const reversed = new Map([
      ['references/b.md', Buffer.from('b')],
      ['SKILL.md', Buffer.from('a')],
    ]);

    expect(computeSkillDigest(forward)).toBe(computeSkillDigest(reversed));
  });

  it('changes when file content changes', () => {
    const before = computeSkillDigest(new Map([['SKILL.md', Buffer.from('a')]]));
    const after = computeSkillDigest(new Map([['SKILL.md', Buffer.from('b')]]));

    expect(after).not.toBe(before);
  });

  it('changes when a file path changes', () => {
    const before = computeSkillDigest(new Map([['SKILL.md', Buffer.from('a')]]));
    const after = computeSkillDigest(new Map([['OTHER.md', Buffer.from('a')]]));

    expect(after).not.toBe(before);
  });

  it('distinguishes files that would collide under naive concatenation', () => {
    const first = computeSkillDigest(
      new Map([
        ['a', Buffer.from('b')],
        ['c', Buffer.from('d')],
      ]),
    );
    const second = computeSkillDigest(new Map([['a', Buffer.from('bcd')]]));

    expect(first).not.toBe(second);
  });
});
