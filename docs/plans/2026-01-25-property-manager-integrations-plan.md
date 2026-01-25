# Property Manager Integrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate with PropertyMe to auto-import rent receipts, maintenance invoices, and bills, reducing duplicate data entry for managed properties.

**Architecture:** Provider abstraction layer with PropertyMe as first implementation. OAuth 2.0 for authentication, property mapping UI for linking PM properties to PropertyTracker properties, sync service for pulling and deduplicating transactions.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, PostgreSQL, PropertyMe OAuth 2.0 API

---

## Task 1: Add Property Manager Database Enums

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add the provider enum and connection status enum**

Add after `transactionStatusEnum` (around line 253):

```typescript
export const propertyManagerProviderEnum = pgEnum("property_manager_provider", [
  "propertyme",
  "different",
]);

export const pmConnectionStatusEnum = pgEnum("pm_connection_status", [
  "active",
  "expired",
  "revoked",
]);

export const pmSyncTypeEnum = pgEnum("pm_sync_type", [
  "full",
  "incremental",
  "manual",
]);

export const pmSyncStatusEnum = pgEnum("pm_sync_status", [
  "running",
  "completed",
  "failed",
]);
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add property manager enums"
```

---

## Task 2: Add Property Manager Tables

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add propertyManagerConnections table**

Add after the documentExtractions table:

