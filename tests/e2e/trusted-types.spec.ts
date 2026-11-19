import { expect, test, type Page } from '@playwright/test';

// Trusted Types (astro.config.ts, src/lib/trusted-types.ts): every page requires them, and the
// paths that hand the browser a script URL or HTML (Vue's Inspector, Pagefind's worker, giscus)
// go through a named policy. A violation here means something new writes to a sink unguarded.
const violations = async (page: Page) => {
  const found: string[] = [];
  page.on('console', (m) => {
    if (/CSP violation|TrustedScriptURL|TrustedHTML|TrustedScript/.test(m.text())) found.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI} ${e.sample}`),
    );
  });
  return found;
};

test('every page requires Trusted Types', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
  expect(csp).toContain("require-trusted-types-for 'script'");
});

test('the Inspector and its folded views write nothing unguarded', async ({ page }) => {
  const found = await violations(page);
  await page.goto('/');
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#inspector')).toBeVisible();
  await page.getByRole('radio', { name: 'Pattern', exact: true }).check();
  await expect(page.locator('html')).toHaveClass(/fold-settled/, { timeout: 5_000 });
  expect(found).toEqual([]);
});

test('the search starts its worker through the policy', async ({ page }) => {
  const found = await violations(page);
  await page.goto('/precrease');
  await page.getByRole('searchbox').first().fill('fold');
  await expect(page.locator('[data-results] li, .results li').first()).toBeVisible({ timeout: 10_000 });
  expect(found).toEqual([]);
});
