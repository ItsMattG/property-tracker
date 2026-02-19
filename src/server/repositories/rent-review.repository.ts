import { eq, and } from "drizzle-orm";
import { BaseRepository } from "./base";
import type { IRentReviewRepository } from "./interfaces/rent-review.repository.interface";
import {
  rentReviews,
  type RentReviewRow,
  type NewRentReviewRow,
} from "../db/schema";

export class RentReviewRepository
  extends BaseRepository
  implements IRentReviewRepository
{
  async findByPropertyId(
    propertyId: string,
    userId: string
  ): Promise<RentReviewRow | null> {
    const result = await this.db.query.rentReviews.findFirst({
      where: and(
        eq(rentReviews.propertyId, propertyId),
        eq(rentReviews.userId, userId)
      ),
    });

    return result ?? null;
  }

  async findAllByUser(userId: string): Promise<RentReviewRow[]> {
    return this.db.query.rentReviews.findMany({
      where: eq(rentReviews.userId, userId),
    });
  }

  async upsert(data: NewRentReviewRow): Promise<RentReviewRow> {
    const [row] = await this.db
      .insert(rentReviews)
      .values(data)
      .onConflictDoUpdate({
        target: rentReviews.propertyId,
        set: {
          marketRentWeekly: data.marketRentWeekly,
          dataSource: data.dataSource,
          lastReviewedAt: data.lastReviewedAt,
          nextReviewDate: data.nextReviewDate,
          notes: data.notes,
          updatedAt: new Date(),
        },
      })
      .returning();

    return row;
  }
}