```typescript
export const propertyManagerConnections = pgTable("property_manager_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: propertyManagerProviderEnum("provider").notNull(),
  providerUserId: text("provider_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array(),
  status: pmConnectionStatusEnum("status").default("active").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 2: Add propertyManagerMappings table**

```typescript
export const propertyManagerMappings = pgTable("property_manager_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  providerPropertyId: text("provider_property_id").notNull(),
  providerPropertyAddress: text("provider_property_address"),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  autoSync: boolean("auto_sync").default(true).notNull(),
  metadata: text("metadata"), // JSON string for lease/tenant info
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 3: Add propertyManagerSyncLogs table**

```typescript
export const propertyManagerSyncLogs = pgTable("property_manager_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  syncType: pmSyncTypeEnum("sync_type").notNull(),
  status: pmSyncStatusEnum("status").notNull(),
  itemsSynced: decimal("items_synced", { precision: 10, scale: 0 }).default("0"),
  transactionsCreated: decimal("transactions_created", { precision: 10, scale: 0 }).default("0"),
  errors: text("errors"), // JSON string
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

**Step 4: Add provider columns to transactions table**

Find the transactions table definition and add these columns after `suggestionStatus`:

```typescript
    providerTransactionId: text("provider_transaction_id"),
    provider: text("provider"),
```

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add property manager tables and transaction provider columns"
```

---

## Task 3: Add Property Manager Relations

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add relations for propertyManagerConnections**

Add after the documentExtractionsRelations:

```typescript
export const propertyManagerConnectionsRelations = relations(
  propertyManagerConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [propertyManagerConnections.userId],
      references: [users.id],
    }),
    mappings: many(propertyManagerMappings),
    syncLogs: many(propertyManagerSyncLogs),
  })
);

export const propertyManagerMappingsRelations = relations(
  propertyManagerMappings,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerMappings.connectionId],
      references: [propertyManagerConnections.id],
    }),
    property: one(properties, {
      fields: [propertyManagerMappings.propertyId],
      references: [properties.id],
    }),
  })
);

export const propertyManagerSyncLogsRelations = relations(
  propertyManagerSyncLogs,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerSyncLogs.connectionId],
      references: [propertyManagerConnections.id],
    }),
  })
);
```

**Step 2: Export types**

Add to the type exports section:

```typescript
export type PropertyManagerConnection = typeof propertyManagerConnections.$inferSelect;
export type NewPropertyManagerConnection = typeof propertyManagerConnections.$inferInsert;
export type PropertyManagerMapping = typeof propertyManagerMappings.$inferSelect;
export type NewPropertyManagerMapping = typeof propertyManagerMappings.$inferInsert;
export type PropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferSelect;
export type NewPropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferInsert;
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add property manager relations and type exports"
```

---

## Task 4: Create Property Manager Provider Interface

**Files:**
- Create: `src/server/services/property-manager/types.ts`
- Test: `src/server/services/property-manager/__tests__/types.test.ts`

**Step 1: Create the types file**

```typescript
// src/server/services/property-manager/types.ts

export interface PMProperty {
  id: string;
  address: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  status: "active" | "archived";
}

export interface PMTenancy {
  id: string;
  propertyId: string;
  tenantName: string;
  tenantEmail?: string;
  leaseStart: string;
  leaseEnd?: string;
  rentAmount: number;
  rentFrequency: "weekly" | "fortnightly" | "monthly";
}

export interface PMRentPayment {
  id: string;
  propertyId: string;
  tenancyId: string;
  amount: number;
  date: string;
  description: string;
}

export interface PMMaintenanceJob {
  id: string;
  propertyId: string;
  description: string;
  amount: number;
  date: string;
  supplierName?: string;
  status: "pending" | "completed" | "cancelled";
}

export interface PMBill {
  id: string;
  propertyId: string;
  description: string;
  amount: number;
  date: string;
  dueDate?: string;
  category?: string;
}

export interface PropertyManagerProvider {
  name: string;

  // OAuth
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    userId?: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;

  // Data fetching
  getProperties(accessToken: string): Promise<PMProperty[]>;
  getTenancies(accessToken: string, propertyId?: string): Promise<PMTenancy[]>;
  getRentPayments(accessToken: string, since?: Date): Promise<PMRentPayment[]>;
  getMaintenanceJobs(accessToken: string, since?: Date): Promise<PMMaintenanceJob[]>;
  getBills(accessToken: string, since?: Date): Promise<PMBill[]>;
}
```

**Step 2: Create test file**

```typescript
// src/server/services/property-manager/__tests__/types.test.ts

import { describe, it, expect } from "vitest";
import type { PMProperty, PMRentPayment, PropertyManagerProvider } from "../types";

describe("Property Manager Types", () => {
  it("PMProperty has required fields", () => {
    const property: PMProperty = {
      id: "123",
      address: "123 Test St",
      status: "active",
    };
    expect(property.id).toBe("123");
    expect(property.status).toBe("active");
  });

  it("PMRentPayment has required fields", () => {
    const payment: PMRentPayment = {
      id: "p1",
      propertyId: "123",
      tenancyId: "t1",
      amount: 500,
      date: "2026-01-25",
      description: "Weekly rent",
    };
    expect(payment.amount).toBe(500);
  });

  it("PropertyManagerProvider interface is valid", () => {
    // Type check only - ensure interface compiles
    const checkInterface = (provider: PropertyManagerProvider) => {
      expect(provider.name).toBeDefined();
    };
    expect(checkInterface).toBeDefined();
  });
});
```

**Step 3: Run test to verify it passes**

Run: `npx vitest run src/server/services/property-manager/__tests__/types.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/services/property-manager/
git commit -m "feat(service): add property manager provider interface and types"
```

---

## Task 5: Create PropertyMe Provider Service

**Files:**
- Create: `src/server/services/property-manager/propertyme.ts`
- Test: `src/server/services/property-manager/__tests__/propertyme.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/property-manager/__tests__/propertyme.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropertyMeProvider } from "../propertyme";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PropertyMeProvider", () => {
  let provider: PropertyMeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PropertyMeProvider({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    });
  });

  describe("getAuthUrl", () => {
    it("returns valid OAuth URL", () => {
      const url = provider.getAuthUrl("http://localhost/callback", "state123");
      expect(url).toContain("oauth.propertyme.com");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=state123");
    });
  });

  describe("getProperties", () => {
    it("fetches and transforms properties", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "lot-1",
              Address: { FullAddress: "123 Test St, Sydney NSW 2000" },
              Status: "Active",
            },
          ],
        }),
      });

      const properties = await provider.getProperties("access-token");

      expect(properties).toHaveLength(1);
      expect(properties[0].id).toBe("lot-1");
      expect(properties[0].address).toBe("123 Test St, Sydney NSW 2000");
      expect(properties[0].status).toBe("active");
    });
  });

  describe("getRentPayments", () => {
    it("fetches and transforms rent payments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Id: "payment-1",
              LotId: "lot-1",
              TenancyId: "tenancy-1",
              Amount: 500.0,
              Date: "2026-01-25",
              Description: "Rent payment",
            },
          ],
        }),
      });

      const payments = await provider.getRentPayments("access-token");

      expect(payments).toHaveLength(1);
      expect(payments[0].id).toBe("payment-1");
      expect(payments[0].amount).toBe(500);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/property-manager/__tests__/propertyme.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```typescript
// src/server/services/property-manager/propertyme.ts

import type {
  PropertyManagerProvider,
  PMProperty,
  PMTenancy,
  PMRentPayment,
  PMMaintenanceJob,
  PMBill,
} from "./types";

const PROPERTYME_AUTH_URL = "https://oauth.propertyme.com/authorize";
const PROPERTYME_TOKEN_URL = "https://oauth.propertyme.com/token";
const PROPERTYME_API_URL = "https://app.propertyme.com/api/v1";

interface PropertyMeConfig {
  clientId: string;
  clientSecret: string;
}

export class PropertyMeProvider implements PropertyManagerProvider {
  name = "propertyme";
  private clientId: string;
  private clientSecret: string;

  constructor(config: PropertyMeConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "property activity contact transaction",
      state,
    });
    return `${PROPERTYME_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string) {
    const response = await fetch(PROPERTYME_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      userId: data.user_id,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch(PROPERTYME_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  private async apiRequest<T>(accessToken: string, endpoint: string): Promise<T> {
    const response = await fetch(`${PROPERTYME_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`PropertyMe API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getProperties(accessToken: string): Promise<PMProperty[]> {
    const response = await this.apiRequest<{ data: Array<{
      Id: string;
      Address: { FullAddress: string };
      Status: string;
    }> }>(accessToken, "/lots");

    return response.data.map((lot) => ({
      id: lot.Id,
      address: lot.Address.FullAddress,
      status: lot.Status.toLowerCase() === "active" ? "active" : "archived",
    }));
  }

  async getTenancies(accessToken: string): Promise<PMTenancy[]> {
    const response = await this.apiRequest<{ data: Array<{
      Id: string;
      LotId: string;
      TenantName: string;
      TenantEmail?: string;
      LeaseStart: string;
      LeaseEnd?: string;
      RentAmount: number;
      RentFrequency: string;
    }> }>(accessToken, "/tenancies");

    return response.data.map((t) => ({
      id: t.Id,
      propertyId: t.LotId,
      tenantName: t.TenantName,
      tenantEmail: t.TenantEmail,
      leaseStart: t.LeaseStart,
      leaseEnd: t.LeaseEnd,
      rentAmount: t.RentAmount,
      rentFrequency: this.mapFrequency(t.RentFrequency),
    }));
  }

  async getRentPayments(accessToken: string, since?: Date): Promise<PMRentPayment[]> {
    let endpoint = "/tenancies/balances";
    if (since) {
      endpoint += `?since=${since.toISOString()}`;
    }

    const response = await this.apiRequest<{ data: Array<{
      Id: string;
      LotId: string;
      TenancyId: string;
      Amount: number;
      Date: string;
      Description: string;
    }> }>(accessToken, endpoint);

    return response.data.map((p) => ({
      id: p.Id,
      propertyId: p.LotId,
      tenancyId: p.TenancyId,
      amount: p.Amount,
      date: p.Date,
      description: p.Description,
    }));
  }

  async getMaintenanceJobs(accessToken: string, since?: Date): Promise<PMMaintenanceJob[]> {
    let endpoint = "/jobtasks";
    if (since) {
      endpoint += `?since=${since.toISOString()}`;
    }

    const response = await this.apiRequest<{ data: Array<{
      Id: string;
      LotId: string;
      Description: string;
      Amount: number;
      Date: string;
      SupplierName?: string;
      Status: string;
    }> }>(accessToken, endpoint);

    return response.data.map((j) => ({
      id: j.Id,
      propertyId: j.LotId,
      description: j.Description,
      amount: j.Amount,
      date: j.Date,
      supplierName: j.SupplierName,
      status: this.mapJobStatus(j.Status),
    }));
  }

  async getBills(accessToken: string, since?: Date): Promise<PMBill[]> {
    let endpoint = "/bills";
    if (since) {
      endpoint += `?since=${since.toISOString()}`;
    }

    const response = await this.apiRequest<{ data: Array<{
      Id: string;
      LotId: string;
      Description: string;
      Amount: number;
      Date: string;
      DueDate?: string;
      Category?: string;
    }> }>(accessToken, endpoint);

    return response.data.map((b) => ({
      id: b.Id,
      propertyId: b.LotId,
      description: b.Description,
      amount: b.Amount,
      date: b.Date,
      dueDate: b.DueDate,
      category: b.Category,
    }));
  }

  private mapFrequency(freq: string): "weekly" | "fortnightly" | "monthly" {
    const lower = freq.toLowerCase();
    if (lower.includes("week")) return "weekly";
    if (lower.includes("fortnight")) return "fortnightly";
    return "monthly";
  }

  private mapJobStatus(status: string): "pending" | "completed" | "cancelled" {
    const lower = status.toLowerCase();
    if (lower.includes("complet")) return "completed";
    if (lower.includes("cancel")) return "cancelled";
    return "pending";
  }
}

// Singleton instance
let providerInstance: PropertyMeProvider | null = null;

export function getPropertyMeProvider(): PropertyMeProvider {
  if (!providerInstance) {
    providerInstance = new PropertyMeProvider({
      clientId: process.env.PROPERTYME_CLIENT_ID || "",
      clientSecret: process.env.PROPERTYME_CLIENT_SECRET || "",
    });
  }
  return providerInstance;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/property-manager/__tests__/propertyme.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/property-manager/
git commit -m "feat(service): add PropertyMe provider implementation"
```

---

## Task 6: Create Property Manager Sync Service

**Files:**
- Create: `src/server/services/property-manager/sync.ts`
- Test: `src/server/services/property-manager/__tests__/sync.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/property-manager/__tests__/sync.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PropertyManagerSyncService } from "../sync";
import type { PropertyManagerProvider, PMRentPayment } from "../types";

describe("PropertyManagerSyncService", () => {
  const mockProvider: PropertyManagerProvider = {
    name: "mock",
    getAuthUrl: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    refreshAccessToken: vi.fn(),
    getProperties: vi.fn(),
    getTenancies: vi.fn(),
    getRentPayments: vi.fn(),
    getMaintenanceJobs: vi.fn(),
    getBills: vi.fn(),
  };

  const mockDb = {
    query: {
      propertyManagerMappings: {
        findMany: vi.fn(),
      },
      transactions: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "tx-1" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  let syncService: PropertyManagerSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    syncService = new PropertyManagerSyncService(mockProvider, mockDb as any);
  });

  describe("syncRentPayments", () => {
    it("creates transactions for new rent payments", async () => {
      const mockPayments: PMRentPayment[] = [
        {
          id: "payment-1",
          propertyId: "pm-prop-1",
          tenancyId: "t1",
          amount: 500,
          date: "2026-01-25",
          description: "Weekly rent",
        },
      ];

      vi.mocked(mockProvider.getRentPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue(null);

      const result = await syncService.syncRentPayments("access-token", "conn-1", "user-1");

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("skips existing transactions (deduplication)", async () => {
      const mockPayments: PMRentPayment[] = [
        {
          id: "payment-1",
          propertyId: "pm-prop-1",
          tenancyId: "t1",
          amount: 500,
          date: "2026-01-25",
          description: "Weekly rent",
        },
      ];

      vi.mocked(mockProvider.getRentPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockDb.query.propertyManagerMappings.findMany).mockResolvedValue([
        { providerPropertyId: "pm-prop-1", propertyId: "pt-prop-1", autoSync: true },
      ]);
      vi.mocked(mockDb.query.transactions.findFirst).mockResolvedValue({ id: "existing" });

      const result = await syncService.syncRentPayments("access-token", "conn-1", "user-1");

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/property-manager/__tests__/sync.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```typescript
// src/server/services/property-manager/sync.ts

import { eq, and } from "drizzle-orm";
import type { PropertyManagerProvider, PMRentPayment, PMMaintenanceJob, PMBill } from "./types";
import { transactions, propertyManagerMappings } from "@/server/db/schema";

type DbClient = {
  query: {
    propertyManagerMappings: {
      findMany: (opts: unknown) => Promise<Array<{
        providerPropertyId: string;
        propertyId: string | null;
        autoSync: boolean;
      }>>;
    };
    transactions: {
      findFirst: (opts: unknown) => Promise<unknown>;
    };
  };
  insert: (table: unknown) => {
    values: (values: unknown) => {
      returning: () => Promise<Array<{ id: string }>>;
    };
  };
  update: (table: unknown) => {
    set: (values: unknown) => {
      where: (condition: unknown) => Promise<void>;
    };
  };
};

interface SyncResult {
  created: number;
  skipped: number;
  errors: string[];
}

export class PropertyManagerSyncService {
  constructor(
    private provider: PropertyManagerProvider,
    private db: DbClient
  ) {}

  async syncRentPayments(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const payments = await this.provider.getRentPayments(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const payment of payments) {
        const mapping = mappingByProviderId.get(payment.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        // Check for duplicate
        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, payment.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        // Create transaction
        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: payment.date,
            description: payment.description,
            amount: String(payment.amount),
            category: "rental_income",
            transactionType: "income",
            status: "confirmed",
            providerTransactionId: payment.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  async syncMaintenanceJobs(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const jobs = await this.provider.getMaintenanceJobs(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const job of jobs) {
        if (job.status !== "completed") continue;

        const mapping = mappingByProviderId.get(job.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, job.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: job.date,
            description: job.supplierName
              ? `${job.description} - ${job.supplierName}`
              : job.description,
            amount: String(-Math.abs(job.amount)), // Expenses are negative
            category: "repairs_and_maintenance",
            transactionType: "expense",
            status: "confirmed",
            providerTransactionId: job.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  async syncBills(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<SyncResult> {
    const result: SyncResult = { created: 0, skipped: 0, errors: [] };

    try {
      const bills = await this.provider.getBills(accessToken, since);
      const mappings = await this.db.query.propertyManagerMappings.findMany({
        where: eq(propertyManagerMappings.connectionId, connectionId),
      });

      const mappingByProviderId = new Map(
        mappings.map((m) => [m.providerPropertyId, m])
      );

      for (const bill of bills) {
        const mapping = mappingByProviderId.get(bill.propertyId);

        if (!mapping || !mapping.propertyId || !mapping.autoSync) {
          result.skipped++;
          continue;
        }

        const existing = await this.db.query.transactions.findFirst({
          where: and(
            eq(transactions.providerTransactionId, bill.id),
            eq(transactions.provider, this.provider.name)
          ),
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        await this.db
          .insert(transactions)
          .values({
            userId,
            propertyId: mapping.propertyId,
            date: bill.date,
            description: bill.description,
            amount: String(-Math.abs(bill.amount)),
            category: this.mapBillCategory(bill.category),
            transactionType: "expense",
            status: "confirmed",
            providerTransactionId: bill.id,
            provider: this.provider.name,
          })
          .returning();

        result.created++;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    return result;
  }

  private mapBillCategory(category?: string): string {
    if (!category) return "sundry_rental_expenses";
    const lower = category.toLowerCase();
    if (lower.includes("rate") || lower.includes("council")) return "council_rates";
    if (lower.includes("water")) return "water_charges";
    if (lower.includes("insurance")) return "insurance";
    if (lower.includes("strata") || lower.includes("body")) return "body_corporate";
    return "sundry_rental_expenses";
  }

  async runFullSync(
    accessToken: string,
    connectionId: string,
    userId: string,
    since?: Date
  ): Promise<{
    rentPayments: SyncResult;
    maintenanceJobs: SyncResult;
    bills: SyncResult;
  }> {
    const [rentPayments, maintenanceJobs, bills] = await Promise.all([
      this.syncRentPayments(accessToken, connectionId, userId, since),
      this.syncMaintenanceJobs(accessToken, connectionId, userId, since),
      this.syncBills(accessToken, connectionId, userId, since),
    ]);

    return { rentPayments, maintenanceJobs, bills };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/property-manager/__tests__/sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/property-manager/
git commit -m "feat(service): add property manager sync service"
```

---

## Task 7: Create Property Manager Index Export

**Files:**
- Create: `src/server/services/property-manager/index.ts`

**Step 1: Create index file**

```typescript
// src/server/services/property-manager/index.ts

export * from "./types";
export { PropertyMeProvider, getPropertyMeProvider } from "./propertyme";
export { PropertyManagerSyncService } from "./sync";
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/property-manager/index.ts
git commit -m "feat(service): add property manager index exports"
```

---

## Task 8: Create Property Manager tRPC Router

**Files:**
- Create: `src/server/routers/propertyManager.ts`
- Test: `src/server/routers/__tests__/propertyManager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/routers/__tests__/propertyManager.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  createUnauthenticatedContext,
} from "../../__tests__/test-utils";

// Mock the PropertyMe provider
vi.mock("../../services/property-manager/propertyme", () => ({
  getPropertyMeProvider: vi.fn().mockReturnValue({
    name: "propertyme",
    getAuthUrl: vi.fn().mockReturnValue("https://oauth.propertyme.com/auth"),
    getProperties: vi.fn().mockResolvedValue([
      { id: "pm-1", address: "123 Test St", status: "active" },
    ]),
  }),
}));

describe("propertyManager router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("getConnections throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.propertyManager.getConnections()).rejects.toThrow(TRPCError);
      await expect(caller.propertyManager.getConnections()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("getAuthUrl", () => {
    it("returns PropertyMe OAuth URL", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyManager.getAuthUrl({ provider: "propertyme" });

      expect(result.url).toContain("propertyme.com");
    });
  });

  describe("getConnections", () => {
    it("returns user connections", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyManagerConnections: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "conn-1",
                provider: "propertyme",
                status: "active",
                lastSyncAt: new Date(),
              },
            ]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyManager.getConnections();

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe("propertyme");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/propertyManager.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```typescript
// src/server/routers/propertyManager.ts

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  propertyManagerConnections,
  propertyManagerMappings,
  propertyManagerSyncLogs,
  properties,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getPropertyMeProvider } from "../services/property-manager/propertyme";
import { PropertyManagerSyncService } from "../services/property-manager/sync";
import { randomUUID } from "crypto";

const providerSchema = z.enum(["propertyme", "different"]);

export const propertyManagerRouter = router({
  getAuthUrl: protectedProcedure
    .input(z.object({ provider: providerSchema }))
    .query(({ input }) => {
      if (input.provider !== "propertyme") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider not supported yet",
        });
      }

      const provider = getPropertyMeProvider();
      const state = randomUUID();
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/propertyme/callback`;
      const url = provider.getAuthUrl(redirectUri, state);

      return { url, state };
    }),

  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db.query.propertyManagerConnections.findMany({
      where: eq(propertyManagerConnections.userId, ctx.portfolio.ownerId),
      with: {
        mappings: true,
      },
    });

    return connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      mappingsCount: c.mappings.length,
      createdAt: c.createdAt,
    }));
  }),

  getConnection: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
        with: {
          mappings: {
            with: {
              property: true,
            },
          },
          syncLogs: {
            orderBy: (logs, { desc }) => [desc(logs.startedAt)],
            limit: 10,
          },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      return connection;
    }),

  fetchProviderProperties: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (connection.provider !== "propertyme") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider not supported",
        });
      }

      const provider = getPropertyMeProvider();
      const pmProperties = await provider.getProperties(connection.accessToken);

      // Upsert mappings
      for (const pmProp of pmProperties) {
        const existing = await ctx.db.query.propertyManagerMappings.findFirst({
          where: and(
            eq(propertyManagerMappings.connectionId, connection.id),
            eq(propertyManagerMappings.providerPropertyId, pmProp.id)
          ),
        });

        if (!existing) {
          await ctx.db.insert(propertyManagerMappings).values({
            connectionId: connection.id,
            providerPropertyId: pmProp.id,
            providerPropertyAddress: pmProp.address,
          });
        }
      }

      return { count: pmProperties.length };
    }),

  updateMapping: writeProcedure
    .input(
      z.object({
        mappingId: z.string().uuid(),
        propertyId: z.string().uuid().nullable(),
        autoSync: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.db.query.propertyManagerMappings.findFirst({
        where: eq(propertyManagerMappings.id, input.mappingId),
        with: {
          connection: true,
        },
      });

      if (!mapping || mapping.connection.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mapping not found",
        });
      }

      // Verify property belongs to user
      if (input.propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      await ctx.db
        .update(propertyManagerMappings)
        .set({
          propertyId: input.propertyId,
          autoSync: input.autoSync ?? mapping.autoSync,
          updatedAt: new Date(),
        })
        .where(eq(propertyManagerMappings.id, input.mappingId));

      return { success: true };
    }),

  sync: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      // Create sync log
      const [syncLog] = await ctx.db
        .insert(propertyManagerSyncLogs)
        .values({
          connectionId: connection.id,
          syncType: "manual",
          status: "running",
        })
        .returning();

      try {
        const provider = getPropertyMeProvider();
        const syncService = new PropertyManagerSyncService(provider, ctx.db);

        const result = await syncService.runFullSync(
          connection.accessToken,
          connection.id,
          ctx.portfolio.ownerId,
          connection.lastSyncAt || undefined
        );

        const totalCreated =
          result.rentPayments.created +
          result.maintenanceJobs.created +
          result.bills.created;

        const totalItems =
          result.rentPayments.created +
          result.rentPayments.skipped +
          result.maintenanceJobs.created +
          result.maintenanceJobs.skipped +
          result.bills.created +
          result.bills.skipped;

        // Update sync log
        await ctx.db
          .update(propertyManagerSyncLogs)
          .set({
            status: "completed",
            itemsSynced: String(totalItems),
            transactionsCreated: String(totalCreated),
            completedAt: new Date(),
          })
          .where(eq(propertyManagerSyncLogs.id, syncLog.id));

        // Update connection lastSyncAt
        await ctx.db
          .update(propertyManagerConnections)
          .set({
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(propertyManagerConnections.id, connection.id));

        return {
          success: true,
          transactionsCreated: totalCreated,
          itemsSynced: totalItems,
        };
      } catch (error) {
        await ctx.db
          .update(propertyManagerSyncLogs)
          .set({
            status: "failed",
            errors: JSON.stringify([
              error instanceof Error ? error.message : "Unknown error",
            ]),
            completedAt: new Date(),
          })
          .where(eq(propertyManagerSyncLogs.id, syncLog.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Sync failed",
          cause: error,
        });
      }
    }),

  disconnect: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      await ctx.db
        .update(propertyManagerConnections)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(propertyManagerConnections.id, connection.id));

      return { success: true };
    }),
});
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/propertyManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/propertyManager.ts src/server/routers/__tests__/propertyManager.test.ts
git commit -m "feat(router): add property manager tRPC router"
```

---

## Task 9: Register Property Manager Router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: Add import and register router**

Add import:
```typescript
import { propertyManagerRouter } from "./propertyManager";
```

Add to appRouter:
```typescript
  propertyManager: propertyManagerRouter,
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat(router): register property manager router in app"
```

---

## Task 10: Create OAuth Callback API Route

**Files:**
- Create: `src/app/api/integrations/propertyme/callback/route.ts`

**Step 1: Create the callback route**

```typescript
// src/app/api/integrations/propertyme/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { propertyManagerConnections } from "@/server/db/schema";
import { getPropertyMeProvider } from "@/server/services/property-manager/propertyme";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in?error=unauthorized", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=no_code", request.url)
    );
  }

  try {
    const provider = getPropertyMeProvider();
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/propertyme/callback`;

    const tokens = await provider.exchangeCodeForTokens(code, redirectUri);

    // Get the user from our database
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.redirect(
        new URL("/settings/integrations?error=user_not_found", request.url)
      );
    }

    // Create connection record
    const [connection] = await db
      .insert(propertyManagerConnections)
      .values({
        userId: user.id,
        provider: "propertyme",
        providerUserId: tokens.userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : null,
        scopes: ["property", "activity", "contact", "transaction"],
        status: "active",
      })
      .returning();

    return NextResponse.redirect(
      new URL(
        `/settings/integrations/propertyme?connection=${connection.id}`,
        request.url
      )
    );
  } catch (err) {
    console.error("PropertyMe OAuth error:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_failed", request.url)
    );
  }
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/integrations/propertyme/callback/route.ts
git commit -m "feat(api): add PropertyMe OAuth callback route"
```

---

## Task 11: Create Integrations Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/integrations/page.tsx`

**Step 1: Create the integrations page**

```typescript
// src/app/(dashboard)/settings/integrations/page.tsx

"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Link2, ExternalLink, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function IntegrationsPage() {
  const { data: connections, isLoading } = trpc.propertyManager.getConnections.useQuery();
  const { mutate: getAuthUrl } = trpc.propertyManager.getAuthUrl.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const propertyMeConnection = connections?.find((c) => c.provider === "propertyme");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect external services to automatically import data
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Property Managers</h3>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">PropertyMe</CardTitle>
                  <CardDescription>
                    Import rent payments, maintenance, and bills
                  </CardDescription>
                </div>
              </div>
              {propertyMeConnection ? (
                <Badge
                  variant={
                    propertyMeConnection.status === "active"
                      ? "default"
                      : "destructive"
                  }
                >
                  {propertyMeConnection.status === "active"
                    ? "Connected"
                    : propertyMeConnection.status}
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {propertyMeConnection ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {propertyMeConnection.lastSyncAt ? (
                    <span>
                      Last synced{" "}
                      {formatDistanceToNow(new Date(propertyMeConnection.lastSyncAt), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span>Never synced</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>{propertyMeConnection.mappingsCount} properties mapped</span>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/settings/integrations/propertyme`}>
                    Manage Connection
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => getAuthUrl({ provider: "propertyme" })}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Connect PropertyMe
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">:Different</CardTitle>
                  <CardDescription>
                    Virtual property management
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/integrations/page.tsx
git commit -m "feat(ui): add integrations settings page"
```

---

## Task 12: Create PropertyMe Management Page

**Files:**
- Create: `src/app/(dashboard)/settings/integrations/propertyme/page.tsx`

**Step 1: Create the PropertyMe management page**

```typescript
// src/app/(dashboard)/settings/integrations/propertyme/page.tsx

