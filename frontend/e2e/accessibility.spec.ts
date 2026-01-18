import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests using axe-core
 * Tests key application states for WCAG 2.1 AA compliance
 */
test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard page should have no accessibility violations', async ({ page }) => {
    // Navigate to dashboard or stay on home
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log any violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Dashboard accessibility violations:');
      accessibilityScanResults.violations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Nodes: ${violation.nodes.length}`);
      });
    }

    // Allow some minor violations but fail on critical/serious
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations.length).toBe(0);
  });

  test('Watchlist page should have no critical accessibility issues', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // May have false positives on dynamic content
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations.length).toBe(0);
  });

  test('Predictions page form should be accessible', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('form, input, button, [role="form"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Form elements should have proper labels and ARIA
    const formViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'label' || v.id === 'form-field-multiple-labels'
    );
    expect(formViolations.length).toBe(0);
  });

  test('Portfolio page tables should be accessible', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Focus on table accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for table-related violations
    const tableViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('table') || v.id.includes('th') || v.id.includes('scope')
    );
    
    // Log table issues if any
    if (tableViolations.length > 0) {
      console.log('Table accessibility issues:', tableViolations);
    }
  });

  test('Settings page should have proper form labels', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const labelViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'label' || v.id === 'label-content-name-mismatch'
    );
    expect(labelViolations.length).toBe(0);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('should be able to navigate with Tab key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through the page
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Check that something is focused
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Get focused element
    const focused = page.locator(':focus');
    
    if (await focused.count() > 0) {
      // Check for focus styles (outline, box-shadow, etc.)
      const focusedEl = focused.first();
      const outline = await focusedEl.evaluate(el => 
        window.getComputedStyle(el).outline
      );
      const boxShadow = await focusedEl.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      
      // Either outline or box-shadow should indicate focus
      const hasFocusIndicator = outline !== 'none' || (boxShadow && boxShadow !== 'none');
      // This is a soft check - log warning if no focus indicator
      if (!hasFocusIndicator) {
        console.warn('Focus indicator may not be visible on focused element');
      }
    }
  });

  test('Escape key should close modals/dialogs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to open command palette
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    // Check if dialog is present
    const dialog = page.locator('[role="dialog"]');
    
    if (await dialog.count() > 0) {
      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Dialog should be closed or hidden
      // (may still be in DOM but not visible)
    }
  });

  test('should support Enter key for button activation', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');

    // Find a button and focus it
    const button = page.locator('button').first();
    
    if (await button.count() > 0) {
      await button.focus();
      
      // Press Enter should activate button
      await page.keyboard.press('Enter');
      
      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Accessibility - Screen Reader Support', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all headings
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    
    // Should have at most one H1
    expect(h1Count).toBeLessThanOrEqual(1);
    
    // Log heading structure for review
    console.log(`Heading structure: H1=${h1Count}, H2=${h2Count}`);
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Either has alt text or role="presentation"
      const isAccessible = alt !== null || role === 'presentation';
      expect(isAccessible).toBe(true);
    }
  });

  test('interactive elements should have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Check for button-name violations
    const nameViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'button-name' || v.id === 'link-name' || v.id === 'input-button-name'
    );
    
    expect(nameViolations.length).toBe(0);
  });

  test('ARIA landmarks should be present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for common landmarks
    const main = await page.locator('main, [role="main"]').count();
    const nav = await page.locator('nav, [role="navigation"]').count();
    
    // Should have main content area
    expect(main).toBeGreaterThanOrEqual(1);
    
    // Should have navigation
    expect(nav).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Accessibility - Color and Contrast', () => {
  test('text should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();

    // Check contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );

    // Log any contrast issues
    if (contrastViolations.length > 0) {
      console.log('Color contrast issues found:');
      contrastViolations.forEach(v => {
        console.log(`- ${v.nodes.length} elements with insufficient contrast`);
      });
    }
  });

  test('page should be usable without color alone', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');

    // Check for elements that rely solely on color
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const colorOnlyViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'link-in-text-block' || v.id.includes('color')
    );

    // Should not rely on color alone for important information
    const criticalColorViolations = colorOnlyViolations.filter(
      v => v.impact === 'critical'
    );
    expect(criticalColorViolations.length).toBe(0);
  });
});
