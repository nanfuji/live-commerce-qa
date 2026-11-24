import { test as base, expect } from '@playwright/test';

/**
 * Shared test base.
 * Auto-fixture `_quietTrackers` blocks the host's analytics beacons so our automated
 * traffic never pollutes a third-party site's statistics (and runs stay deterministic).
 */
export const test = base.extend<{ _quietTrackers: void }>({
  _quietTrackers: [
    async ({ context }, use) => {
      await context.route(/(insights\.thetestingacademy\.com|static\.cloudflareinsights\.com)/, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect };
