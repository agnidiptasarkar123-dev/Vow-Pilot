import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { comparePngFiles } from '../src/test/visualDiffEngine';

test.describe('VowPilot Automated Visual Regression & Pixel-Diff Verification', () => {
  const baselinesDir = path.resolve(process.cwd(), 'artifacts/visual-baselines');
  const currentDir = path.resolve(process.cwd(), 'artifacts/screenshots/after');
  const diffsDir = path.resolve(process.cwd(), 'artifacts/visual-diffs');

  test.beforeAll(() => {
    fs.mkdirSync(baselinesDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
    fs.mkdirSync(diffsDir, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Visual Regression: Capture, Baseline & Real Pixel-Diff across Major Views', async ({ page }) => {
    const viewport = page.viewportSize() || { width: 1440, height: 900 };
    const vpTag = `${viewport.width}x${viewport.height}`;

    // 1. Dashboard View
    const dashboardCurrent = path.join(currentDir, `dashboard_${vpTag}.png`);
    const dashboardBaseline = path.join(baselinesDir, `dashboard_${vpTag}.png`);
    const dashboardDiff = path.join(diffsDir, `dashboard_${vpTag}_diff.png`);

    await page.screenshot({ path: dashboardCurrent, fullPage: false });

    // Initialize baseline if missing on first review
    if (!fs.existsSync(dashboardBaseline)) {
      fs.copyFileSync(dashboardCurrent, dashboardBaseline);
    }

    // Perform real pixel-by-pixel visual diff
    const dashResult = comparePngFiles(dashboardBaseline, dashboardCurrent, dashboardDiff, {
      maxDiffPercentage: 0.5,
      threshold: 0.1,
    });

    expect(dashResult.isSameDimensions).toBe(true);
    expect(dashResult.diffPercentage).toBeLessThan(0.5);
    expect(dashResult.passed).toBe(true);

    // 2. Budget Planner View
    await page.locator('[data-testid="tab-budget"]').click();
    await expect(page.locator('text=Budget & Trade-Off Planner').first()).toBeVisible();

    const budgetCurrent = path.join(currentDir, `budget_${vpTag}.png`);
    const budgetBaseline = path.join(baselinesDir, `budget_${vpTag}.png`);
    const budgetDiff = path.join(diffsDir, `budget_${vpTag}_diff.png`);

    await page.screenshot({ path: budgetCurrent, fullPage: false });
    if (!fs.existsSync(budgetBaseline)) {
      fs.copyFileSync(budgetCurrent, budgetBaseline);
    }

    const budgetResult = comparePngFiles(budgetBaseline, budgetCurrent, budgetDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(budgetResult.passed).toBe(true);

    // 3. Tasks & Dependency Graph View
    await page.locator('[data-testid="tab-tasks"]').click();
    await expect(page.locator('text=Tasks & Dependency Graph').first()).toBeVisible();

    const tasksCurrent = path.join(currentDir, `tasks_${vpTag}.png`);
    const tasksBaseline = path.join(baselinesDir, `tasks_${vpTag}.png`);
    const tasksDiff = path.join(diffsDir, `tasks_${vpTag}_diff.png`);

    await page.screenshot({ path: tasksCurrent, fullPage: false });
    if (!fs.existsSync(tasksBaseline)) {
      fs.copyFileSync(tasksCurrent, tasksBaseline);
    }

    const tasksResult = comparePngFiles(tasksBaseline, tasksCurrent, tasksDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(tasksResult.passed).toBe(true);

    // 4. Vendor Coordination & Quotation Matrix View
    await page.locator('[data-testid="tab-vendors"]').click();
    await expect(page.locator('text=Vendor Directory & Quotation Matrix').first()).toBeVisible();

    const vendorsCurrent = path.join(currentDir, `vendors_${vpTag}.png`);
    const vendorsBaseline = path.join(baselinesDir, `vendors_${vpTag}.png`);
    const vendorsDiff = path.join(diffsDir, `vendors_${vpTag}_diff.png`);

    await page.screenshot({ path: vendorsCurrent, fullPage: false });
    if (!fs.existsSync(vendorsBaseline)) {
      fs.copyFileSync(vendorsCurrent, vendorsBaseline);
    }

    const vendorsResult = comparePngFiles(vendorsBaseline, vendorsCurrent, vendorsDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(vendorsResult.passed).toBe(true);

    // 5. Decision Simulator View
    await page.locator('[data-testid="tab-simulator"]').click();
    await expect(page.locator('text=Decision Impact Simulator').first()).toBeVisible();

    const simCurrent = path.join(currentDir, `simulator_${vpTag}.png`);
    const simBaseline = path.join(baselinesDir, `simulator_${vpTag}.png`);
    const simDiff = path.join(diffsDir, `simulator_${vpTag}_diff.png`);

    await page.screenshot({ path: simCurrent, fullPage: false });
    if (!fs.existsSync(simBaseline)) {
      fs.copyFileSync(simCurrent, simBaseline);
    }

    const simResult = comparePngFiles(simBaseline, simCurrent, simDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(simResult.passed).toBe(true);

    // 6. Also update the general viewport screenshot in artifacts/screenshots for evidence
    const generalEvidence = path.resolve(process.cwd(), `artifacts/screenshots/vowpilot_${vpTag}.png`);
    fs.copyFileSync(dashboardCurrent, generalEvidence);
    const afterEvidence = path.join(currentDir, `vowpilot_${vpTag}.png`);
    fs.copyFileSync(dashboardCurrent, afterEvidence);
  });

  test('Visual Regression: Interactive Needs Assessment Wizard Modal Dialog', async ({ page }) => {
    const viewport = page.viewportSize() || { width: 1440, height: 900 };
    const vpTag = `${viewport.width}x${viewport.height}`;

    // Click + New Event
    await page.locator('button:has-text("+ New Event")').click();
    await expect(page.locator('text=Define Event Foundation').first()).toBeVisible();

    const wizardCurrent = path.join(currentDir, `wizard_${vpTag}.png`);
    const wizardBaseline = path.join(baselinesDir, `wizard_${vpTag}.png`);
    const wizardDiff = path.join(diffsDir, `wizard_${vpTag}_diff.png`);

    await page.screenshot({ path: wizardCurrent, fullPage: false });
    if (!fs.existsSync(wizardBaseline)) {
      fs.copyFileSync(wizardCurrent, wizardBaseline);
    }

    const wizardResult = comparePngFiles(wizardBaseline, wizardCurrent, wizardDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(wizardResult.passed).toBe(true);

    await page.keyboard.press('Escape');
  });

  test('Visual Regression: Collaboration & Sharing Modal Dialog', async ({ page }) => {
    const viewport = page.viewportSize() || { width: 1440, height: 900 };
    const vpTag = `${viewport.width}x${viewport.height}`;

    // Click Collaborate button
    await page.locator('[data-testid="open-collab-btn"]').click();
    await expect(page.locator('text=Multi-User Event Collaboration').first()).toBeVisible();

    const collabCurrent = path.join(currentDir, `collab_${vpTag}.png`);
    const collabBaseline = path.join(baselinesDir, `collab_${vpTag}.png`);
    const collabDiff = path.join(diffsDir, `collab_${vpTag}_diff.png`);

    await page.screenshot({ path: collabCurrent, fullPage: false });
    if (!fs.existsSync(collabBaseline)) {
      fs.copyFileSync(collabCurrent, collabBaseline);
    }

    const collabResult = comparePngFiles(collabBaseline, collabCurrent, collabDiff, {
      maxDiffPercentage: 0.5,
    });
    expect(collabResult.passed).toBe(true);

    await page.keyboard.press('Escape');
  });
});
