import type { Document, NewDocument, DocumentExtraction, NewDocumentExtraction, Property, Transaction } from "../../db/schema";
import type { DB } from "../base";

/** Filters for listing documents */
export interface DocumentFilters {
  propertyId?: string;
  transactionId?: string;
}

/** Extraction with its related document, matched property, and draft transaction */
export type ExtractionWithRelations = DocumentExtraction & {
  document?: Document;
  matchedProperty?: Property | null;
  draftTransaction?: Transaction | null;
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

  /** Find extraction by ID with optional relations */
  findExtractionById(id: string, opts?: { withRelations?: boolean }): Promise<ExtractionWithRelations | null>;

  /** List completed extractions with pending review draft transactions */
  findCompletedExtractionsWithRelations(): Promise<ExtractionWithRelations[]>;

  /** Delete an extraction record */
  deleteExtraction(id: string): Promise<void>;
}
