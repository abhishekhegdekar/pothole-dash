import { describe, expect, it } from 'vitest';
import { midiOf, parseBars } from '../src/audio/music';

describe('music notation', () => {
  it('reads note names', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
    expect(midiOf('C-1')).toBe(0);
  });

  it('turns bars into notes with lengths', () => {
    const notes = parseBars(['A4 - - F#4 . . G4 - - - . . . . . .', 'D5 - . . . . . . . . . . . . . -']);
    expect(notes).toEqual([
      { step: 0, midi: 69, len: 3 },
      { step: 3, midi: 66, len: 1 },
      { step: 6, midi: 67, len: 4 },
      { step: 16, midi: 74, len: 2 },
    ]);
  });

  it('rejects a bar with the wrong number of steps', () => {
    expect(() => parseBars(['A4 - -'])).toThrow();
  });
});
