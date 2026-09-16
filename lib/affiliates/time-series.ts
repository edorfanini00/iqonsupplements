import type { Granularity, PresetRange, TimeSeriesPoint } from "@/lib/affiliates/types";

/**
 * All dashboard range/bucket math is pinned to the business timezone (US
 * Eastern) so "today", day buckets, and month boundaries mean the same thing
 * no matter where the code runs — Vercel servers are UTC, where a naive
 * "start of today" would flip to tomorrow at 8pm ET and make same-day revenue
 * read as zero.
 */
export const BUSINESS_TIME_ZONE = "America/New_York";

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The Eastern-time wall-clock parts of an instant. */
function zonedParts(d: Date): ZonedParts {
  const parts = PARTS_FMT.formatToParts(d);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // hourCycle h23 still yields "24" for midnight in some engines.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Eastern-zone UTC offset (ms) in effect at instant `d`. */
function zoneOffsetMs(d: Date): number {
  const p = zonedParts(d);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, d.getMilliseconds());
  return wallAsUtc - d.getTime();
}

/**
 * The instant whose Eastern wall clock reads the given calendar parts.
 * Overflowing values (month 13, day 0/32, …) normalize like `Date.UTC`.
 */
export function zonedDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Two passes so DST transitions resolve to the correct offset.
  let offset = zoneOffsetMs(new Date(wallAsUtc));
  offset = zoneOffsetMs(new Date(wallAsUtc - offset));
  return new Date(wallAsUtc - offset);
}

