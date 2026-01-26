import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser } from '../utils/helpers';
import { MOBILE_TEST_USER, API_BASE_URL } from '../fixtures/test-credentials';

describe('Dashboard Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('Stats Cards', () => {
    it('displays property count card', async () => {
      await expect(element(by.id('stats-property-count'))).toBeVisible();
      await expect(element(by.text('3'))).toBeVisible();
    });

    it('displays uncategorized transaction count', async () => {
      await expect(element(by.id('stats-uncategorized-count'))).toBeVisible();
    });
  });

  describe('Property List', () => {
    it('displays all seeded properties', async () => {
      await expect(element(by.id('property-list'))).toBeVisible();
      await expect(element(by.id('property-item-0'))).toBeVisible();
    });

    it('shows property details', async () => {
      await expect(element(by.id('property-address-0'))).toBeVisible();
      await expect(element(by.id('property-location-0'))).toBeVisible();
      await expect(element(by.id('property-price-0'))).toBeVisible();
    });

    it('scrolls to reveal more properties', async () => {
      await element(by.id('dashboard-screen')).scroll(200, 'down');
      await expect(element(by.id('property-item-1'))).toBeVisible();
    });
  });

  describe('Pull to Refresh', () => {
    it('refreshes data when pulled down', async () => {
      await element(by.id('dashboard-screen')).swipe('down', 'slow', 0.5);
      // Data should reload - verify list still visible
      await waitFor(element(by.id('property-list')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});

describe('Dashboard Empty State', () => {
  beforeAll(async () => {
    await cleanupMobileTestData();
    // Seed user with no properties
    await fetch(`${API_BASE_URL}/api/test/seed-mobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: MOBILE_TEST_USER.email,
        password: MOBILE_TEST_USER.password,
        name: MOBILE_TEST_USER.name,
        propertyCount: 0,
        pendingTransactionCount: 0,
      }),
    });
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows empty state when no properties exist', async () => {
    await expect(element(by.id('empty-state'))).toBeVisible();
    await expect(element(by.text('No properties yet'))).toBeVisible();
  });
});
