import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { pageRevealScript, restoreIdentityScript } from '../../scripts/csp-hashes.ts';
import { allVisualDirections } from '../../src/config/visual-direction';

describe('restore-identity inline script', () => {
  test('accepts exactly the identities defined by VisualDirection', () => {
    const list = restoreIdentityScript.match(/\[([^\]]+)\]/)?.[1];
    expect(JSON.parse(`[${list}]`)).toEqual(allVisualDirections);
  });

  test('is a single line, so HTML compression cannot change its hash', () => {
    expect(restoreIdentityScript).not.toMatch(/\n/);
  });
});

describe('page-reveal inline script', () => {
  test('is a single line, so HTML compression cannot change its hash', () => {
    expect(pageRevealScript).not.toMatch(/\n/);
  });

  // The inliner joins lines (scripts/inline-script.ts): a line comment would swallow the rest.
  test('its source has no line comments, and joined it is still valid JavaScript', () => {
    const source = readFileSync(new URL('../../src/scripts/page-reveal.ts', import.meta.url), 'utf8');
    expect(source.split('\n').filter((line) => /(^|[^:'"])\/\//.test(line))).toEqual([]);
    expect(() => new Function(pageRevealScript)).not.toThrow();
  });
});
