import type {
  PropertyManagerConnection,
  PropertyManagerMapping,
  PropertyManagerSyncLog,
  NewPropertyManagerMapping,
  NewPropertyManagerSyncLog,
} from "../../db/schema";

export interface ConnectionWithMappings extends PropertyManagerConnection {
  mappings: PropertyManagerMapping[];
}

export interface MappingWithProperty extends PropertyManagerMapping {
  property: { id: string; address: string; suburb: string; state: string; postcode: string } | null;
}

export interface ConnectionWithDetails extends PropertyManagerConnection {
  mappings: MappingWithProperty[];
  syncLogs: PropertyManagerSyncLog[];
}

export interface MappingWithConnection extends PropertyManagerMapping {
  connection: PropertyManagerConnection;
}

export interface IPropertyManagerRepository {
  findByUser(userId: string): Promise<ConnectionWithMappings[]>;
  findByIdWithDetails(connectionId: string, userId: string): Promise<ConnectionWithDetails | null>;
  findById(connectionId: string, userId: string): Promise<PropertyManagerConnection | null>;
  findMappingByProvider(connectionId: string, providerPropertyId: string): Promise<PropertyManagerMapping | null>;
  findMappingsByConnection(connectionId: string): Promise<PropertyManagerMapping[]>;
  createMapping(data: NewPropertyManagerMapping): Promise<PropertyManagerMapping>;
  createMappings(data: NewPropertyManagerMapping[]): Promise<PropertyManagerMapping[]>;
  findMappingWithConnection(mappingId: string): Promise<MappingWithConnection | null>;
  updateMapping(mappingId: string, data: Partial<PropertyManagerMapping>): Promise<void>;
  createSyncLog(data: NewPropertyManagerSyncLog): Promise<PropertyManagerSyncLog>;
  updateSyncLog(syncLogId: string, data: Partial<PropertyManagerSyncLog>): Promise<void>;
  updateLastSync(connectionId: string): Promise<void>;
  updateStatus(connectionId: string, status: string): Promise<void>;
}
