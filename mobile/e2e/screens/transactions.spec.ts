import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';
import { MOBILE_TEST_USER, API_BASE_URL } from '../fixtures/test-credentials';

describe('Transactions Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-transactions');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('Transaction List', () => {
    it('displays pending transactions for review', async () => {
      await expect(element(by.id('transactions-list'))).toBeVisible();
      await expect(element(by.id('transaction-card-0'))).toBeVisible();
    });

    it('shows transaction details', async () => {
      await expect(element(by.id('transaction-card-0-description'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-amount'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-date'))).toBeVisible();
    });

    it('displays suggested category with confidence', async () => {
      await expect(element(by.id('transaction-card-0-category'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-confidence'))).toBeVisible();
    });
  });

  describe('Swipe Gestures', () => {
    it('swipe right accepts the suggestion', async () => {
      const card = element(by.id('transaction-card-0'));
      await card.swipe('right', 'fast', 0.7);

      await waitFor(element(by.id('transaction-card-0')))
        .not.toBeVisible()
        .withTimeout(3000);
    });

    it('swipe left marks as personal', async () => {
      // After previous swipe, card-0 is now the next transaction
      const card = element(by.id('transaction-card-0'));
      await card.swipe('left', 'fast', 0.7);

      await waitFor(element(by.id('transaction-card-0')))
        .not.toBeVisible()
        .withTimeout(3000);
    });
  });
});

describe('Transactions Empty State', () => {
  beforeAll(async () => {
    await cleanupMobileTestData();
    // Seed user with no pending transactions
    await fetch(`${API_BASE_URL}/api/test/seed-mobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: MOBILE_TEST_USER.email,
        password: MOBILE_TEST_USER.password,
        name: MOBILE_TEST_USER.name,
        propertyCount: 1,
        pendingTransactionCount: 0,
      }),
    });
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-transactions');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows "All caught up!" when no pending reviews', async () => {
    await expect(element(by.id('transactions-empty'))).toBeVisible();
    await expect(element(by.text('All caught up!'))).toBeVisible();
  });
});
