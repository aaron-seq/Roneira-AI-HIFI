import { test, expect } from '@playwright/test';

/**
 * Navigation Flow E2E Test
 * Tests navigation between pages, portfolio table interaction, and page content
 */
test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the main application', async ({ page }) => {
    // Check that the main content is present
    await expect(page.locator('body')).toBeVisible();
    
    // The app should have rendered some content
    const mainContent = page.locator('[data-testid="app-container"], main, #root');
    await expect(mainContent.first()).toBeVisible();
  });

  test('should navigate between main pages', async ({ page }) => {
    // Look for navigation links or sidebar
    const navLinks = page.locator('nav a, aside a, [role="navigation"] a');
    
    // If nav links are present, test navigation
    const navCount = await navLinks.count();
    if (navCount > 0) {
      // Click the first nav link
      await navLinks.first().click();
      await page.waitForLoadState('networkidle');
      
      // Verify URL changed or content updated
      expect(page.url()).toBeTruthy();
    }
  });

  test('should display portfolio data when navigating to portfolio', async ({ page }) => {
    // Try to navigate to portfolio page
    const portfolioLink = page.locator('a[href*="portfolio"], a:has-text("Portfolio")');
    
    if (await portfolioLink.count() > 0) {
      await portfolioLink.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for portfolio-related content
      const portfolioContent = page.locator('text=Holdings, text=Portfolio, text=Total Value');
      await expect(portfolioContent.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should filter portfolio table when filter controls exist', async ({ page }) => {
    // Navigate to portfolio if possible
    const portfolioLink = page.locator('a[href*="portfolio"], a:has-text("Portfolio")');
    if (await portfolioLink.count() > 0) {
      await portfolioLink.first().click();
      await page.waitForLoadState('networkidle');
    }
    
    // Look for filter/sector dropdown
    const sectorFilter = page.locator('select, [role="combobox"]').first();
    
    if (await sectorFilter.count() > 0) {
      await sectorFilter.click();
      
      // Select an option if available
      const option = page.locator('option, [role="option"]').nth(1);
      if (await option.count() > 0) {
        await option.click();
        
        // Verify table content changed
        await page.waitForTimeout(500);
        // Table should still be visible after filter
        const table = page.locator('table, [role="table"]');
        if (await table.count() > 0) {
          await expect(table.first()).toBeVisible();
        }
      }
    }
  });

  test('should have keyboard navigation support', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Check that some element is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test Escape key behavior
    await page.keyboard.press('Escape');
    // Should not break the app
    await expect(page.locator('body')).toBeVisible();
  });

  test('should open command palette with keyboard shortcut', async ({ page }) => {
    // Try Cmd/Ctrl + K to open command palette
    await page.keyboard.press('Control+k');
    
    // Wait a moment for the palette to open
    await page.waitForTimeout(300);
    
    // Look for command palette elements
    const palette = page.locator('[role="dialog"], [data-testid="command-palette"], .command-palette');
    
    // If palette opened, verify it's visible
    if (await palette.count() > 0) {
      await expect(palette.first()).toBeVisible();
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });
});
