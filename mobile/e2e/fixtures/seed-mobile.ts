import { MOBILE_TEST_USER, API_BASE_URL } from './test-credentials';

interface SeedResponse {
  user: { id: string; email: string };
  properties: Array<{ id: string; address: string }>;
  pendingTransactions: Array<{ id: string; description: string }>;
}

export async function seedMobileTestScenario(): Promise<SeedResponse> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-mobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: MOBILE_TEST_USER.email,
      password: MOBILE_TEST_USER.password,
      name: MOBILE_TEST_USER.name,
      propertyCount: 3,
      pendingTransactionCount: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Seed failed: ${response.status}`);
  }

  return response.json();
}

export async function cleanupMobileTestData(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/test/cleanup-mobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MOBILE_TEST_USER.email }),
  });

  if (!response.ok) {
    throw new Error(`Cleanup failed: ${response.status}`);
  }
}
