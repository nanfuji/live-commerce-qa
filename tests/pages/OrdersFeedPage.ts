import { Locator, Page } from '@playwright/test';

export const ORDERS_PATH = '/playwright/network-mock.html';

/** Page Object: "Network Mocking Playground", a live order feed with loading/empty/error/offline states. */
export class OrdersFeedPage {
  readonly reload: Locator;
  readonly loadEmpty: Locator;
  readonly loadMissing: Locator;
  readonly poll: Locator;
  readonly offline: Locator;
  readonly errorBanner: Locator;
  readonly offlineBanner: Locator;
  readonly feed: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;
  readonly skeletons: Locator;
  readonly logRows: Locator;
  readonly requestCount: Locator;
  readonly clearLog: Locator;

  constructor(readonly page: Page) {
    this.reload = page.getByTestId('reload-orders');
    this.loadEmpty = page.getByTestId('load-empty');
    this.loadMissing = page.getByTestId('load-broken');
    this.poll = page.getByTestId('poll-toggle');
    this.offline = page.getByTestId('offline-toggle');
    this.errorBanner = page.getByTestId('error-banner');
    this.offlineBanner = page.getByTestId('offline-banner');
    this.feed = page.getByTestId('feed-body');
    this.rows = page.getByTestId('order-row');
    this.emptyState = page.getByTestId('empty-state');
    this.skeletons = this.feed.locator('.skel');
    this.logRows = page.getByTestId('request-row');
    this.requestCount = page.getByTestId('request-count');
    this.clearLog = page.getByTestId('clear-log');
  }

  async goto() { await this.page.goto(ORDERS_PATH); }
}
