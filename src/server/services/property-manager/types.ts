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
