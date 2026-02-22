import type { RentReviewRow, NewRentReviewRow } from "../../db/schema";

export interface IRentReviewRepository {
  findByPropertyId(
    propertyId: string,
    userId: string
  ): Promise<RentReviewRow | null>;
  findAllByUser(userId: string): Promise<RentReviewRow[]>;
  upsert(data: NewRentReviewRow): Promise<RentReviewRow>;
}
