/**
 * Basiq sandbox fixture for E2E tests.
 *
 * Creates a Basiq sandbox user before tests and cleans up after.
 * The sandbox has a 500 connection limit so cleanup is important.
 */

const BASIQ_API_URL = process.env.BASIQ_SERVER_URL || "https://au-api.basiq.io";
const BASIQ_API_KEY = process.env.BASIQ_API_KEY;

let cachedToken: { token: string; expiry: number } | null = null;

async function getBasiqToken(): Promise<string> {
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  if (!BASIQ_API_KEY) {
    throw new Error("BASIQ_API_KEY is not set - required for core-loop E2E tests");
  }

  const response = await fetch(`${BASIQ_API_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${BASIQ_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "basiq-version": "3.0",
    },
    body: "scope=SERVER_ACCESS",
  });

  if (!response.ok) {
    throw new Error(`Failed to get Basiq token: ${response.statusText}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export async function createSandboxUser(email: string): Promise<string> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "basiq-version": "3.0",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Basiq sandbox user: ${error}`);
  }

  const user = await response.json();
  return user.id;
}

export async function deleteSandboxUser(userId: string): Promise<void> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "basiq-version": "3.0",
    },
  });

  if (!response.ok) {
    console.warn(`Failed to delete Basiq sandbox user ${userId}: ${response.statusText}`);
  }
}

/**
 * Sandbox test credentials.
 * See: https://api.basiq.io/reference/testing
 */
export const sandboxCredentials = {
  /** Multi-income, personal loan */
  gavinBelson: { login: "gavinBelson", password: "hooli2016" },
  /** Multiple mortgages, rental income, 4 credit cards */
  richard: { login: "richard", password: "tabsnotspaces" },
  /** Joint account, dual income, mortgage */
  wentworthSmith: { login: "Wentworth-Smith", password: "whislter" },
  /** Error: Account is locked */
  bighead: { login: "bighead", password: "password" },
  /** Error: Requires user action */
  erlich: { login: "erlich", password: "aviato" },
  /** Error: Service unavailable */
  jianYang: { login: "jianYang", password: "nothotdog" },
} as const;
