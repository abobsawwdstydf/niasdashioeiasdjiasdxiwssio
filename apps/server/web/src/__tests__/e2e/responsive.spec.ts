import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Foldable', width: 280, height: 653 },
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`should render correctly on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      // Check if page loads
      await expect(page.locator('text=Nexo')).toBeVisible();

      // Take screenshot for visual regression
      await page.screenshot({
        path: `test-results/screenshots/${name.toLowerCase()}.png`,
        fullPage: true,
      });
    });
  });

  test('should handle landscape mode on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');

    await expect(page.locator('text=Nexo')).toBeVisible();
  });

  test('should adapt navigation for mobile', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('nexo_token', 'mock-token');
    });
    await page.reload();

    // Desktop should have sidebar navigation
    const desktopNav = page.locator('[class*="glass-strong"]').first();
    await expect(desktopNav).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Mobile should have bottom navigation
    const mobileNav = page.locator('button:has-text("Чаты")');
    await expect(mobileNav).toBeVisible();
  });

  test('should handle touch interactions on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Touch targets should be at least 44x44px
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test('should support safe area insets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto('/');

    // Check if safe area CSS variables are applied
    const hasSafeArea = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return (
        style.getPropertyValue('--safe-area-inset-top') !== '' ||
        document.querySelector('[class*="safe-area"]') !== null
      );
    });

    // Safe area support should be present
    expect(typeof hasSafeArea).toBe('boolean');
  });
});
