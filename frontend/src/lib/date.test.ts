import { describe, expect, it } from 'vitest';
import { localDateTimeValue } from './date';

describe('localDateTimeValue', () => {
  it('preserves local wall-clock fields for datetime-local inputs', () => {
    const date = new Date(2026, 0, 2, 3, 4, 0);
    expect(localDateTimeValue(date)).toBe('2026-01-02T03:04');
  });
});
