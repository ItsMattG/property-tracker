import { eq, and, or, desc, gte, sql } from "drizzle-orm";
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
  ExtractionWithFullRelations,
} from "./interfaces/document.repository.interface";

export class DocumentRepository
  extends BaseRepository
  implements IDocumentRepository
{
  async findByOwner(
    userId: string,
    filters?: DocumentFilters
  ): Promise<Document[]> {
    const conditions = [eq(documents.userId, userId)];

    if (filters?.propertyId && filters?.transactionId) {
      conditions.push(
        or(
          eq(documents.propertyId, filters.propertyId),
          eq(documents.transactionId, filters.transactionId)
        )!
      );
    } else if (filters?.propertyId) {
      conditions.push(eq(documents.propertyId, filters.propertyId));
    } else if (filters?.transactionId) {
      conditions.push(eq(documents.transactionId, filters.transactionId));
    }

    if (filters?.category) {
      conditions.push(eq(documents.category, filters.category));
    }

    return this.db.query.documents.findMany({
      where: and(...conditions),
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
    userId: string,
    opts?: { withRelations?: boolean }
  ): Promise<ExtractionWithRelations | null> {
    const result = await this.db.query.documentExtractions.findFirst({
      where: eq(documentExtractions.id, id),
      with: {
        document: true,
        ...(opts?.withRelations && {
          draftTransaction: true,
          matchedProperty: true,
        }),
      },
    });
    // Verify ownership through document relation
    if (!result || result.document?.userId !== userId) return null;
    return result;
  }

  async findCompletedExtractionsWithRelations(
    userId: string
  ): Promise<ExtractionWithFullRelations[]> {
    const results = await this.db.query.documentExtractions.findMany({
      where: eq(documentExtractions.status, "completed"),
      with: { document: true, draftTransaction: true, matchedProperty: true },
      orderBy: desc(documentExtractions.createdAt),
    });
    // Filter by document ownership (guard against null document from orphaned extractions)
    return results.filter((e) => e.document?.userId === userId);
  }

  async deleteExtraction(id: string, userId: string): Promise<void> {
    // Verify ownership through document relation before deleting
    const extraction = await this.db.query.documentExtractions.findFirst({
      where: eq(documentExtractions.id, id),
      with: { document: true },
    });
    if (!extraction || extraction.document?.userId !== userId) return;
    await this.db
      .delete(documentExtractions)
      .where(eq(documentExtractions.id, id));
  }

  async getMonthlyExtractionCount(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentExtractions)
      .innerJoin(documents, eq(documentExtractions.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, userId),
          gte(documentExtractions.createdAt, startOfMonth)
        )
      );

    return result?.count ?? 0;
  }
}
