import { test, expect } from './support/base';
import { OrdersFeedPage } from './pages/OrdersFeedPage';
import { order, mockOrders, ORDERS_GLOB, EMPTY_GLOB, MISSING_GLOB } from './support/orders';

/**
 * Target: "Network Mocking Playground", a live order feed (polling, loading / empty / error / offline states).
 * Stand-in for a live-commerce "orders as they happen" dashboard. All behaviour tests mock the wire with
 * page.route() so they are deterministic and never depend on (or load) the host's data.
 */
test.describe('Live order feed · rendering & states', () => {
  let feed: OrdersFeedPage;
  test.beforeEach(({ page }) => { feed = new OrdersFeedPage(page); });

  test('OF-01 renders each order with formatted amount and status', async () => {
    await mockOrders(feed.page, [order(1, { customer: 'Maria Santos', amount: 125000, status: 'shipped' }), order(2, { customer: 'Juan Dela Cruz', status: 'delivered' })]);
    await feed.goto();
    await expect(feed.rows).toHaveCount(2);
    await expect(feed.rows.first()).toContainText('Maria Santos');
    await expect(feed.rows.first()).toContainText('₹1,25,000'); // en-IN digit grouping
    await expect(feed.rows.first()).toContainText('shipped');
    await expect(feed.rows.nth(1)).toContainText('delivered');
  });

  test('OF-02 shows loading skeletons until the response arrives', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await feed.page.route(ORDERS_GLOB, async (route) => { await gate; await route.fulfill({ json: { orders: [order(1)] } }); });
    await feed.goto();
    await expect(feed.skeletons).toHaveCount(4);
    await expect(feed.rows).toHaveCount(0);
    release();
    await expect(feed.rows).toHaveCount(1);
    await expect(feed.skeletons).toHaveCount(0);
  });

  test('OF-03 a server error shows the error banner and no stale rows', async () => {
    await feed.page.route(ORDERS_GLOB, (route) => route.fulfill({ status: 500, body: 'boom' }));
    await feed.goto();
    await expect(feed.errorBanner).toHaveClass(/is-on/);
    await expect(feed.errorBanner).toHaveText('Could not load orders: Server responded 500');
    await expect(feed.rows).toHaveCount(0);
  });

  test('OF-04 a dropped connection is reported, then the feed recovers', async () => {
    await feed.page.route(ORDERS_GLOB, (route) => route.abort('internetdisconnected'));
    await feed.goto();
    await expect(feed.errorBanner).toHaveClass(/is-on/);
    await expect(feed.errorBanner).toContainText('Could not load orders:');

    await feed.page.unroute(ORDERS_GLOB);
    await mockOrders(feed.page, [order(1), order(2), order(3)]);
    await feed.reload.click();
    await expect(feed.errorBanner).not.toHaveClass(/is-on/);
    await expect(feed.rows).toHaveCount(3);
  });

  test('OF-05 an empty response shows the empty state, not an empty table', async () => {
    await mockOrders(feed.page, []);
    await feed.goto();
    await expect(feed.emptyState).toContainText('No orders yet');
    await expect(feed.page.getByTestId('orders-table')).toHaveCount(0);
  });

  test('OF-06 the "empty endpoint" action renders the empty state', async () => {
    await mockOrders(feed.page, [order(1)]);
    await mockOrders(feed.page, [], EMPTY_GLOB);
    await feed.goto();
    await expect(feed.rows).toHaveCount(1);
    await feed.loadEmpty.click();
    await expect(feed.emptyState).toBeVisible();
  });

  test('OF-07 a 200 response that is not JSON is rejected with a clear message', async () => {
    await feed.page.route(ORDERS_GLOB, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>SPA fallback</html>' }));
    await feed.goto();
    await expect(feed.errorBanner).toContainText('non-JSON body');
    await expect(feed.rows).toHaveCount(0);
  });

  test('OF-08 a missing endpoint is logged as an error (status 500 when mocked)', async () => {
    await mockOrders(feed.page, [order(1)]);
    await feed.page.route(MISSING_GLOB, (route) => route.fulfill({ status: 500, body: 'nope' }));
    await feed.goto();
    await feed.loadMissing.click();
    await expect(feed.logRows.first()).toHaveAttribute('data-status', '500');
    await expect(feed.errorBanner).toContainText('Server responded 500');
  });
});

