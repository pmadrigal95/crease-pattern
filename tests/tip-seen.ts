/**
 * Browser state for the e2e suites: the first-visit tip (src/components/site/first-tip.ts) already
 * seen, so it doesn't appear over what other tests look at. tests/e2e/first-tip.spec.ts starts
 * from an empty state to test the tip itself.
 */
export const tipSeen = (origin: string) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: 'pm.tips', value: '1' }] }],
});
