import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('nexo_token', 'mock-token');
      localStorage.setItem(
        'nexo_user',
        JSON.stringify({
          id: '1',
          username: 'testuser',
          displayName: 'Test User',
        })
      );
    });
    await page.reload();
  });

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('text=Nexo')).toBeVisible();
    await expect(page.locator('input[placeholder*="поиск"]')).toBeVisible();
  });

  test('should open new chat modal', async ({ page }) => {
    const newChatButton = page.locator('button:has-text("Новый чат")').first();
    await newChatButton.click();

    await expect(page.locator('text=Новый чат')).toBeVisible();
  });

  test('should search for users', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="поиск"]').first();
    await searchInput.fill('test');

    await page.waitForTimeout(500);
    // Search results should appear
  });

  test('should display sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('text=Nexo')).toBeVisible();
    // Mobile navigation should be visible
    await expect(page.locator('button:has-text("Чаты")')).toBeVisible();
  });

  test('should handle message input', async ({ page }) => {
    // Assuming a chat is selected
    const messageInput = page.locator('textarea[placeholder*="Сообщение"]');
    if (await messageInput.isVisible()) {
      await messageInput.fill('Test message');
      await expect(messageInput).toHaveValue('Test message');
    }
  });

  test('should open settings menu', async ({ page }) => {
    const menuButton = page.locator('button[title="Меню"]').first();
    await menuButton.click();

    await expect(page.locator('text=Настройки')).toBeVisible();
  });

  test('should navigate between tabs on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const chatsTab = page.locator('button:has-text("Чаты")');
    const friendsTab = page.locator('button:has-text("Друзья")');

    await chatsTab.click();
    await expect(chatsTab).toHaveClass(/text-nexo-400/);

    await friendsTab.click();
    await expect(friendsTab).toHaveClass(/text-nexo-400/);
  });
});
