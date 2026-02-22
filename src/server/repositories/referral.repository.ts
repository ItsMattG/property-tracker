import { eq, and, desc, sql } from "drizzle-orm";
import { referralCodes, referrals, referralCredits, users } from "../db/schema";
import type { ReferralCode, Referral } from "../db/schema";
import { BaseRepository } from "./base";
import type {
  IReferralRepository,
  ReferralWithReferee,
} from "./interfaces/referral.repository.interface";

export class ReferralRepository
  extends BaseRepository
  implements IReferralRepository
{
  async findCodeByUserId(userId: string): Promise<ReferralCode | null> {
    const result = await this.db.query.referralCodes.findFirst({
      where: eq(referralCodes.userId, userId),
    });
    return result ?? null;
  }

  async createCode(userId: string, code: string): Promise<ReferralCode> {
    const [created] = await this.db
      .insert(referralCodes)
      .values({ userId, code })
      .returning();
    return created;
  }

  async resolveCode(code: string): Promise<ReferralCode | null> {
    const result = await this.db.query.referralCodes.findFirst({
      where: eq(referralCodes.code, code),
    });
    return result ?? null;
  }

  async findByReferrer(userId: string): Promise<ReferralWithReferee[]> {
    return this.db
      .select({
        id: referrals.id,
        status: referrals.status,
        createdAt: referrals.createdAt,
        qualifiedAt: referrals.qualifiedAt,
        refereeName: users.name,
        refereeEmail: users.email,
      })
      .from(referrals)
      .leftJoin(users, eq(users.id, referrals.refereeUserId))
      .where(eq(referrals.referrerUserId, userId))
      .orderBy(desc(referrals.createdAt));
  }

  async findByReferee(userId: string): Promise<Referral | null> {
    const result = await this.db.query.referrals.findFirst({
      where: eq(referrals.refereeUserId, userId),
    });
    return result ?? null;
  }

  async createReferral(data: {
    referrerUserId: string;
    refereeUserId: string;
    referralCodeId: string;
  }): Promise<Referral> {
    const [created] = await this.db
      .insert(referrals)
      .values(data)
      .returning();
    return created;
  }

  async qualifyReferral(referralId: string): Promise<void> {
    await this.db
      .update(referrals)
      .set({ status: "qualified", qualifiedAt: new Date() })
      .where(eq(referrals.id, referralId));
  }

  async getPendingCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerUserId, userId),
          eq(referrals.status, "pending")
        )
      );
    return result?.count ?? 0;
  }

  async getCreditsTotal(userId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${referralCredits.monthsFree}), 0)::int`,
      })
      .from(referralCredits)
      .where(eq(referralCredits.userId, userId));
    return result?.total ?? 0;
  }

  async createCredits(
    credits: Array<{
      userId: string;
      referralId: string;
      monthsFree: number;
      expiresAt: Date;
    }>
  ): Promise<void> {
    await this.db.insert(referralCredits).values(credits);
  }
}
