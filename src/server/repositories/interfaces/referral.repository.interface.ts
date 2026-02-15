import type { ReferralCode, Referral } from "../../db/schema";

export interface ReferralWithReferee {
  id: string;
  status: string;
  createdAt: Date;
  qualifiedAt: Date | null;
  refereeName: string | null;
  refereeEmail: string | null;
}

export interface IReferralRepository {
  /** Find a user's referral code */
  findCodeByUserId(userId: string): Promise<ReferralCode | null>;

  /** Create a new referral code for a user */
  createCode(userId: string, code: string): Promise<ReferralCode>;

  /** Look up a referral code by its code string */
  resolveCode(code: string): Promise<ReferralCode | null>;

  /** List referrals made by a user, with referee info */
  findByReferrer(userId: string): Promise<ReferralWithReferee[]>;

  /** Find a referral where the user was referred */
  findByReferee(userId: string): Promise<Referral | null>;

  /** Create a new referral record */
  createReferral(data: {
    referrerUserId: string;
    refereeUserId: string;
    referralCodeId: string;
  }): Promise<Referral>;

  /** Mark a referral as qualified */
  qualifyReferral(referralId: string): Promise<void>;

  /** Get total months of free credits for a user */
  getCreditsTotal(userId: string): Promise<number>;

  /** Insert multiple credit records */
  createCredits(
    credits: Array<{
      userId: string;
      referralId: string;
      monthsFree: number;
      expiresAt: Date;
    }>
  ): Promise<void>;
}
