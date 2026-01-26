import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

describe('Complete User Journey', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', photos: 'YES' },
    });
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('completes full app workflow', async () => {
    // 1. LOGIN
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // 2. VIEW DASHBOARD
    await expect(element(by.id('stats-property-count'))).toBeVisible();
    await expect(element(by.id('property-list'))).toBeVisible();

    // 3. REVIEW TRANSACTIONS
    await element(by.id('tab-transactions')).tap();
    await expect(element(by.id('transactions-list'))).toBeVisible();

    // Accept first transaction
    await element(by.id('transaction-card-0')).swipe('right', 'fast', 0.7);
    await waitFor(element(by.id('transaction-card-0')))
      .not.toBeVisible()
      .withTimeout(3000);

    // Reject second transaction (now at index 0)
    await element(by.id('transaction-card-0')).swipe('left', 'fast', 0.7);

    // 4. CAPTURE DOCUMENT
    await element(by.id('tab-camera')).tap();
    await expect(element(by.id('camera-view'))).toBeVisible();
    await element(by.id('capture-button')).tap();

    await waitFor(element(by.id('preview-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Go back to camera (don't upload in journey test)
    await element(by.id('retake-button')).tap();

    // 5. CHECK SETTINGS
    await element(by.id('tab-settings')).tap();
    await expect(element(by.text(MOBILE_TEST_USER.email))).toBeVisible();
    await expect(element(by.id('notifications-toggle'))).toBeVisible();

    // 6. SIGN OUT
    await element(by.id('sign-out-button')).tap();
    await element(by.text('Sign Out')).atIndex(1).tap();

    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
