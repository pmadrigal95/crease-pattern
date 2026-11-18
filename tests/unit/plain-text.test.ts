import { expect, test } from 'vitest';
import { plainText } from '../../scripts/plain-text.ts';

test('tags go, entities read as text, spaces collapse', () => {
  expect(plainText('<span class="x">Quality</span>\n  gates')).toBe('Quality gates');
  expect(plainText('Writing &amp; reading, &quot;quoted&quot; and it&#39;s')).toBe(
    `Writing & reading, "quoted" and it's`,
  );
});

test('no markup survives: encoded, nested or broken tags', () => {
  for (const input of [
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '<scr<b>ipt>alert(1)',
    '<<script>>',
    'a < b > c',
  ]) {
    expect(plainText(input)).not.toMatch(/[<>]/);
  }
  expect(plainText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('alert(1)');
});
