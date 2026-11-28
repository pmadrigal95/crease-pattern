import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import measured from '../../src/data/lighthouse.json';
import { buildFacts } from '../../src/lib/build-facts';

// The colophon's numbers (doc 40): counted from the repository, and the last Lighthouse
// measurement recorded with `pnpm lighthouse:record`.
describe('the colophon', () => {
  test('counts the build from the repository', () => {
    const f = buildFacts();
    expect(f.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(f.components).toBeGreaterThan(20);
    expect(f.baseTokens).toBeGreaterThan(10);
    expect(f.colorTokens).toBe(9);
    expect(f.axeRuns).toEqual([expect.any(Number), 3, 2]);
    expect(f.tokensKb).toBeGreaterThan(0);
  });

  test('shows a recorded Lighthouse measurement that clears the bar CI asserts', () => {
    const rc = JSON.parse(readFileSync(new URL('../../lighthouserc.json', import.meta.url), 'utf8')) as {
      ci: {
        assert: { assertions: Record<string, [string, { minScore?: number; maxNumericValue?: number }]> };
      };
    };
    const a = rc.ci.assert.assertions;
    expect(measured.page).toBe('/colophon');
    expect(measured.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(measured.performance / 100).toBeGreaterThanOrEqual(a['categories:performance']![1].minScore!);
    expect(measured.accessibility / 100).toBeGreaterThanOrEqual(a['categories:accessibility']![1].minScore!);
    expect(measured.lcpMs).toBeLessThan(a['largest-contentful-paint']![1].maxNumericValue!);
    expect(measured.cls).toBeLessThan(a['cumulative-layout-shift']![1].maxNumericValue!);
  });
});
