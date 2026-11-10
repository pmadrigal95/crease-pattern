import { expect, test } from '@playwright/test';

// /privacy promises no cookies, no storage the visitor didn't choose, and no analytics outside the live host.
const pages = ['/', '/changelog', '/about', '/colophon', '/privacy'];

for (const path of pages) {
  test(`${path} sets no cookies, no storage and calls no third party off the live host`, async ({
    page,
    context,
  }) => {
    const thirdParty: string[] = [];
    page.on('request', (request) => {
      const { hostname } = new URL(request.url());
      if (hostname !== 'localhost' && !request.url().startsWith('data:')) thirdParty.push(request.url());
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(thirdParty).toEqual([]);
  });
}
