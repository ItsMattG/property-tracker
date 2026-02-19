interface ExtractionCandidate {
  amount: number | null;
  date: string | null;
  vendor: string | null;
}

interface TransactionRow {
  id: string;
  date: string;
  amount: string;
  description: string;
  status: string;
}

const WINDOW_DAYS = 7;

function daysApart(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function vendorMatch(extracted: string, existing: string): boolean {
  const a = extracted.toLowerCase().trim();
  const b = existing.toLowerCase().trim();
  return a.includes(b) || b.includes(a);
}

/**
 * Find a potential duplicate transaction for an extraction result.
 * Returns the transaction ID if a duplicate is found, null otherwise.
 *
 * Matching criteria: same absolute amount + date within 7 days + vendor fuzzy match.
 * Skips pending_review transactions (those are other draft extractions).
 */
export function findPotentialDuplicate(
  candidate: ExtractionCandidate,
  transactions: TransactionRow[]
): string | null {
  if (!candidate.amount || !candidate.date) return null;

  const candidateAmount = Math.abs(candidate.amount);

  for (const tx of transactions) {
    if (tx.status === "pending_review") continue;

    const txAmount = Math.abs(parseFloat(tx.amount));
    if (Math.abs(txAmount - candidateAmount) > 0.01) continue;

    if (daysApart(candidate.date, tx.date) > WINDOW_DAYS) continue;

    if (candidate.vendor && tx.description) {
      if (!vendorMatch(candidate.vendor, tx.description)) continue;
    }

    return tx.id;
  }

  return null;
}
