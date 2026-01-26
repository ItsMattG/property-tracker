// Basiq API Service
// Documentation: https://api.basiq.io/reference

const BASIQ_API_URL = process.env.BASIQ_SERVER_URL || "https://au-api.basiq.io";
const BASIQ_API_KEY = process.env.BASIQ_API_KEY;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

interface BasiqToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface BasiqUser {
  id: string;
  email: string;
}

interface BasiqConnection {
  id: string;
  status: string;
  institution: {
    id: string;
    name: string;
  };
}

interface BasiqAccount {
  id: string;
  name: string;
  accountNo: string;
  balance: string;
  availableFunds: string;
  currency: string;
  class: {
    type: string;
    product: string;
  };
  connection: string;
  institution: string;
}

interface BasiqTransaction {
  id: string;
  status: string;
  description: string;
  amount: string;
  account: string;
  balance: string;
  direction: "credit" | "debit";
  class: string;
  postDate: string;
  transactionDate: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

class BasiqService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (
      this.accessToken &&
      this.tokenExpiry &&
      this.tokenExpiry > new Date()
    ) {
      return this.accessToken;
    }

    if (!BASIQ_API_KEY) {
      throw new Error("BASIQ_API_KEY is not configured");
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
      throw new Error(`Failed to get Basiq access token: ${response.statusText}`);
    }

    const data: BasiqToken = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${BASIQ_API_URL}${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "basiq-version": "3.0",
            ...options.headers,
          },
        });

        if (!response.ok) {
          if (isRetryableError(response.status) && attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            await sleep(delay);
            continue;
          }

          const error = await response.text();
          throw new Error(`Basiq API error: ${response.statusText} - ${error}`);
        }

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on network errors, not on our thrown errors
        if (
          lastError.message.startsWith("Basiq API error:") ||
          attempt >= MAX_RETRIES - 1
        ) {
          throw lastError;
        }

        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    throw lastError || new Error("Request failed after max retries");
  }

  async createUser(email: string): Promise<BasiqUser> {
    return this.request<BasiqUser>("/users", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async getUser(userId: string): Promise<BasiqUser> {
    return this.request<BasiqUser>(`/users/${userId}`);
  }

  async createAuthLink(userId: string): Promise<{ links: { public: string } }> {
    return this.request(`/users/${userId}/auth_link`, {
      method: "POST",
    });
  }

  async getConnections(userId: string): Promise<{ data: BasiqConnection[] }> {
    return this.request(`/users/${userId}/connections`);
  }

  async getAccounts(userId: string): Promise<{ data: BasiqAccount[] }> {
    return this.request(`/users/${userId}/accounts`);
  }

  async getTransactions(
    userId: string,
    accountId?: string,
    fromDate?: string
  ): Promise<{ data: BasiqTransaction[] }> {
    const params = new URLSearchParams();
    if (accountId) params.append("filter[account.id]", accountId);
    if (fromDate) params.append("filter[transaction.postDate][gte]", fromDate);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/users/${userId}/transactions${query}`);
  }

  async refreshConnection(connectionId: string): Promise<BasiqConnection> {
    return this.request(`/connections/${connectionId}/refresh`, {
      method: "POST",
    });
  }
}

export const basiqService = new BasiqService();

export type {
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
};
