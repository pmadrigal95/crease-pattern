import { describe, expect, test } from 'vitest';
import { restoreIdentityScript } from '../../scripts/csp-hashes.mjs';
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
