import type {
  User,
  UserOnboarding,
  PushToken,
  MilestonePreferences,
  PropertyMilestoneOverride,
} from "../../db/schema";
import type { subscriptions } from "../../db/schema";
import type { DB } from "../base";

type Subscription = typeof subscriptions.$inferSelect;

export interface IUserRepository {
  /** Find a user by id */
  findById(id: string): Promise<User | null>;

  /** Find a user by id with specific columns */
  findById(id: string, columns: Partial<Record<keyof User, true>>): Promise<Partial<User> | null>;

  /** Find a user by email */
  findByEmail(email: string): Promise<User | null>;

  /** Update a user */
  update(id: string, data: Partial<User>, tx?: DB): Promise<void>;

  /** Find subscription summary for a user */
  findSubscription(userId: string): Promise<{
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
  } | null>;

  /** Find full subscription row for a user */
  findSubscriptionFull(userId: string): Promise<Subscription | null>;

  // --- Onboarding ---

  /** Find onboarding record for a user */
  findOnboarding(userId: string): Promise<UserOnboarding | null>;

  /** Create onboarding record for a user */
  createOnboarding(userId: string): Promise<UserOnboarding>;

  /** Update onboarding record for a user */
  updateOnboarding(userId: string, data: Partial<UserOnboarding>): Promise<UserOnboarding | null>;

  // --- Push tokens ---

  /** Find a push token by token string */
  findPushToken(token: string): Promise<PushToken | null>;

  /** Upsert a push token for a user */
  upsertPushToken(data: { userId: string; token: string; platform: "ios" | "android" }): Promise<void>;

  /** Delete a push token for a user */
  deletePushToken(userId: string, token: string): Promise<void>;

  // --- Milestone preferences ---

  /** Find milestone preferences for a user */
  findMilestonePrefs(userId: string): Promise<MilestonePreferences | null>;

  /** Upsert milestone preferences for a user */
  upsertMilestonePrefs(userId: string, data: Partial<MilestonePreferences>): Promise<MilestonePreferences>;

  /** Find property milestone override */
  findPropertyOverride(propertyId: string): Promise<PropertyMilestoneOverride | null>;

  /** Upsert property milestone override */
  upsertPropertyOverride(propertyId: string, data: Partial<PropertyMilestoneOverride>): Promise<PropertyMilestoneOverride>;

  /** Delete property milestone override */
  deletePropertyOverride(propertyId: string): Promise<void>;

  /** Get achieved milestone IDs for a user */
  getAchievedMilestones(userId: string): Promise<string[]>;

  /** Add newly achieved milestone IDs for a user */
  addAchievedMilestones(userId: string, milestoneIds: string[]): Promise<string[]>;
}