/** Day of week (0 = Sunday) of the Eastern calendar date of an instant. */
function zonedWeekday(p: ZonedParts): number {
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/**
 * Format an instant as an Eastern wall-clock string ("YYYY-MM-DDTHH:mm:ss",
 * no offset) — the shape Shopify expects for `after`/`before` since the
 * store compares against its local (Eastern) order dates.
 */
export function toShopifyLocalDate(d: Date): string {
  const p = zonedParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/**
 * Parse a Shopify store-local timestamp ("2026-07-09T20:15:33", no
 * offset) as Eastern wall time. Strings that already carry a zone (Z or
 * ±hh:mm) are parsed as-is.
 */
export function parseShopifyLocalTimestamp(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/.exec(iso);
  if (m) {
    return zonedDate(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
  }
  return new Date(iso);
}

/** All relative presets, ordered shortest → longest, for validation + UI. */
export const PRESET_RANGES: readonly PresetRange[] = [
  "1d",
  "3d",
  "7d",
  "30d",
  "90d",
  "ytd",
  "12m",
  "all",
];

/** Calendar-month selection token, e.g. `m:2026-03`. */
const MONTH_TOKEN_RE = /^m:(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthToken(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_TOKEN_RE.test(value);
}

export function isPresetRange(
  value: string | null | undefined
): value is PresetRange {
  return (
    typeof value === "string" && (PRESET_RANGES as readonly string[]).includes(value)
  );
}

/** Build a token for a specific calendar month (month is 1-12). */
export function monthToken(year: number, month: number): string {
  return `m:${year}-${String(month).padStart(2, "0")}`;
}

export function startOfDay(d: Date): Date {
  const p = zonedParts(d);
  return zonedDate(p.year, p.month, p.day);
}

export function endOfDay(d: Date): Date {
  const p = zonedParts(d);
  return zonedDate(p.year, p.month, p.day, 23, 59, 59, 999);
}

export function startOfWeek(d: Date): Date {
  const p = zonedParts(d);
  const diff = (zonedWeekday(p) + 6) % 7;
  return zonedDate(p.year, p.month, p.day - diff);
}

export function startOfMonth(d: Date): Date {
  const p = zonedParts(d);
  return zonedDate(p.year, p.month, 1);
}

export function bucketStart(d: Date, g: Granularity): Date {
  if (g === "day") return startOfDay(d);
  if (g === "week") return startOfWeek(d);
  return startOfMonth(d);
}

export function nextBucket(d: Date, g: Granularity): Date {
  const p = zonedParts(d);
  if (g === "day") return zonedDate(p.year, p.month, p.day + 1, p.hour, p.minute, p.second);
  if (g === "week") return zonedDate(p.year, p.month, p.day + 7, p.hour, p.minute, p.second);
  return zonedDate(p.year, p.month + 1, 1);
}

/** Eastern calendar date key — avoids UTC ISO shifting labels by a day. */
export function toBucketKey(d: Date, g: Granularity): string {
  const p = zonedParts(d);
  if (g === "month") {
    return `${p.year}-${String(p.month).padStart(2, "0")}`;
  }
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseBucketDate(key: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, day] = key.split("-").map(Number);
    return zonedDate(y, m, day);
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    return zonedDate(y, m, 1);
  }
  return startOfDay(new Date(key));
}

/** Parse order timestamps without UTC date-only off-by-one. */
export function parseOrderTimestamp(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    return zonedDate(y, m, day, 12, 0, 0);
  }
  return parseShopifyLocalTimestamp(iso);
}

const LABEL_TZ = { timeZone: BUSINESS_TIME_ZONE } as const;

/** Short label for chart x-axis ticks — always derived from bucket key. */
export function axisTickLabel(key: string, granularity: Granularity): string {
  const d = parseBucketDate(key);
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { ...LABEL_TZ, month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { ...LABEL_TZ, month: "short", day: "numeric" });
}

export function formatBucketLabel(key: string, g: Granularity): string {
  const d = parseBucketDate(key);
  if (g === "month") {
    return d.toLocaleDateString("en-US", { ...LABEL_TZ, month: "short", year: "2-digit" });
  }
  if (g === "week") {
    return formatWeekRange(d);
  }
  return d.toLocaleDateString("en-US", { ...LABEL_TZ, month: "short", day: "numeric" });
}

export function formatWeekRange(weekStart: Date): string {
  const p = zonedParts(weekStart);
  const end = zonedDate(p.year, p.month, p.day + 6);
  const startFmt = weekStart.toLocaleDateString("en-US", {
    ...LABEL_TZ,
    month: "short",
    day: "numeric",
  });
  const endFmt = end.toLocaleDateString("en-US", {
    ...LABEL_TZ,
    month: "short",
    day: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

/** The Eastern calendar year of an instant. */
function zonedYear(d: Date): number {
  return zonedParts(d).year;
}

export function formatRangeCaption(
  range: { start: Date; end: Date; granularity: Granularity },
  value: string
): string {
  // Calendar month, e.g. "March 2026".
  if (isMonthToken(value)) {
    return range.start.toLocaleDateString("en-US", {
      ...LABEL_TZ,
      month: "long",
      year: "numeric",
    });
  }

  const preset = value;
  const endLabel = range.end.toLocaleDateString("en-US", {
    ...LABEL_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (preset === "1d") {
    return range.end.toLocaleDateString("en-US", {
      ...LABEL_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (
    preset === "3d" ||
    preset === "7d" ||
    preset === "30d" ||
    preset === "90d"
  ) {
    const startLabel = range.start.toLocaleDateString("en-US", {
      ...LABEL_TZ,
      month: "short",
      day: "numeric",
      year: zonedYear(range.start) !== zonedYear(range.end) ? "numeric" : undefined,
    });
    return `${startLabel} – ${endLabel}`;
  }

  if (preset === "ytd") {
    return `Jan 1 – ${endLabel}`;
  }

  if (preset === "12m") {
    const startLabel = range.start.toLocaleDateString("en-US", {
      ...LABEL_TZ,
      month: "short",
      year: "numeric",
    });
    return `${startLabel} – ${endLabel}`;
  }

  const startLabel = range.start.toLocaleDateString("en-US", {
    ...LABEL_TZ,
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function maxBucketsForRange(
  range: { start: Date; end: Date; granularity: Granularity }
): number {
  const start = bucketStart(range.start, range.granularity).getTime();
  const end = bucketStart(range.end, range.granularity).getTime();
  if (end < start) return 1;

  if (range.granularity === "day") {
    return Math.ceil((end - start) / 86_400_000) + 2;
  }
  if (range.granularity === "week") {
    return Math.ceil((end - start) / (86_400_000 * 7)) + 2;
  }
  const startP = zonedParts(new Date(start));
  const endP = zonedParts(new Date(end));
  return (endP.year - startP.year) * 12 + (endP.month - startP.month) + 2;
}

export function presetToRange(
  preset: PresetRange
): { start: Date; end: Date; granularity: Granularity } {
  const now = new Date();
  const p = zonedParts(now);
  const end = zonedDate(p.year, p.month, p.day, 23, 59, 59, 999);
  let start = zonedDate(p.year, p.month, p.day);
  let granularity: Granularity = "day";

  switch (preset) {
    case "1d":
      granularity = "day";
      break;
    case "3d":
      start = zonedDate(p.year, p.month, p.day - 2);
      granularity = "day";
      break;
    case "7d":
      start = zonedDate(p.year, p.month, p.day - 6);
      granularity = "day";
      break;
    case "30d":
      start = zonedDate(p.year, p.month, p.day - 29);
      granularity = "day";
      break;
    case "90d":
      start = zonedDate(p.year, p.month, p.day - 89);
      granularity = "week";
      break;
    case "ytd":
      start = zonedDate(p.year, 1, 1);
      granularity = "month";
      break;
    case "12m":
      start = zonedDate(p.year, p.month - 11, 1);
      granularity = "month";
      break;
    case "all":
    default:
      start = zonedDate(2024, 1, 1);
      granularity = "month";
      break;
  }

  return { start, end, granularity };
}

/** Resolve a calendar-month token (`m:YYYY-MM`) to a concrete date range. */
export function monthTokenToRange(
  token: string
): { start: Date; end: Date; granularity: Granularity } | null {
  const m = MONTH_TOKEN_RE.exec(token);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const start = zonedDate(year, month, 1);
  // Day 0 of the next month is the last day of this month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = zonedDate(year, month, lastDay, 23, 59, 59, 999);
  return { start, end, granularity: "day" };
}

export interface ResolvedRange {
  start: Date;
  end: Date;
  granularity: Granularity;
  /** Normalized selection token echoed back to clients. */
  value: string;
}

/**
 * Resolve any dashboard range selection — a relative preset OR a calendar-month
 * token — to a concrete `{ start, end, granularity }`. Falls back to `30d` (or
 * the supplied fallback) for unknown / missing values. This is the single
 * source of truth shared by the API routes and the dashboard pages.
 */
export function resolveRange(
  value: string | null | undefined,
  fallback: PresetRange = "30d"
): ResolvedRange {
  if (isMonthToken(value)) {
    const r = monthTokenToRange(value);
    if (r) return { ...r, value };
  }
  const preset = isPresetRange(value) ? value : fallback;
  return { ...presetToRange(preset), value: preset };
}

/** Human label for a range selection (preset or month), e.g. for hero copy. */
export function rangeLabel(value: string): string {
  if (isMonthToken(value)) {
    const r = monthTokenToRange(value);
    if (r) {
      return r.start.toLocaleDateString("en-US", {
        ...LABEL_TZ,
        month: "long",
        year: "numeric",
      });
    }
  }
  switch (value) {
    case "1d":
      return "Today";
    case "3d":
      return "Last 3 days";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "ytd":
      return "Year to date";
    case "12m":
      return "Last 12 months";
    case "all":
      return "All time";
    default:
      return "Last 30 days";
  }
}

/**
 * Recent calendar months as `{ token, label }`, newest first — for a month
 * picker dropdown. Computed from `from` (defaults to now), so it's safe to call
 * on the client.
 */
export function recentMonthTokens(
  count = 12,
  from: Date = new Date()
): { token: string; label: string }[] {
  const p = zonedParts(from);
  const out: { token: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = zonedDate(p.year, p.month - i, 1);
    const dp = zonedParts(d);
    out.push({
      token: monthToken(dp.year, dp.month),
      label: d.toLocaleDateString("en-US", { ...LABEL_TZ, month: "long", year: "numeric" }),
    });
  }
  return out;
}

export function buildTimeSeries(
  orders: Array<{
    createdAt: string;
    orderTotal: number;
    commission: number;
  }>,
  range: { start: Date; end: Date; granularity: Granularity }
): TimeSeriesPoint[] {
  const inRange = orders.filter((o) => {
    const t = parseOrderTimestamp(o.createdAt).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  });

  const points: TimeSeriesPoint[] = [];
  let cursor = bucketStart(range.start, range.granularity);
  const endBucket = bucketStart(range.end, range.granularity);
  const maxBuckets = maxBucketsForRange(range);
  let safety = 0;

  while (cursor.getTime() <= endBucket.getTime() && safety < maxBuckets) {
    const next = nextBucket(cursor, range.granularity);
    const slice = inRange.filter((o) => {
      const t = parseOrderTimestamp(o.createdAt).getTime();
      return t >= cursor.getTime() && t < next.getTime();
    });
    const key = toBucketKey(cursor, range.granularity);
    points.push({
      bucket: key,
      label: formatBucketLabel(key, range.granularity),
      revenue: slice.reduce((s, o) => s + o.orderTotal, 0),
      commission: slice.reduce((s, o) => s + o.commission, 0),
      orders: slice.length,
    });
    cursor = next;
    safety++;
  }

  return points;
}
