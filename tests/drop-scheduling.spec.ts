import { test, expect } from './support/base';
import { DropSchedulerPage } from './pages/DropSchedulerPage';

/**
 * Target: "Date & Time Traps", used as a stand-in for live-drop scheduling.
 * Time is frozen with page.clock and the browser runs in Philippine time, so results never depend on
 * the day the suite runs or on the machine's timezone.
 */
test.use({ timezoneId: 'Asia/Manila', locale: 'en-PH' });

const WED_18_NOV_2026 = new Date('2026-11-18T09:00:00+08:00');
const isoWeekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // tz-independent

test.describe('Drop calendar', () => {
  let drop: DropSchedulerPage;
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: WED_18_NOV_2026 });
    drop = new DropSchedulerPage(page);
    await drop.goto();
  });

  test('DT-01 weekends and past dates are disabled, everything else is selectable', async () => {
    await expect(drop.calTitle).toHaveText('November 2026');
    const days = await drop.days.evaluateAll((els) => els.map((e) => ({ date: e.getAttribute('data-date')!, disabled: (e as HTMLButtonElement).disabled })));
    expect(days).toHaveLength(30);
    for (const d of days) {
      const weekend = [0, 6].includes(isoWeekday(d.date));
      const past = d.date < '2026-11-18';
      expect(d.disabled, d.date).toBe(weekend || past);
    }
  });

  test('DT-02 today is highlighted and selectable', async () => {
    await expect(drop.day('2026-11-18')).toHaveClass(/is-today/);
    await drop.day('2026-11-18').click();
    await expect(drop.picked).toHaveText('2026-11-18');
  });

  test('DT-03 picking a day updates the summary; a weekend click changes nothing', async () => {
    await drop.day('2026-11-19').click();
    await expect(drop.picked).toHaveText('2026-11-19');
    await expect(drop.day('2026-11-19')).toHaveClass(/is-selected/);

    await expect(drop.day('2026-11-21')).toBeDisabled(); // Saturday
    await expect(drop.picked).toHaveText('2026-11-19');
  });

  test('DT-04 month navigation works and an earlier month is entirely unavailable', async () => {
    await drop.next.click();
    await expect(drop.calTitle).toHaveText('December 2026');
    await drop.prev.click();
    await drop.prev.click();
    await expect(drop.calTitle).toHaveText('October 2026');
    const enabled = await drop.days.evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).disabled).length);
    expect(enabled).toBe(0);
  });
});

test('DT-05 the calendar rolls over the year boundary', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-15T09:00:00+08:00') });
  const drop = new DropSchedulerPage(page);
  await drop.goto();
  await drop.next.click();
  await expect(drop.calTitle).toHaveText('January 2027');
  await expect(drop.day('2027-01-04')).toBeEnabled(); // Monday
  await expect(drop.day('2027-01-02')).toBeDisabled(); // Saturday
});

test.describe('Drop window (check-in / check-out maths)', () => {
  const cases: Array<{ name: string; from: string; to: string; nights: string; error: boolean }> = [
    { name: 'three nights', from: '2026-12-10', to: '2026-12-13', nights: '3', error: false },
    { name: 'across a month boundary', from: '2026-12-30', to: '2027-01-02', nights: '3', error: false },
    { name: 'across a leap day', from: '2028-02-28', to: '2028-03-01', nights: '2', error: false },
    { name: 'same-day window', from: '2026-12-10', to: '2026-12-10', nights: '0', error: true },
    { name: 'end before start', from: '2026-12-10', to: '2026-12-08', nights: '0', error: true },
  ];
  for (const [i, c] of cases.entries()) {
    test(`DT-${String(6 + i).padStart(2, '0')} ${c.name}: ${c.nights} night(s)${c.error ? ', error shown' : ''}`, async ({ page }) => {
      const drop = new DropSchedulerPage(page);
      await drop.goto();
      await drop.checkin.fill(c.from);
      await drop.checkout.fill(c.to);
      await expect(drop.nights).toHaveText(c.nights);
      if (c.error) await expect(drop.rangeError).toHaveClass(/is-on/);
      else await expect(drop.rangeError).not.toHaveClass(/is-on/);
    });
  }
});

test.describe('"Drop starts…" relative-day label (frozen clock)', () => {
  const rel = [
    { date: '2026-11-17', expect: 'yesterday' },
    { date: '2026-11-18', expect: 'today' },
    { date: '2026-11-19', expect: 'tomorrow' },
    { date: '2026-11-20', expect: 'in 2 days' },
    { date: '2026-12-18', expect: 'in 30 days' },
  ];
  for (const [i, r] of rel.entries()) {
    test(`DT-${11 + i} ${r.date} reads "${r.expect}" when today is 18 Nov 2026`, async ({ page }) => {
      await page.clock.install({ time: WED_18_NOV_2026 });
      const drop = new DropSchedulerPage(page);
      await drop.goto();
      await drop.meetingDate.fill(r.date);
      await drop.meetingTime.fill('10:00');
      await expect(drop.meetingSummary).toContainText(`Meeting ${r.expect},`);
    });
  }

  test('DT-16 the midnight trap: the same date flips from "tomorrow" to "today" at midnight', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-18T23:59:50+08:00') });
    const drop = new DropSchedulerPage(page);
    await drop.goto();
    await drop.meetingDate.fill('2026-11-19');
    await drop.meetingTime.fill('10:00');
    await expect(drop.meetingSummary).toContainText('Meeting tomorrow,');

    await page.clock.setFixedTime(new Date('2026-11-19T00:00:10+08:00'));
    await drop.meetingTime.fill('10:01'); // re-trigger the calculation
    await expect(drop.meetingSummary).toContainText('Meeting today,');
  });

  test('DT-17 the summary asks for both date and time before computing', async ({ page }) => {
    const drop = new DropSchedulerPage(page);
    await drop.goto();
    await expect(drop.meetingSummary).toHaveText('Pick a date and a time.');
    await drop.meetingDate.fill('2026-12-01');
    await expect(drop.meetingSummary).toHaveText('Pick a date and a time.');
  });
});

test.describe('Drop time across timezones', () => {
  test('DT-18 one UTC instant is shown correctly in UTC, India and Philippine time', async ({ page }) => {
    const drop = new DropSchedulerPage(page);
    await drop.goto();
    await expect(page.getByTestId('flight-iso')).toHaveText('2030-01-15T18:30:00Z');
    await expect(page.getByTestId('tz-utc')).toContainText(/15 Jan.*18:30/);
    await expect(page.getByTestId('tz-ist')).toContainText(/16 Jan.*(00|24):00/); // 18:30Z + 05:30 (some ICU builds print 24:00)
    await expect(page.getByTestId('tz-local-name')).toHaveText('Asia/Manila');
    await expect(page.getByTestId('tz-local')).toContainText(/16 Jan.*02:30/); // 18:30Z + 08:00
  });
});
