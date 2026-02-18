import type { Document, NewDocument, DocumentExtraction, NewDocumentExtraction, Property, Transaction } from "../../db/schema";
import type { DB } from "../base";

/** Valid document category values matching documentCategoryEnum */
type DocumentCategory = "receipt" | "contract" | "depreciation" | "lease" | "other";

/** Filters for listing documents */
export interface DocumentFilters {
  propertyId?: string;
  transactionId?: string;
  category?: DocumentCategory;
}

/** Extraction with optional relations (used when relations may or may not be loaded) */
export type ExtractionWithRelations = DocumentExtraction & {
  document?: Document;
  matchedProperty?: Property | null;
  draftTransaction?: Transaction | null;
};

/** Extraction with all relations guaranteed loaded */
export type ExtractionWithFullRelations = DocumentExtraction & {
  document: Document;
  matchedProperty: Property | null;
  draftTransaction: Transaction | null;
};

export interface IDocumentRepository {
  /** List documents for a user with optional property/transaction filter */
  findByOwner(userId: string, filters?: DocumentFilters): Promise<Document[]>;

  /** Get a single document by id scoped to user */
  findById(id: string, userId: string): Promise<Document | null>;

  /** Insert a new document */
  create(data: NewDocument, tx?: DB): Promise<Document>;

  /** Delete a document */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Create a document extraction record */
  createExtraction(data: NewDocumentExtraction, tx?: DB): Promise<DocumentExtraction>;

  /** Update a document extraction record */
  updateExtraction(id: string, data: Partial<DocumentExtraction>, tx?: DB): Promise<void>;

  /** Find extraction by document ID */
  findExtractionByDocumentId(documentId: string, opts?: { withRelations?: boolean }): Promise<ExtractionWithRelations | null>;

  /** Find extraction by ID scoped to user (joins through document) */
  findExtractionById(id: string, userId: string, opts?: { withRelations?: boolean }): Promise<ExtractionWithRelations | null>;

  /** List completed extractions for a user with all relations loaded */
  findCompletedExtractionsWithRelations(userId: string): Promise<ExtractionWithFullRelations[]>;

  /** Delete an extraction record scoped to user */
  deleteExtraction(id: string, userId: string): Promise<void>;

  /** Count extractions created this calendar month for a user */
  getMonthlyExtractionCount(userId: string): Promise<number>;
}
