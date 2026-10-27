import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    collaborationClient?: {
      state: {
        role?: string;
        status?: string;
        lastConflict?: {
          expectedVersion: number;
          currentVersion: number;
          lastModifiedBy: string;
          serverState: unknown;
        };
      };
      notify: () => void;
    };
  }
}

test.describe('VowPilot Multi-User Collaboration & Browser-Level Verification', () => {
  test('E2E Collaboration Flow 1: Header Collaboration Pill & Modal Controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify collaboration pill exists in the header
    const collabBadge = page.locator('[data-testid="collab-status-badge"]');
    await expect(collabBadge).toBeVisible();

    // 2. Click "Collaborate" button in header
    const collabBtn = page.locator('[data-testid="open-collab-btn"]');
    await expect(collabBtn).toBeVisible();
    await collabBtn.click();

    // 3. Modal opens with title and sections
    await expect(page.locator('text=Multi-User Event Collaboration')).toBeVisible();
    await expect(page.locator('text=Celebration Collaborators')).toBeVisible();
    await expect(page.locator('text=Invite New Collaborator')).toBeVisible();
    await expect(page.locator('text=Redeem / Preview Invitation Token')).toBeVisible();

    // 4. Verify role options (Editor, Viewer)
    await expect(page.locator('option[value="editor"]')).toHaveText('Editor (Can edit budget, tasks & vendors)');
    await expect(page.locator('option[value="viewer"]')).toHaveText('Viewer (Read-only observation)');

    // 5. Verify duration options
    const durationSelect = page.locator('select#invite-duration');
    await expect(durationSelect).toBeVisible();
  });

  test('E2E Collaboration Flow 2: Multi-Browser Context Invitation Inspection & Token Entry', async ({
    browser,
  }) => {
    // Context A (Owner context)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/');
    await pageA.waitForLoadState('domcontentloaded');

    // Open collaboration modal
    await pageA.locator('[data-testid="open-collab-btn"]').click();
    await expect(pageA.locator('text=Multi-User Event Collaboration')).toBeVisible();

    // Context B (Separate, independent browser context for invitee)
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Invitee deep-links directly via URL with inviteToken query parameter
    await pageB.goto('/?inviteToken=inv_test_deep_link_token');
    await pageB.waitForLoadState('domcontentloaded');

    // Verify modal opens automatically due to query parameter
    await expect(pageB.locator('text=Multi-User Event Collaboration')).toBeVisible();

    // Verify token prefilled in the input
    const tokenInput = pageB.locator('#join-token-input');
    await expect(tokenInput).toHaveValue('inv_test_deep_link_token');

    await contextA.close();
    await contextB.close();
  });

  test('E2E Collaboration Flow 3: Viewer Read-Only Enforcement Across UI Views', async ({ page }) => {
    // Simulate viewer session state in browser localStorage
    await page.addInitScript(() => {
      localStorage.setItem('vowpilot_auth_token', 'mock_viewer_jwt_token');
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Set viewer role directly on collaboration client in the browser runtime
    await page.evaluate(() => {
      const client = window.collaborationClient;
      if (client) {
        client.state.role = 'viewer';
        client.state.status = 'synced';
        client.notify();
      }
    });

    // 1. Test Budget Planner tab
    await page.locator('[data-testid="tab-budget"]').click();
    await expect(page.locator('text=Budget & Trade-Off Planner')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-readonly-banner"]')).toBeVisible();
    await expect(page.locator('text=Read-Only Mode')).toBeVisible();

    // 2. Test Tasks tab
    await page.locator('[data-testid="tab-tasks"]').click();
    await expect(page.locator('text=Tasks & Dependency Graph')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-readonly-banner"]')).toBeVisible();

    // 3. Test Vendors tab
    await page.locator('[data-testid="tab-vendors"]').click();
    await expect(page.locator('text=Vendor Directory & Quotation Matrix')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-readonly-banner"]')).toBeVisible();
  });

  test('E2E Collaboration Flow 4: OCC Concurrency Conflict Modal UI Rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Inject simulated conflict state to verify UI rendering of ConflictModal
    await page.evaluate(() => {
      const defaultSampleState = {
        event: { name: 'Jaipur Palace Wedding', guestCount: 350 },
        expenses: [],
        tasks: [],
      };
      let sampleState: unknown = defaultSampleState;
      try {
        const stored = localStorage.getItem('vowpilot_jaipur_wedding_v1');
        const parsed = JSON.parse(stored || '{}') as { state?: unknown };
        sampleState = parsed?.state || defaultSampleState;
      } catch {
        sampleState = defaultSampleState;
      }

      const client = window.collaborationClient;
      if (client) {
        client.state.status = 'conflict';
        client.state.lastConflict = {
          expectedVersion: 1,
          currentVersion: 2,
          lastModifiedBy: 'Senior Coordinator Meera',
          serverState: sampleState,
        };
        client.notify();
      }
    });

    // Verify explicit conflict options in modal
    await expect(page.locator('text=Concurrent Modification Conflict')).toBeVisible();
    await expect(page.locator('text=Accept Server Version (Recommended)')).toBeVisible();
    await expect(page.locator('text=Re-apply My Changes')).toBeVisible();
  });
});
