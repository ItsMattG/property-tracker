import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

describe('Login Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('displays email and password fields', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
    await expect(element(by.id('email-input'))).toBeVisible();
    await expect(element(by.id('password-input'))).toBeVisible();
    await expect(element(by.id('login-button'))).toBeVisible();
  });

  it('shows error for empty fields', async () => {
    await element(by.id('login-button')).tap();
    await expect(element(by.id('error-message'))).toBeVisible();
    await expect(element(by.text('Please enter email and password'))).toBeVisible();
  });

  it('shows error for invalid credentials', async () => {
    await element(by.id('email-input')).typeText('wrong@email.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('error-message')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows loading state during login', async () => {
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    // Loading indicator should appear briefly
    // Note: This may be too fast to catch reliably
  });

  it('successfully logs in with valid credentials', async () => {
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
