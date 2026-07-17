const BUSINESS_OFFSET_HOURS = 6;

/**
 * MotoYa opera inicialmente en Nicaragua (UTC-6). Quotas, reportes y límites
 * diarios comparten este mismo corte y no dependen de la zona del servidor.
 */
export function nicaraguaDayWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const start = new Date(Date.UTC(year, month - 1, day, BUSINESS_OFFSET_HOURS));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
