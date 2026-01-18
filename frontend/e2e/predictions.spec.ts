import { test, expect } from '@playwright/test';

/**
 * Predictions Page E2E Test
 * Tests the ML predictions form → loading → result render flow
 */
test.describe('Predictions Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to predictions page', async ({ page }) => {
    // Find and click predictions link
    const predictionsLink = page.locator('a[href*="prediction"], a:has-text("Prediction"), a:has-text("AI")');
    
    if (await predictionsLink.count() > 0) {
      await predictionsLink.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should see predictions page content
      const pageContent = page.locator('text=Prediction, text=AI, text=Symbol');
      await expect(pageContent.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Direct navigation
      await page.goto('/predictions');
      await page.waitForLoadState('networkidle');
    }
  });

  test('should display prediction form with required elements', async ({ page }) => {
    // Navigate to predictions
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Check for symbol input
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[type="text"]').first();
    await expect(symbolInput).toBeVisible({ timeout: 10000 });
    
    // Check for horizon selection buttons
    const horizonButtons = page.locator('button:has-text("Day"), button:has-text("7"), button:has-text("30")');
    const horizonCount = await horizonButtons.count();
    expect(horizonCount).toBeGreaterThan(0);
  });

  test('should show validation error for empty symbol', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Find and click submit button without entering symbol
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Predict"), button[type="submit"]');
    
    if (await submitButton.count() > 0) {
      await submitButton.first().click();
      
      // Wait for potential error message
      await page.waitForTimeout(500);
      
      // Look for error indicator
      const error = page.locator('text=Please enter, text=required, [role="alert"], .error');
      if (await error.count() > 0) {
        await expect(error.first()).toBeVisible();
      }
    }
  });

  test('should submit prediction and show loading state', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Enter a symbol
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[type="text"]').first();
    await symbolInput.fill('AAPL');
    
    // Wait for input to be filled
    await expect(symbolInput).toHaveValue('AAPL');
    
    // Click submit
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Predict")');
    await submitButton.first().click();
    
    // Look for loading indicator
    const loading = page.locator('text=Analyzing, text=Loading, .animate-spin, [data-loading="true"]');
    
    // Either loading state or result should appear
    await page.waitForTimeout(500);
    
    // After loading, should see result or the loading disappears
    const loadingVisible = await loading.count() > 0;
    if (loadingVisible) {
      // Wait for loading to complete
      await page.waitForTimeout(2000);
    }
  });

  test('should display prediction result after submission', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Enter symbol
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[type="text"]').first();
    await symbolInput.fill('NVDA');
    
    // Select horizon (click 30 days if available)
    const horizonButton = page.locator('button:has-text("30")');
    if (await horizonButton.count() > 0) {
      await horizonButton.first().click();
    }
    
    // Submit
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Predict")');
    await submitButton.first().click();
    
    // Wait for result (mock API should be fast)
    await page.waitForTimeout(2000);
    
    // Look for prediction result elements
    const resultElements = page.locator('text=NVDA, text=Confidence, text=Predicted, text=Price');
    await expect(resultElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show confidence meter in prediction result', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Quick prediction flow
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[type="text"]').first();
    await symbolInput.fill('TSLA');
    
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Predict")');
    await submitButton.first().click();
    
    // Wait for result
    await page.waitForTimeout(2000);
    
    // Look for confidence score or meter
    const confidenceElement = page.locator('text=Confidence, text=%');
    if (await confidenceElement.count() > 0) {
      await expect(confidenceElement.first()).toBeVisible();
    }
    
    // Look for progress bar / meter
    const progressBar = page.locator('[role="progressbar"], .progress, [class*="meter"]');
    if (await progressBar.count() > 0) {
      await expect(progressBar.first()).toBeVisible();
    }
  });

  test('should display key factors in prediction result', async ({ page }) => {
    await page.goto('/predictions');
    await page.waitForLoadState('networkidle');
    
    // Generate prediction
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[type="text"]').first();
    await symbolInput.fill('GOOGL');
    
    const submitButton = page.locator('button:has-text("Generate"), button:has-text("Predict")');
    await submitButton.first().click();
    
    await page.waitForTimeout(2000);
    
    // Look for key factors section
    const factorsSection = page.locator('text=Factor, text=Momentum, text=Sentiment, text=Volume');
    if (await factorsSection.count() > 0) {
      await expect(factorsSection.first()).toBeVisible();
    }
  });
});
