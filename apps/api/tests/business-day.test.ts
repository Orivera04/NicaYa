import { nicaraguaDayWindow } from "../src/lib/business-day";

test("usa el corte diario de Nicaragua para cuotas de riders", () => {
  const { start, end } = nicaraguaDayWindow(new Date("2026-07-17T04:30:00.000Z"));

  expect(start.toISOString()).toBe("2026-07-16T06:00:00.000Z");
  expect(end.toISOString()).toBe("2026-07-17T06:00:00.000Z");
});
