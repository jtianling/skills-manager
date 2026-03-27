import { describe, it, expect } from 'vitest';
import { collect } from './types.js';

describe('collect', () => {
  it('accumulates values into array', () => {
    let result: string[] = [];
    result = collect('a', result);
    result = collect('b', result);
    result = collect('c', result);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('returns new array without mutating input', () => {
    const initial: string[] = ['a'];
    const result = collect('b', initial);
    expect(result).toEqual(['a', 'b']);
    expect(initial).toEqual(['a']);
  });

  it('works with empty initial array', () => {
    const result = collect('first', []);
    expect(result).toEqual(['first']);
  });
});
