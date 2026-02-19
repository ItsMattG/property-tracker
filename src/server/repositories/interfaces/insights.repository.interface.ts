import type {
  PortfolioInsightRow,
  NewPortfolioInsightRow,
} from "../../db/schema";
import type { DB } from "../base";

export interface IInsightsRepository {
  /** Find the most recent non-expired insight for a user, or null if stale/missing */
  findFreshByUser(userId: string): Promise<PortfolioInsightRow | null>;

  /** Delete existing insight for user and insert new one */
  upsert(data: NewPortfolioInsightRow, tx?: DB): Promise<PortfolioInsightRow>;
}
