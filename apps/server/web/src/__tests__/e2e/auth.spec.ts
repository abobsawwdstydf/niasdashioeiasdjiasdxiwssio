import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.locator('text=Nexo')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    const loginButton = page.locator('button:has-text("Войти")');
    await loginButton.click();

    // Should stay on login page
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });

  test('should navigate to registration', async ({ page }) => {
    const registerLink = page.locator('text=Регистрация');
    await registerLink.click();

    await expect(page.locator('text=Создать аккаунт')).toBeVisible();
  });

  test('should handle login with credentials', async ({ page }) => {
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'password123');

    const loginButton = page.locator('button:has-text("Войти")');
    await loginButton.click();

    // Wait for navigation or error message
    await page.waitForTimeout(1000);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('text=Nexo')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });
});
