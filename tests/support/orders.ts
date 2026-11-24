import { Page, Route } from '@playwright/test';

export interface Order { id: string; customer: string; item: string; amount: number; status: 'processing' | 'shipped' | 'delivered' }

/** Builds a deterministic order so assertions never depend on the host's live data. */
export const order = (n: number, over: Partial<Order> = {}): Order => ({
  id: `ORD-${1000 + n}`,
  customer: `Customer ${n}`,
  item: `Neon Run Hoodie ${n}`,
  amount: 1999,
  status: 'processing',
  ...over,
});

export const ORDERS_GLOB = '**/api/orders.json*';
export const EMPTY_GLOB = '**/api/orders-empty.json*';
export const MISSING_GLOB = '**/api/orders-missing.json*';

export async function mockOrders(page: Page, orders: Order[] | ((callNo: number) => Order[]), glob = ORDERS_GLOB) {
  let calls = 0;
  await page.route(glob, (route: Route) => {
    calls++;
    return route.fulfill({ json: { orders: typeof orders === 'function' ? orders(calls) : orders } });
  });
  return { calls: () => calls };
}
