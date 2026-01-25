export interface RbaApiResponse {
  data: Array<{ date: string; value: number }>;
}

export interface ParsedRate {
  date: string;
  rate: number;
}

export function parseRbaCashRate(response: RbaApiResponse): ParsedRate | null {
  if (!response.data || response.data.length === 0) {
    return null;
  }

  const latest = response.data[0];
  return {
    date: latest.date,
    rate: latest.value,
  };
}

export function shouldNotifyRateChange(
  previousRate: number | null,
  newRate: number
): boolean {
  if (previousRate === null) return true;
  return previousRate !== newRate;
}
