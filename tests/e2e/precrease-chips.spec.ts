import { expect, test } from '@playwright/test';

// Filter chips (decision 48): plain links, so filtering works without JavaScript and each view
// has its own URL. The chip for where the reader is stays marked.
test.use({ javaScriptEnabled: false });

test('topic chips filter the index without JavaScript', async ({ page }) => {
  await page.goto('/precrease');
  const chips = page.getByRole('navigation', { name: 'Filter posts by topic' });
  await expect(chips.getByRole('link', { name: /^All posts\s*, \d+ posts?$/ })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await chips.getByRole('link', { name: /^Craft & Career\s*,/ }).click();
  await expect(page).toHaveURL(/\/precrease\/topics\/craft$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Filter posts by topic' })
      .getByRole('link', { name: /^Craft & Career\s*,/ }),
  ).toHaveAttribute('aria-current', 'page');
});
