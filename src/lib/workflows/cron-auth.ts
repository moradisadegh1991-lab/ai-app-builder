import { timingSafeEqual } from "node:crypto";

export function authorizedMaintenance(request: Request) {
  if (!process.env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
