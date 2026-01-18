import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * Captures screenshots of 5 key application states for visual validation
 */
test.describe('Visual Regression - Key States', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for reproducible screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('State 1: Dashboard Overview', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for animations to settle

    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-overview.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // Allow 5% difference for dynamic content
    });
  });

  test('State 2: Portfolio Page with Holdings', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('portfolio-holdings.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('State 3: Watchlist with Real-time Data', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Mask dynamic content that changes frequently
    await expect(page).toHaveScreenshot('watchlist-realtime.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.10, // Higher tolerance for real-time data
      mask: [
        page.locator('[class*="price"]'),
        page.locator('[class*="time"]'),
        page.locator('[class*="percent"]'),
      ],
    });
  });

  test('State 4: Predictions Form', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('predictions-form.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('State 5: Settings Page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('settings-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('Visual Regression - Component States', () => {
  test('Command Palette Open State', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open command palette
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Screenshot the dialog
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count() > 0) {
      await expect(dialog).toHaveScreenshot('command-palette.png', {
        maxDiffPixelRatio: 0.05,
      });
    }

    // Close palette
    await page.keyboard.press('Escape');
  });

  test('Drawer/Modal Open State', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Try to open add position drawer
    const addButton = page.locator('button:has-text("Add"), button:has-text("+")');
    if (await addButton.count() > 0) {
      await addButton.first().click();
      await page.waitForTimeout(500);

      // Screenshot the drawer
      const drawer = page.locator('[role="dialog"], .drawer');
      if (await drawer.count() > 0) {
        await expect(drawer.first()).toHaveScreenshot('portfolio-drawer.png', {
          maxDiffPixelRatio: 0.05,
        });
      }
    }
  });

  test('Connection Status Indicator', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find connection status indicator
    const statusIndicator = page.locator('[data-testid="connection-status"], [class*="status"]');
    if (await statusIndicator.count() > 0) {
      await expect(statusIndicator.first()).toHaveScreenshot('connection-status.png', {
        maxDiffPixelRatio: 0.10,
      });
    }
  });
});

test.describe('Visual Regression - Responsive Layouts', () => {
  test('Mobile Dashboard (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Tablet Dashboard (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Large Desktop (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-desktop-large.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('Visual Regression - Error & Empty States', () => {
  test('Empty Watchlist State', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    
    // If no stocks in watchlist, should show empty state
    const emptyState = page.locator('text=No stocks, text=Add stocks, text=empty');
    if (await emptyState.count() > 0) {
      await expect(emptyState.first()).toHaveScreenshot('watchlist-empty.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });

  test('Loading State', async ({ page }) => {
    // Navigate and capture loading state quickly
    await page.goto('/predictions');
    
    // Look for loading indicators
    const loadingIndicator = page.locator('.animate-spin, [aria-busy="true"], text=Loading');
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator.first()).toHaveScreenshot('loading-state.png', {
        maxDiffPixelRatio: 0.20, // Higher tolerance for animations
      });
    }
  });
});
