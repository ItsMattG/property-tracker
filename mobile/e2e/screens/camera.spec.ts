import { device, element, by, expect, waitFor } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';

describe('Camera Screen - Permission Granted', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', photos: 'YES' },
    });
    await loginAsTestUser();
    await navigateToTab('tab-camera');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows camera view when permission granted', async () => {
    await expect(element(by.id('camera-screen'))).toBeVisible();
    await expect(element(by.id('camera-view'))).toBeVisible();
  });

  it('shows capture button', async () => {
    await expect(element(by.id('capture-button'))).toBeVisible();
  });

  it('shows gallery picker button', async () => {
    await expect(element(by.id('gallery-button'))).toBeVisible();
  });

  it('shows preview after capture', async () => {
    await element(by.id('capture-button')).tap();

    await waitFor(element(by.id('preview-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('preview-image'))).toBeVisible();
  });

  it('allows retaking photo from preview', async () => {
    await element(by.id('retake-button')).tap();

    await expect(element(by.id('camera-screen'))).toBeVisible();
    await expect(element(by.id('camera-view'))).toBeVisible();
  });
});

describe('Camera Screen - Permission Denied', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'NO' },
    });
    await loginAsTestUser();
    await navigateToTab('tab-camera');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows permission request message when denied', async () => {
    await expect(element(by.id('permission-prompt'))).toBeVisible();
    await expect(element(by.text('Camera access is needed to capture documents'))).toBeVisible();
  });

  it('shows grant permission button', async () => {
    await expect(element(by.id('grant-permission-button'))).toBeVisible();
  });
});
