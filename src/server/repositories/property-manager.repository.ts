import { eq, and, desc } from "drizzle-orm";
import {
  propertyManagerConnections,
  propertyManagerMappings,
  propertyManagerSyncLogs,
} from "../db/schema";
import type {
  PropertyManagerConnection,
  PropertyManagerMapping,
  PropertyManagerSyncLog,
  NewPropertyManagerMapping,
  NewPropertyManagerSyncLog,
} from "../db/schema";
import { BaseRepository } from "./base";
import type {
  IPropertyManagerRepository,
  ConnectionWithMappings,
  ConnectionWithDetails,
  MappingWithConnection,
} from "./interfaces/property-manager.repository.interface";

export class PropertyManagerRepository
  extends BaseRepository
  implements IPropertyManagerRepository
{
  async findByUser(userId: string): Promise<ConnectionWithMappings[]> {
    return this.db.query.propertyManagerConnections.findMany({
      where: eq(propertyManagerConnections.userId, userId),
      with: { mappings: true },
    });
  }

  async findByIdWithDetails(
    connectionId: string,
    userId: string
  ): Promise<ConnectionWithDetails | null> {
    const result = await this.db.query.propertyManagerConnections.findFirst({
      where: and(
        eq(propertyManagerConnections.id, connectionId),
        eq(propertyManagerConnections.userId, userId)
      ),
      with: {
        mappings: { with: { property: true } },
        syncLogs: {
          orderBy: [desc(propertyManagerSyncLogs.startedAt)],
          limit: 10,
        },
      },
    });
    return (result as ConnectionWithDetails) ?? null;
  }

  async findById(
    connectionId: string,
    userId: string
  ): Promise<PropertyManagerConnection | null> {
    const result = await this.db.query.propertyManagerConnections.findFirst({
      where: and(
        eq(propertyManagerConnections.id, connectionId),
        eq(propertyManagerConnections.userId, userId)
      ),
    });
    return result ?? null;
  }

  async findMappingByProvider(
    connectionId: string,
    providerPropertyId: string
  ): Promise<PropertyManagerMapping | null> {
    const result = await this.db.query.propertyManagerMappings.findFirst({
      where: and(
        eq(propertyManagerMappings.connectionId, connectionId),
        eq(propertyManagerMappings.providerPropertyId, providerPropertyId)
      ),
    });
    return result ?? null;
  }

  async findMappingsByConnection(connectionId: string): Promise<PropertyManagerMapping[]> {
    return this.db.query.propertyManagerMappings.findMany({
      where: eq(propertyManagerMappings.connectionId, connectionId),
    });
  }

  async createMapping(data: NewPropertyManagerMapping): Promise<PropertyManagerMapping> {
    const [created] = await this.db
      .insert(propertyManagerMappings)
      .values(data)
      .returning();
    return created;
  }

  async createMappings(data: NewPropertyManagerMapping[]): Promise<PropertyManagerMapping[]> {
    if (data.length === 0) return [];
    return this.db.insert(propertyManagerMappings).values(data).returning();
  }

  async findMappingWithConnection(mappingId: string): Promise<MappingWithConnection | null> {
    const result = await this.db.query.propertyManagerMappings.findFirst({
      where: eq(propertyManagerMappings.id, mappingId),
      with: { connection: true },
    });
    return (result as MappingWithConnection) ?? null;
  }

  async updateMapping(
    mappingId: string,
    data: Partial<PropertyManagerMapping>
  ): Promise<void> {
    await this.db
      .update(propertyManagerMappings)
      .set(data)
      .where(eq(propertyManagerMappings.id, mappingId));
  }

  async createSyncLog(data: NewPropertyManagerSyncLog): Promise<PropertyManagerSyncLog> {
    const [created] = await this.db
      .insert(propertyManagerSyncLogs)
      .values(data)
      .returning();
    return created;
  }

  async updateSyncLog(
    syncLogId: string,
    data: Partial<PropertyManagerSyncLog>
  ): Promise<void> {
    await this.db
      .update(propertyManagerSyncLogs)
      .set(data)
      .where(eq(propertyManagerSyncLogs.id, syncLogId));
  }

  async updateLastSync(connectionId: string): Promise<void> {
    await this.db
      .update(propertyManagerConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(propertyManagerConnections.id, connectionId));
  }

  async updateStatus(connectionId: string, status: string): Promise<void> {
    await this.db
      .update(propertyManagerConnections)
      .set({ status: status as "active" | "expired" | "revoked", updatedAt: new Date() })
      .where(eq(propertyManagerConnections.id, connectionId));
  }
}
