import { test, expect } from '@playwright/test';

test.describe('VowPilot Comprehensive User Journeys & End-to-End Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean slate
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Journey 1: Interactive Needs Assessment Wizard Lifecycle (Validation, Plan Generation & Reload Persistence)', async ({
    page,
  }) => {
    // 1. Initial State: Verify initial brand and default demo title
    await expect(page.locator('text=VowPilot').first()).toBeVisible();

    // 2. Open New Event Wizard
    const newEventBtn = page.getByRole('button', { name: /\+ New Event/i });
    await expect(newEventBtn).toBeVisible();
    await newEventBtn.click();

    await expect(page.locator('text=Interactive Needs Assessment')).toBeVisible();
    await expect(page.locator('text=Step 1 of 5')).toBeVisible();

    // 3. Validation: Try advancing with empty title
    const nextBtn = page.getByRole('button', { name: /Next Step/i });
    await nextBtn.click();
    await expect(page.locator('text=Event title is required.')).toBeVisible();

    // Try entering a past date
    const dateInput = page.locator('#wizard-event-date');
    await dateInput.fill('2020-01-01');
    await nextBtn.click();
    await expect(page.locator('text=Event date cannot be in the past.')).toBeVisible();

    // Try entering invalid guest count
    const guestsInput = page.locator('#wizard-event-guests');
    await guestsInput.fill('0');
    await nextBtn.click();
    await expect(page.locator('text=Guest count must be at least 1.')).toBeVisible();

    // 4. Fill valid parameters
    const nameInput = page.locator('#wizard-event-name');
    await nameInput.fill("Maya & Vikram's Royal Destination Wedding");

    // Set future date (e.g. 2027-12-15)
    await dateInput.fill('2027-12-15');

    const locInput = page.locator('#wizard-event-location');
    await locInput.fill('Udaipur Heritage Palace');

    await guestsInput.fill('220');

    const budgetInput = page.locator('#wizard-event-budget');
    await budgetInput.fill('3500000');

    // 5. Advance through Steps
    // Step 1 -> Step 2
    await nextBtn.click();
    await expect(page.locator('text=Step 2 of 5')).toBeVisible();
    await expect(page.locator('text=Dining & Aesthetics')).toBeVisible();

    // Step 2 -> Step 3
    await nextBtn.click();
    await expect(page.locator('text=Step 3 of 5')).toBeVisible();
    await expect(page.locator('text=Venue & Accessibility')).toBeVisible();

    // Step 3 -> Step 4
    await nextBtn.click();
    await expect(page.locator('text=Step 4 of 5')).toBeVisible();
    await expect(page.locator('text=Priority Ranking')).toBeVisible();

    // Step 4 -> Step 5
    await nextBtn.click();
    await expect(page.locator('text=Step 5 of 5')).toBeVisible();
    await expect(page.locator('text=Plan Review & Confirmation')).toBeVisible();

    // 6. Submit and generate actionable plan
    const generateBtn = page.getByRole('button', { name: /Generate Actionable Plan/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // 7. Verify Successful Completion: Modal closes and Dashboard reflects new event
    await expect(page.locator('text=Interactive Needs Assessment')).not.toBeVisible();
    await expect(page.locator('h1').first()).toContainText("Maya & Vikram's Royal Destination Wedding");

    const isMobile = (page.viewportSize()?.width || 1280) < 768;
    if (!isMobile) {
      await expect(page.locator('text=220 Guests').first()).toBeVisible();
    }

    // 8. Revisit / Refresh Persistence Verification
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1').first()).toContainText("Maya & Vikram's Royal Destination Wedding");
    if (!isMobile) {
      await expect(page.locator('text=220 Guests').first()).toBeVisible();
    }
  });

  test('Journey 2: Event Settings Editing, Constraints Updating & Persistence', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width || 1280) < 768;

    // 1. Navigate to Settings Tab
    const settingsTab = page.locator('[data-testid="tab-settings"]');
    await settingsTab.scrollIntoViewIfNeeded();
    await settingsTab.click();

    await expect(page.locator('text=Event Settings & Local Data Management')).toBeVisible();

    // 2. Edit Event Constraints
    const nameInput = page.locator('#settings-event-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Maya & Vikram's Royal Palace Gala");

    const locInput = page.locator('#settings-event-location');
    await locInput.fill('Lake Pichola, Udaipur');

    // 3. Save Settings
    const saveBtn = page.getByRole('button', { name: /Save Constraint Changes/i });
    await saveBtn.click();

    // 4. Verify confirmation banner
    await expect(
      page.locator('text=Event preferences and budget constraints successfully saved!')
    ).toBeVisible();

    // 5. Verify live update in Settings and Header
    await expect(nameInput).toHaveValue("Maya & Vikram's Royal Palace Gala");
    if (!isMobile) {
      await expect(page.locator("text=Maya & Vikram's Royal Palace Gala").first()).toBeVisible();
    }

    // 6. Refresh page and verify persistence in Settings
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const settingsTabAfterReload = page.locator('[data-testid="tab-settings"]');
    await settingsTabAfterReload.scrollIntoViewIfNeeded();
    await settingsTabAfterReload.click();

    await expect(page.locator('#settings-event-name')).toHaveValue("Maya & Vikram's Royal Palace Gala");
    if (!isMobile) {
      await expect(page.locator("text=Maya & Vikram's Royal Palace Gala").first()).toBeVisible();
    }
  });

  test('Journey 3: Task Management Execution, Status Progression & Toggle Persistence', async ({ page }) => {
    // 1. Navigate to Tasks Tab
    const tasksTab = page.locator('[data-testid="tab-tasks"]');
    await tasksTab.scrollIntoViewIfNeeded();
    await tasksTab.click();

    await expect(page.locator('text=Tasks & Dependency Graph').first()).toBeVisible();

    // 2. Find an uncompleted task button
    const completeBtn = page.getByRole('button', { name: /Complete task:/i }).first();
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // 3. Verify task status progressed to completed (button aria-label changes to Reopen task:)
    const reopenBtn = page.getByRole('button', { name: /Reopen task:/i }).first();
    await expect(reopenBtn).toBeVisible();

    // 4. Refresh page and verify completed state persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const tasksTabAfterReload = page.locator('[data-testid="tab-tasks"]');
    await tasksTabAfterReload.scrollIntoViewIfNeeded();
    await tasksTabAfterReload.click();

    await expect(page.getByRole('button', { name: /Reopen task:/i }).first()).toBeVisible();

    // 5. Reopen the task and verify state toggles back
    const reopenBtnAfterReload = page.getByRole('button', { name: /Reopen task:/i }).first();
    await reopenBtnAfterReload.click();
    await expect(page.getByRole('button', { name: /Complete task:/i }).first()).toBeVisible();
  });

  test('Journey 4: Vendor Quotation Comparison, Selection & State Sync', async ({ page }) => {
    // 1. Navigate to Vendors Tab
    const vendorsTab = page.locator('[data-testid="tab-vendors"]');
    await vendorsTab.scrollIntoViewIfNeeded();
    await vendorsTab.click();

    await expect(page.locator('text=Vendor Directory & Quotation Matrix').first()).toBeVisible();

    // 2. Select Catering category tab to inspect competing quotations
    const cateringTab = page.getByRole('button', { name: /Catering/i });
    await cateringTab.scrollIntoViewIfNeeded();
    await cateringTab.click();

    // 3. Find an unselected proposal button in Catering
    const selectBtn = page.getByRole('button', { name: /Select proposal from/i }).first();
    await selectBtn.scrollIntoViewIfNeeded();
    await expect(selectBtn).toBeVisible();
    await selectBtn.click();

    // 4. Verify proposal status changes to currently selected
    await expect(page.getByRole('button', { name: /Proposal currently selected/i }).first()).toBeVisible();

    // 5. Reload page and verify selection persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const vendorsTabAfterReload = page.locator('[data-testid="tab-vendors"]');
    await vendorsTabAfterReload.scrollIntoViewIfNeeded();
    await vendorsTabAfterReload.click();

    const cateringTabAfterReload = page.getByRole('button', { name: /Catering/i });
    await cateringTabAfterReload.scrollIntoViewIfNeeded();
    await cateringTabAfterReload.click();

    await expect(page.getByRole('button', { name: /Proposal currently selected/i }).first()).toBeVisible();
  });

  test('Journey 5: AI Assistant Grounded Query & Context-Aware State Mutation', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width || 1280) < 768;

    // 1. Navigate to Assistant Tab
    const assistantTab = page.locator('[data-testid="tab-assistant"]');
    await assistantTab.scrollIntoViewIfNeeded();
    await assistantTab.click();

    await expect(page.locator('text=Context-Aware Planning Coordinator').first()).toBeVisible();

    // 2. Type state mutation command: "Change guest count to 175"
    const input = page.locator('#assistant-prompt-input');
    await expect(input).toBeVisible();
    await input.fill('Change guest count to 175');

    const sendBtn = page.locator('button[aria-label="Ask: Send planning command"]');
    await sendBtn.click();

    // 3. Verify assistant calculates financial impact and offers proposed action
    await expect(page.locator('text=Impact Analysis: Guest Count Adjustment').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=Update guest count to 175')).toBeVisible();

    // 4. Confirm and Apply the proposed action
    const applyBtn = page.getByRole('button', { name: /Confirm and apply proposed action/i });
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // 5. Verify action is applied and Header updates live
    await expect(page.locator('text=✓ Applied')).toBeVisible();
    await expect(page.locator('text=Update guest count to 175').first()).toBeVisible();
    if (!isMobile) {
      await expect(page.locator('text=175 Guests').first()).toBeVisible();
    }
  });

  test('Journey 6: Negative Testing & Graceful Recovery from Corrupted Local Storage', async ({ page }) => {
    // 1. Inject malformed JSON into storage
    await page.evaluate(() => {
      localStorage.setItem('vowpilot_state_v1', '{corrupted_malformed_json: true');
    });

    // 2. Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 3. Verify the app gracefully catches the error and recovers without crashing
    await expect(page.locator('text=VowPilot').first()).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('h1').first()).toContainText("Aarav & Meera's Wedding Celebration");

    // 4. Verify user can interact normally after recovery
    const budgetTab = page.locator('[data-testid="tab-budget"]');
    await budgetTab.scrollIntoViewIfNeeded();
    await budgetTab.click();
    await expect(page.locator('text=Budget & Trade-Off Planner').first()).toBeVisible();
  });

  test('Journey 7: Responsive Layout, Zero Horizontal Overflow & Modal Keyboard Dismissal', async ({
    page,
  }) => {
    // 1. Check for zero horizontal overflow on page body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow, 'Page should not have horizontal overflow').toBe(false);

    // 2. Open modal and test Escape key dismissal
    const newEventBtn = page.getByRole('button', { name: /\+ New Event/i });
    await newEventBtn.click();
    await expect(page.locator('text=Interactive Needs Assessment')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Interactive Needs Assessment')).not.toBeVisible();
  });
});