"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Building2,
  RefreshCw,
  Unlink,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

export default function PropertyMeIntegrationPage() {
  const utils = trpc.useUtils();

  const { data: connections } = trpc.propertyManager.getConnections.useQuery();
  const connection = connections?.find((c) => c.provider === "propertyme");

  const { data: connectionDetails, isLoading } =
    trpc.propertyManager.getConnection.useQuery(
      { connectionId: connection?.id ?? "" },
      { enabled: !!connection?.id }
    );

  const { data: properties } = trpc.property.list.useQuery();

  const fetchPropertiesMutation =
    trpc.propertyManager.fetchProviderProperties.useMutation({
      onSuccess: (data) => {
        toast.success(`Found ${data.count} properties`);
        utils.propertyManager.getConnection.invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const updateMappingMutation = trpc.propertyManager.updateMapping.useMutation({
    onSuccess: () => {
      utils.propertyManager.getConnection.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncMutation = trpc.propertyManager.sync.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sync complete: ${data.transactionsCreated} transactions created`
      );
      utils.propertyManager.getConnection.invalidate();
      utils.propertyManager.getConnections.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = trpc.propertyManager.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected from PropertyMe");
      utils.propertyManager.getConnections.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!connection) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Link
          href="/settings/integrations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No PropertyMe connection found.{" "}
              <Link href="/settings/integrations" className="text-primary hover:underline">
                Connect now
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !connectionDetails) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/settings/integrations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">PropertyMe</h2>
            <p className="text-muted-foreground">Manage your connection</p>
          </div>
        </div>
        <Badge
          variant={connection.status === "active" ? "default" : "destructive"}
        >
          {connection.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Last synced</span>
            </div>
            <span className="text-sm">
              {connectionDetails.lastSyncAt
                ? formatDistanceToNow(new Date(connectionDetails.lastSyncAt), {
                    addSuffix: true,
                  })
                : "Never"}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate({ connectionId: connection.id })}
              disabled={syncMutation.isPending}
              className="flex-1"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate({ connectionId: connection.id })}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Property Mappings</CardTitle>
              <CardDescription>
                Link PropertyMe properties to your PropertyTracker properties
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                fetchPropertiesMutation.mutate({ connectionId: connection.id })
              }
              disabled={fetchPropertiesMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  fetchPropertiesMutation.isPending ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connectionDetails.mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No properties found. Click Refresh to fetch properties from PropertyMe.
            </p>
          ) : (
            <div className="space-y-4">
              {connectionDetails.mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{mapping.providerPropertyAddress}</p>
                    <p className="text-sm text-muted-foreground">
                      PropertyMe ID: {mapping.providerPropertyId}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={mapping.propertyId || "unmapped"}
                      onValueChange={(value) =>
                        updateMappingMutation.mutate({
                          mappingId: mapping.id,
                          propertyId: value === "unmapped" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">Not mapped</SelectItem>
                        {properties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {prop.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`autosync-${mapping.id}`}
                        checked={mapping.autoSync}
                        onCheckedChange={(checked) =>
                          updateMappingMutation.mutate({
                            mappingId: mapping.id,
                            propertyId: mapping.propertyId,
                            autoSync: checked,
                          })
                        }
                      />
                      <Label htmlFor={`autosync-${mapping.id}`} className="text-sm">
                        Auto-sync
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {connectionDetails.syncLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No sync history yet
            </p>
          ) : (
            <div className="space-y-2">
              {connectionDetails.syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                    )}
                    <span className="text-sm capitalize">{log.syncType} sync</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {log.transactionsCreated} transactions •{" "}
                    {format(new Date(log.startedAt), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/integrations/propertyme/page.tsx
git commit -m "feat(ui): add PropertyMe integration management page"
```

---

## Task 13: Push Database Schema

**Step 1: Push schema changes to database**

Run: `npm run db:push`
Expected: Schema changes applied

**Step 2: Verify schema**

Run: `npx drizzle-kit studio` (optional, to visually inspect)

**Step 3: Commit any generated files if applicable**

```bash
git add -A
git commit -m "chore(db): apply property manager schema changes" --allow-empty
```

---

## Task 14: Run Full Test Suite and Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors on new files

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete property manager integrations (Phase 2.3)

- Add PropertyMe OAuth integration with provider abstraction
- Database schema for connections, mappings, sync logs
- Sync service for rent payments, maintenance, bills
- UI for /settings/integrations and /settings/integrations/propertyme
- Deduplication via providerTransactionId

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add property manager database enums |
| 2 | Add property manager tables |
| 3 | Add property manager relations |
| 4 | Create provider interface and types |
| 5 | Create PropertyMe provider service |
| 6 | Create sync service |
| 7 | Create index exports |
| 8 | Create tRPC router |
| 9 | Register router in app |
| 10 | Create OAuth callback API route |
| 11 | Create integrations settings page |
| 12 | Create PropertyMe management page |
| 13 | Push database schema |
| 14 | Final verification |

**Environment Variables Required:**
```
PROPERTYME_CLIENT_ID=your_client_id
PROPERTYME_CLIENT_SECRET=your_client_secret
```
