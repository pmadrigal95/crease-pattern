import { describe, expect, test } from 'vitest';
import {
  formatCount,
  formatDate,
  formatList,
  formatMonth,
  formatNumber,
  padNumber,
} from '../../src/lib/format';
import { fill } from '../../src/lib/template';

describe('format', () => {
  test('dates are calendar days: midnight UTC never shows as the day before', () => {
    expect(formatDate(new Date('2026-11-11T00:00:00Z'))).toBe('November 11, 2026');
  });

  test('months read short, bare years stay as they are', () => {
    expect(formatMonth('2019-09')).toBe('Sep 2019');
    expect(formatMonth('2015')).toBe('2015');
  });

  test('numbers, lists and serials', () => {
    expect(formatNumber(3432)).toBe('3,432');
    expect(formatList(['English', 'Spanish', 'Japanese'])).toBe('English, Spanish, and Japanese');
    expect(padNumber(1)).toBe('001');
    expect(padNumber(3, 2)).toBe('03');
  });

  test('counts pick their sentence, and zero falls back to many without its own form', () => {
    const forms = { one: '1 post', many: '{count} posts' };
    expect(formatCount(1, forms)).toBe('1 post');
    expect(formatCount(1200, forms)).toBe('1,200 posts');
    expect(formatCount(0, forms)).toBe('0 posts');
    expect(formatCount(0, { ...forms, zero: 'No posts yet' })).toBe('No posts yet');
  });

  test('fill refuses a missing placeholder instead of shipping "{count}"', () => {
    expect(fill('{a} and {b}', { a: 1, b: 'two' })).toBe('1 and two');
    expect(() => fill('{a} and {b}', { a: 1 })).toThrow(/Missing value for \{b\}/);
  });
});
