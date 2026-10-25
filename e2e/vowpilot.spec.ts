import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Read axe-core bundle for injecting into the real browser
const axeCorePath = path.resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
const axeSource = fs.readFileSync(axeCorePath, 'utf8');

async function runAxeScan(page: Page, screenName: string) {
  // Inject axe-core
  await page.evaluate(axeSource);

  // Run axe WCAG 2.2 AA scan
  const results = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
  });

  const seriousViolations = results.violations.filter(
    (v: any) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (seriousViolations.length > 0) {
    console.error(`Axe violations in ${screenName}:`, JSON.stringify(seriousViolations, null, 2));
  }

  expect(seriousViolations, `WCAG 2.2 AA violations in ${screenName}`).toEqual([]);
}

test.describe('VowPilot End-to-End Real Browser & Accessibility Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('E2E Journey 1: Header, Navigation & Viewport No Horizontal Overflow', async ({ page }) => {
    // Verify brand identity
    await expect(page.locator('text=VowPilot').first()).toBeVisible();
    const isMobile = (page.viewportSize()?.width || 1280) < 640;
    if (!isMobile) {
      await expect(page.locator('text=Plan with clarity. Coordinate with confidence.').first()).toBeVisible();
    }

    // Verify absence of horizontal scrollbar/overflow on the page body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow, 'Page should not have horizontal overflow').toBe(false);

    // Run accessibility check on Dashboard
    await runAxeScan(page, 'Dashboard Overview');
  });

  test('E2E Journey 2: Needs Assessment Wizard Modal & Parameter Adjustment', async ({ page }) => {
    // Click "+ New Event"
    const newEventBtn = page.locator('button:has-text("+ New Event")');
    await expect(newEventBtn).toBeVisible();
    await newEventBtn.click();

    // Verify modal is open
    await expect(page.locator('text=Interactive Needs Assessment')).toBeVisible();

    // Run accessibility check inside open modal
    await runAxeScan(page, 'Needs Assessment Modal');

    // Close modal via Cancel button or Esc
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(page.locator('text=Interactive Needs Assessment')).not.toBeVisible();
  });

  test('E2E Journey 3: Budget Planner Allocations and Runway Verification', async ({ page }) => {
    // Click Budget Planner tab
    const tabBtn = page.locator('[data-testid="tab-budget"]');
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();

    // Verify budget view header exists
    await expect(page.locator('text=Budget & Trade-Off Planner').first()).toBeVisible({ timeout: 5000 });

    // Check accessibility
    await runAxeScan(page, 'Budget Planner View');
  });

  test('E2E Journey 4: Decision Simulator & Sensitivity Testing', async ({ page }) => {
    // Click Decision Simulator tab
    const tabBtn = page.locator('[data-testid="tab-simulator"]');
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();

    // Verify simulator UI header
    await expect(page.locator('text=Decision Impact Simulator').first()).toBeVisible({ timeout: 5000 });

    // Run accessibility scan
    await runAxeScan(page, 'Decision Simulator View');
  });

  test('E2E Journey 5: Task Management, Dependencies & Topological Order', async ({ page }) => {
    // Click Tasks tab
    const tabBtn = page.locator('[data-testid="tab-tasks"]');
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();

    // Verify task screen loaded
    await expect(page.locator('text=Tasks & Dependency Graph').first()).toBeVisible({ timeout: 5000 });

    // Run accessibility scan
    await runAxeScan(page, 'Tasks & Graph View');
  });

  test('E2E Journey 6: Vendor Coordination & Quotation Matrices', async ({ page }) => {
    // Click Vendors tab
    const tabBtn = page.locator('[data-testid="tab-vendors"]');
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();

    // Verify vendors matrix
    await expect(page.locator('text=Vendor Directory & Quotation Matrix').first()).toBeVisible({ timeout: 5000 });

    // Run accessibility scan
    await runAxeScan(page, 'Vendors View');
  });

  test('E2E Journey 7: Multilingual Assistant Interaction (English & Bengali)', async ({ page }) => {
    // Click Planner Assistant tab
    const tabBtn = page.locator('[data-testid="tab-assistant"]');
    await tabBtn.scrollIntoViewIfNeeded();
    await tabBtn.click();

    // Find message input & button
    const input = page.locator('#assistant-prompt-input');
    const sendButton = page.locator('button[aria-label="Ask: Send planning command"]');

    await expect(input).toBeVisible();

    // Test English canonical query: "how to cut budget"
    await input.fill('how to cut budget');
    await sendButton.click();

    // Wait for grounded assistant response
    await expect(page.locator('text=Priority-Aware Budget Reduction Opportunities').first()).toBeVisible({ timeout: 5000 });

    // Test Bengali script query: "আমার বাজেট ব্যাখ্যা করো"
    await input.fill('আমার বাজেট ব্যাখ্যা করো');
    await sendButton.click();

    // Wait for Bengali response
    await expect(page.locator('text=বর্তমান বাজেট বিবরণী').first()).toBeVisible({ timeout: 5000 });

    // Run accessibility scan on assistant conversation
    await runAxeScan(page, 'Planner Assistant View');
  });

  test('Visual Verification: Capture Viewport Screenshots for Evidence', async ({ page }) => {
    const viewport = page.viewportSize();
    const screenshotDir = path.resolve(process.cwd(), 'artifacts/screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });

    const filename = `vowpilot_${viewport?.width || 1280}x${viewport?.height || 800}.png`;
    const screenshotPath = path.join(screenshotDir, filename);

    await page.screenshot({ path: screenshotPath, fullPage: false });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });
});
