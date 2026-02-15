import type {
  PropertyVector,
  NewPropertyVector,
  ExternalListing,
  NewExternalListing,
  SuburbBenchmark,
  NewSuburbBenchmark,
  PropertyPerformanceBenchmark,
  NewPropertyPerformanceBenchmark,
  SharingPreference,
  Property,
} from "../../db/schema";
import type { DB } from "../base";

/** Raw row returned by the pgvector similarity SQL query */
export interface SimilarVectorRow {
  id: string;
  property_id: string | null;
  external_listing_id: string | null;
  user_id: string;
  distance: number;
  property_suburb: string | null;
  property_state: string | null;
  property_address: string | null;
  listing_suburb: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_price: string | null;
  listing_url: string | null;
}

/** Property vector with optional relations for discover queries */
export interface PropertyVectorWithRelations extends PropertyVector {
  property?: Property | null;
  externalListing?: ExternalListing | null;
}

export interface ISimilarPropertiesRepository {
  // Property Vectors
  findVectorByProperty(propertyId: string): Promise<PropertyVector | null>;
  upsertVector(propertyId: string, userId: string, vector: number[]): Promise<void>;
  findVectorById(id: string): Promise<PropertyVector | null>;
  findVectorByPropertyAndUser(propertyId: string, userId: string): Promise<PropertyVector | null>;
  findSimilarVectors(
    vectorId: string,
    vectorStr: string,
    userId: string,
    includeCommunity: boolean,
    limit: number
  ): Promise<SimilarVectorRow[]>;
  updateVectorSharing(id: string, data: Partial<PropertyVector>): Promise<void>;
  discoverVectors(
    userId: string,
    limit: number,
    offset: number
  ): Promise<PropertyVectorWithRelations[]>;

  // External Listings
  createExternalListing(data: NewExternalListing, tx?: DB): Promise<ExternalListing>;
  insertVector(data: NewPropertyVector, tx?: DB): Promise<void>;
  listExternalListings(userId: string): Promise<ExternalListing[]>;
  deleteExternalListing(id: string, userId: string, tx?: DB): Promise<void>;

  // Sharing Preferences
  findSharingPreferences(userId: string): Promise<SharingPreference | null>;
  upsertSharingPreferences(
    userId: string,
    data: { defaultShareLevel: string; defaultSharedAttributes: string[] }
  ): Promise<void>;

  // Suburb Benchmarks
  findSuburbBenchmark(suburb: string, state: string, propertyType?: string): Promise<SuburbBenchmark | null>;
  createSuburbBenchmark(data: NewSuburbBenchmark): Promise<SuburbBenchmark>;

  // Performance Benchmarks
  upsertPerformanceBenchmark(data: NewPropertyPerformanceBenchmark): Promise<void>;
  findPerformanceBenchmarksByProperties(propertyIds: string[]): Promise<PropertyPerformanceBenchmark[]>;
}
