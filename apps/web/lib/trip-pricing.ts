export type FareBounds = { minimumFare: number; maximumFare: number; currency: string };

export const proposedFareError = (amount: number | undefined, quote: FareBounds): string | null => {
  if (amount === undefined) return null;
  if (!Number.isFinite(amount) || amount < quote.minimumFare || amount > quote.maximumFare) {
    return `Tu propuesta debe estar entre ${quote.minimumFare} y ${quote.maximumFare} ${quote.currency}.`;
  }
  return null;
};
