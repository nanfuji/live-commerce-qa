import { test, expect } from './support/base';

/**
 * Target: TTACart login screen (the shop entry point). Only the static, markup-level contract is
 * covered here; the login logic and the post-login shop live in scripts that are tested separately.
 */
const LOGIN = '/playwright/ttacart/index.html';

test.describe('TTACart login screen', () => {
  test.beforeEach(async ({ page }) => { await page.goto(LOGIN); });

  test('TC-01 shows the login form', async ({ page }) => {
    await expect(page).toHaveTitle('TTACart - Login');
    await expect(page.locator('[data-test="username"]')).toBeVisible();
    await expect(page.locator('[data-test="password"]')).toBeVisible();
    await expect(page.locator('[data-test="login-button"]')).toHaveText('Login');
  });

  test('TC-02 lists the six documented test users and the shared password hint', async ({ page }) => {
    const users = ['standard_user', 'locked_out_user', 'problem_user', 'performance_glitch_user', 'error_user', 'visual_user'];
    for (const u of users) await expect(page.locator('[data-test="login-credentials"]')).toContainText(u);
    await expect(page.locator('[data-test="login-password"]')).toHaveText('tta_secret');
  });

  test('TC-03 credentials are required and the password is masked', async ({ page }) => {
    await expect(page.locator('[data-test="username"]')).toHaveAttribute('required', '');
    await expect(page.locator('[data-test="password"]')).toHaveAttribute('required', '');
    await expect(page.locator('[data-test="password"]')).toHaveAttribute('type', 'password');
  });
});
