import { test, expect } from '@playwright/test';

test.describe('VowPilot Vendor Communication & Email Delivery E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Provide authenticated token for server dispatch client in all viewports
    await page.addInitScript(() => {
      localStorage.setItem('vowpilot_auth_token', 'mock_jwt_test_token_authenticated');
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('E2E Email Flow 1: Open Clarification Draft, Customize Text, and Verify Server & Manual Controls', async ({
    page,
  }) => {
    // 1. Navigate to Vendors tab
    const vendorsTab = page.locator('[data-testid="tab-vendors"]');
    await vendorsTab.scrollIntoViewIfNeeded();
    await expect(vendorsTab).toBeVisible();
    await vendorsTab.click();

    // 2. Click "Draft Clarification" on first proposal
    const draftBtn = page.locator('[data-testid="draft-clarification-btn"]').first();
    await draftBtn.scrollIntoViewIfNeeded();
    await expect(draftBtn).toBeVisible();
    await draftBtn.click();

    // 3. Verify Modal Header and Details
    await expect(page.locator('text=Clarification Inquiry:')).toBeVisible();
    await expect(page.locator('text=Supplier Email:')).toBeVisible();

    // 4. Verify Textarea is Editable and Customize Content
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Customized Wedding Planner Note: Please confirm dietary menu options.');
    await expect(textarea).toHaveValue('Customized Wedding Planner Note: Please confirm dietary menu options.');

    // 5. Verify Controls: Copy, Launch Client (Manual Handoff), and Send via Server
    const copyBtn = page.locator('[data-testid="copy-draft-btn"]');
    await expect(copyBtn).toBeVisible();

    const manualBtn = page.locator('button:has-text("Launch Email Client")');
    await expect(manualBtn).toBeVisible();

    const serverBtn = page.locator('[data-testid="send-server-email-btn"]');
    await expect(serverBtn).toBeVisible();

    // 6. Click Manual Email Client Handoff and verify honest status display
    await manualBtn.click();
    await expect(page.locator('text=Client Launched & Logged')).toBeVisible();
    await expect(page.locator('text=Inquiry transferred to your local mail client')).toBeVisible();

    // 7. Verify draft message is preserved after manual handoff
    await expect(textarea).toHaveValue('Customized Wedding Planner Note: Please confirm dietary menu options.');
  });

  test('E2E Email Flow 2: Server Delivery Error Display & Draft Preservation with Retry Trigger', async ({
    page,
  }) => {
    // Intercept /api/vendors/dispatch-email to simulate a transient provider failure
    await page.route('**/api/vendors/dispatch-email', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'SMTP relay connection timeout: Upstream server unreachable after 3 attempts.',
          attempts: 3,
        }),
      });
    });

    // Navigate to Vendors tab and open modal
    const vendorsTab = page.locator('[data-testid="tab-vendors"]');
    await vendorsTab.scrollIntoViewIfNeeded();
    await vendorsTab.click();

    const draftBtn = page.locator('[data-testid="draft-clarification-btn"]').first();
    await draftBtn.scrollIntoViewIfNeeded();
    await draftBtn.click();

    // Custom text to ensure draft is preserved on failure
    const textarea = page.locator('textarea');
    const customMessage = 'Urgent: Verify guest capacity for the Sangeet hall.';
    await textarea.fill(customMessage);

    // Trigger server dispatch
    const serverBtn = page.locator('[data-testid="send-server-email-btn"]');
    await serverBtn.click();

    // Verify Truthful Error Banner is displayed
    await expect(page.locator('text=Dispatch Failed')).toBeVisible();
    await expect(
      page.locator('text=SMTP relay connection timeout: Upstream server unreachable after 3 attempts.')
    ).toBeVisible();
    await expect(page.locator('text=Your draft has been preserved below')).toBeVisible();

    // Verify Retry button is present in error banner
    const retryBtn = page.locator('button:has-text("Retry")');
    await expect(retryBtn).toBeVisible();

    // Verify Draft in textarea was strictly preserved
    await expect(textarea).toHaveValue(customMessage);
  });
});