test.describe('Live order feed · polling, offline & request log', () => {
  let feed: OrdersFeedPage;
  test.beforeEach(({ page }) => { feed = new OrdersFeedPage(page); });

  test('OF-09 polling refreshes the table every 3 seconds without a click', async ({ page }) => {
    await page.clock.install();
    await mockOrders(page, (call) => [order(call)]);
    await feed.goto();
    await expect(feed.rows.first()).toContainText('ORD-1001');

    await feed.poll.check();
    await page.clock.runFor(3_000);
    await expect(feed.rows.first()).toContainText('ORD-1002');
    await page.clock.runFor(3_000);
    await expect(feed.rows.first()).toContainText('ORD-1003');
  });

  test('OF-10 switching polling off stops the requests', async ({ page }) => {
    await page.clock.install();
    const wire = await mockOrders(page, (call) => [order(call)]);
    await feed.goto();
    await feed.poll.check();
    await page.clock.runFor(3_000);
    await expect(feed.rows.first()).toContainText('ORD-1002');

    await feed.poll.uncheck();
    const before = wire.calls();
    await page.clock.runFor(12_000);
    expect(wire.calls()).toBe(before);
  });

  test('OF-11 simulate-offline blocks requests, then reconnecting reloads the feed', async ({ page }) => {
    const wire = await mockOrders(page, [order(1)]);
    await feed.goto();
    await expect(feed.rows).toHaveCount(1);
    const calls = wire.calls();

    await feed.offline.check();
    await expect(feed.offlineBanner).toHaveClass(/is-on/);
    await feed.reload.click();
    await expect(feed.errorBanner).toContainText('you are offline (simulated)');
    await expect(feed.logRows.first()).toHaveAttribute('data-status', '0');
    expect(wire.calls()).toBe(calls); // no request left the browser

    await feed.offline.uncheck();
    await expect(feed.offlineBanner).not.toHaveClass(/is-on/);
    await expect(feed.rows).toHaveCount(1);
    expect(wire.calls()).toBe(calls + 1);
  });

  test('OF-12 the request log mirrors traffic and can be cleared', async ({ page }) => {
    await mockOrders(page, [order(1)]);
    await feed.goto();
    await expect(feed.requestCount).toHaveText('1');
    await feed.reload.click();
    await expect(feed.requestCount).toHaveText('2');
    await expect(feed.logRows.first()).toHaveAttribute('data-status', '200');
    await expect(feed.logRows.first()).toContainText('orders.json');

    await feed.clearLog.click();
    await expect(feed.requestCount).toHaveText('0');
    await expect(feed.logRows).toHaveCount(0);
  });
});

test.describe('Live order feed · security & live-data contract', () => {
  test('OF-13 KNOWN DEFECT: API data is injected as HTML (stored-XSS risk)', async ({ page }) => {
    // The renderer builds rows with innerHTML from API fields, so a hostile customer name becomes live markup.
    // test.fail() = "expected to fail": it goes green while the defect exists and turns red the day it is fixed.
    test.fail(true, 'Known defect: order fields are rendered via innerHTML without escaping');
    const feed = new OrdersFeedPage(page);
    await mockOrders(page, [order(1, { customer: '<img src=x onerror="window.__xss=1">' })]);
    await feed.goto();
    await expect(feed.feed.locator('img')).toHaveCount(0, { timeout: 1_500 });
  });

  test('OF-14 LIVE: the real orders API honours its contract', async ({ request }) => {
    const res = await request.get('/playwright/api/orders.json');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('json');
    const body = await res.json();
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.length).toBeGreaterThan(0);
    for (const o of body.orders) {
      expect(typeof o.id).toBe('string');
      expect(typeof o.customer).toBe('string');
      expect(typeof o.item).toBe('string');
      expect(Number.isFinite(Number(o.amount))).toBe(true);
      expect(typeof o.status).toBe('string');
    }
  });

  test('OF-15 LIVE: the UI shows exactly the orders the API returns', async ({ page, request }) => {
    const apiCount = (await (await request.get('/playwright/api/orders.json')).json()).orders.length;
    const feed = new OrdersFeedPage(page);
    await feed.goto();
    await expect(feed.rows).toHaveCount(apiCount);
  });
});
