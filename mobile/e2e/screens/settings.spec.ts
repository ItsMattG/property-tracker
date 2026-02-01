import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';

describe('Settings Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-settings');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('User Info Display', () => {
    it('displays user email', async () => {
      await expect(element(by.id('user-email'))).toBeVisible();
      await expect(element(by.text(MOBILE_TEST_USER.email))).toBeVisible();
    });

    it('displays user name', async () => {
      await expect(element(by.id('user-name'))).toBeVisible();
      await expect(element(by.text(MOBILE_TEST_USER.name))).toBeVisible();
    });
  });

  describe('Notification Toggle', () => {
    it('displays notification toggle switch', async () => {
      await expect(element(by.id('notifications-toggle'))).toBeVisible();
    });

    it('toggles notifications', async () => {
      await element(by.id('notifications-toggle')).tap();
      // Toggle state changed - API call made
      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
  });

  describe('Version Display', () => {
    it('shows app version', async () => {
      await expect(element(by.id('app-version'))).toBeVisible();
      await expect(element(by.text('BrickTrack Mobile v1.0.0'))).toBeVisible();
    });
  });

  describe('Sign Out', () => {
    it('displays sign out button', async () => {
      await expect(element(by.id('sign-out-button'))).toBeVisible();
    });

    it('shows confirmation dialog on sign out tap', async () => {
      await element(by.id('sign-out-button')).tap();

      await expect(element(by.text('Sign Out'))).toBeVisible();
      await expect(element(by.text('Cancel'))).toBeVisible();
    });

    it('cancels sign out when Cancel tapped', async () => {
      // Dialog should still be open from previous test
      await element(by.text('Cancel')).tap();

      await expect(element(by.id('settings-screen'))).toBeVisible();
    });

    it('signs out and returns to login when confirmed', async () => {
      await element(by.id('sign-out-button')).tap();
      await element(by.text('Sign Out')).atIndex(1).tap(); // The confirm button

      await waitFor(element(by.id('login-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
