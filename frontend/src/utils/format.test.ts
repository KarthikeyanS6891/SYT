import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatPrice, timeAgo, truncate, initials } from './format';

describe('formatPrice', () => {
  it('formats INR with the rupee symbol and no decimals', () => {
    const out = formatPrice(22000);
    expect(out).toMatch(/₹/);
    expect(out).toMatch(/22,000/);
    expect(out).not.toMatch(/\.00/);
  });

  it('honours a different currency code', () => {
    expect(formatPrice(1000, 'USD')).toMatch(/\$|US/);
  });

  it('falls back to "<currency> <price>" for an invalid currency', () => {
    expect(formatPrice(500, 'NOTACODE')).toBe('NOTACODE 500');
  });
});

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string, agoMs: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso).getTime() + agoMs);
    return new Date(iso);
  };

  it('returns "just now" for < 1 minute', () => {
    const d = at('2024-06-01T00:00:00Z', 30 * 1000);
    expect(timeAgo(d)).toBe('just now');
  });

  it('returns minutes, hours, days, months, years', () => {
    const base = '2024-06-01T00:00:00Z';
    expect(timeAgo(at(base, 5 * 60 * 1000))).toBe('5m ago');
    expect(timeAgo(at(base, 3 * 3600 * 1000))).toBe('3h ago');
    expect(timeAgo(at(base, 4 * 86400 * 1000))).toBe('4d ago');
    expect(timeAgo(at(base, 60 * 86400 * 1000))).toBe('2mo ago');
    expect(timeAgo(at(base, 400 * 86400 * 1000))).toBe('1y ago');
  });

  it('accepts an ISO string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:10:00Z'));
    expect(timeAgo('2024-06-01T00:00:00Z')).toBe('10m ago');
  });
});

describe('truncate', () => {
  it('leaves short strings unchanged', () => {
    expect(truncate('hello', 80)).toBe('hello');
  });
  it('truncates and appends an ellipsis', () => {
    expect(truncate('abcdef', 3)).toBe('abc…');
  });
});

describe('initials', () => {
  it('takes up to two uppercase initials', () => {
    expect(initials('Aisha Khan')).toBe('AK');
    expect(initials('madonna')).toBe('M');
  });
  it('handles undefined/empty', () => {
    expect(initials()).toBe('?');
    expect(initials('')).toBe('?');
  });
});
