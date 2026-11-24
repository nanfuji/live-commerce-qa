import { Locator, Page } from '@playwright/test';

export const DATES_PATH = '/playwright/date-traps.html';

/** Page Object: "Date & Time Traps", used as a stand-in for live-drop scheduling widgets. */
export class DropSchedulerPage {
  readonly days: Locator;
  readonly calTitle: Locator;
  readonly next: Locator;
  readonly prev: Locator;
  readonly picked: Locator;
  readonly checkin: Locator;
  readonly checkout: Locator;
  readonly rangeError: Locator;
  readonly nights: Locator;
  readonly meetingDate: Locator;
  readonly meetingTime: Locator;
  readonly meetingSummary: Locator;

  constructor(readonly page: Page) {
    this.days = page.getByTestId('cal-day');
    this.calTitle = page.getByTestId('cal-title');
    this.next = page.getByTestId('cal-next');
    this.prev = page.getByTestId('cal-prev');
    this.picked = page.getByTestId('picked-date');
    this.checkin = page.getByTestId('checkin-input');
    this.checkout = page.getByTestId('checkout-input');
    this.rangeError = page.getByTestId('range-error');
    this.nights = page.getByTestId('nights-count');
    this.meetingDate = page.getByTestId('meeting-date');
    this.meetingTime = page.getByTestId('meeting-time');
    this.meetingSummary = page.getByTestId('meeting-summary');
  }

  async goto() { await this.page.goto(DATES_PATH); }
  day(iso: string) { return this.page.locator(`[data-testid="cal-day"][data-date="${iso}"]`); }
}
