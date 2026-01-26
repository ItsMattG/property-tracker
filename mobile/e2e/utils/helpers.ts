import { device, element, by, expect, waitFor } from 'detox';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

export async function loginAsTestUser(): Promise<void> {
  await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
  await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
  await element(by.id('login-button')).tap();
  await waitFor(element(by.id('dashboard-screen')))
    .toBeVisible()
    .withTimeout(10000);
}

export async function logout(): Promise<void> {
  await element(by.id('tab-settings')).tap();
  await element(by.id('sign-out-button')).tap();
  await element(by.text('Sign Out')).tap();
  await expect(element(by.id('login-screen'))).toBeVisible();
}

export async function navigateToTab(tabId: string): Promise<void> {
  await element(by.id(tabId)).tap();
}

export async function waitForElement(testId: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function clearAndType(testId: string, text: string): Promise<void> {
  await element(by.id(testId)).clearText();
  await element(by.id(testId)).typeText(text);
}
