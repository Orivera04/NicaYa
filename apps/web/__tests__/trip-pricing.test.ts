import { proposedFareError } from "@/lib/trip-pricing";

const quote = { minimumFare: 50, maximumFare: 2000, currency: "NIO" };

describe("proposed trip fares", () => {
  test("accepts the calculated fare and amounts on both boundaries", () => {
    expect(proposedFareError(undefined, quote)).toBeNull();
    expect(proposedFareError(50, quote)).toBeNull();
    expect(proposedFareError(2000, quote)).toBeNull();
  });

  test("rejects amounts outside the allowed range and non-numbers", () => {
    expect(proposedFareError(49, quote)).toBe("Tu propuesta debe estar entre 50 y 2000 NIO.");
    expect(proposedFareError(2001, quote)).toBe("Tu propuesta debe estar entre 50 y 2000 NIO.");
    expect(proposedFareError(Number.NaN, quote)).toBe("Tu propuesta debe estar entre 50 y 2000 NIO.");
  });
});
