import { eq, and, or, desc } from "drizzle-orm";
import { documents, documentExtractions } from "../db/schema";
import type {
  Document,
  NewDocument,
  DocumentExtraction,
  NewDocumentExtraction,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IDocumentRepository,
  DocumentFilters,
  ExtractionWithRelations,
} from "./interfaces/document.repository.interface";

export class DocumentRepository
  extends BaseRepository
  implements IDocumentRepository
{
  async findByOwner(
    userId: string,
    filters?: DocumentFilters
  ): Promise<Document[]> {
    let whereClause;
    if (filters?.propertyId && filters?.transactionId) {
      whereClause = and(
        eq(documents.userId, userId),
        or(
          eq(documents.propertyId, filters.propertyId),
          eq(documents.transactionId, filters.transactionId)
        )
      );
    } else if (filters?.propertyId) {
      whereClause = and(
        eq(documents.userId, userId),
        eq(documents.propertyId, filters.propertyId)
      );
    } else if (filters?.transactionId) {
      whereClause = and(
        eq(documents.userId, userId),
        eq(documents.transactionId, filters.transactionId)
      );
    } else {
      whereClause = eq(documents.userId, userId);
    }

    return this.db.query.documents.findMany({
      where: whereClause,
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
  }

  async findById(id: string, userId: string): Promise<Document | null> {
    const result = await this.db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });
    return result ?? null;
  }

  async create(data: NewDocument, tx?: DB): Promise<Document> {
    const client = this.resolve(tx);
    const [document] = await client
      .insert(documents)
      .values(data)
      .returning();
    return document;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  async createExtraction(
    data: NewDocumentExtraction,
    tx?: DB
  ): Promise<DocumentExtraction> {
    const client = this.resolve(tx);
    const [extraction] = await client
      .insert(documentExtractions)
      .values(data)
      .returning();
    return extraction;
  }

  async updateExtraction(
    id: string,
    data: Partial<DocumentExtraction>,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(documentExtractions)
      .set(data)
      .where(eq(documentExtractions.id, id));
  }

  async findExtractionByDocumentId(
    documentId: string,
    opts?: { withRelations?: boolean }
  ): Promise<ExtractionWithRelations | null> {
    const result = await this.db.query.documentExtractions.findFirst({
      where: eq(documentExtractions.documentId, documentId),
      ...(opts?.withRelations && {
        with: { draftTransaction: true, matchedProperty: true },
      }),
    });
    return result ?? null;
  }

  async findExtractionById(
    id: string,
    opts?: { withRelations?: boolean }
  ): Promise<ExtractionWithRelations | null> {
    const result = await this.db.query.documentExtractions.findFirst({
      where: eq(documentExtractions.id, id),
      ...(opts?.withRelations && {
        with: { draftTransaction: true, matchedProperty: true },
      }),
    });
    return result ?? null;
  }

  async findCompletedExtractionsWithRelations(): Promise<
    ExtractionWithRelations[]
  > {
    return this.db.query.documentExtractions.findMany({
      where: eq(documentExtractions.status, "completed"),
      with: { document: true, draftTransaction: true, matchedProperty: true },
      orderBy: desc(documentExtractions.createdAt),
    });
  }

  async deleteExtraction(id: string): Promise<void> {
    await this.db
      .delete(documentExtractions)
      .where(eq(documentExtractions.id, id));
  }
}
