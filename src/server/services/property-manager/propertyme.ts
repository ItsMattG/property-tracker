// src/server/services/property-manager/propertyme.ts

import { ExternalServiceError } from "@/server/errors";
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
      throw new ExternalServiceError(`Token exchange failed: ${response.statusText}`, "propertyme");
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
      throw new ExternalServiceError(`Token refresh failed: ${response.statusText}`, "propertyme");
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
      throw new ExternalServiceError(`PropertyMe API error: ${response.statusText}`, "propertyme");
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
