import { createRng, randomInt } from "./random.js";

export type DaySkipReason = "existing" | "density";

export interface PlannedCommit {
  date: string;
  timestamp: Date;
  message: string;
}

export interface PlannedDay {
  date: string;
  included: boolean;
  skipReason?: DaySkipReason;
  commitCount: number;
  commits: PlannedCommit[];
}

export interface ActivityPlan {
  days: PlannedDay[];
  summary: {
    considered: number;
    skippedExisting: number;
    skippedDensity: number;
    activeDays: number;
    totalCommits: number;
  };
}

export interface PlanOptions {
  from: string;
  to: string;
  min: number;
  max: number;
  density: number;
  /** 0 = no bias, 1 = weekends never scheduled (unless density somehow forces). */
  weekdayBias: number;
  timezone: string;
  existingDays: Set<string>;
  seed?: number;
}

const COMMIT_MESSAGES = [
  "chore: update notes",
  "chore: sync activity log",
  "docs: tweak readme fragment",
  "chore: housekeeping",
  "refactor: minor cleanup",
  "chore: bump log entry",
  "docs: capture daily note",
  "chore: maintain activity trail",
];

export function buildActivityPlan(options: PlanOptions): ActivityPlan {
  const rng = createRng(options.seed);
  const dates = enumerateDates(options.from, options.to);
  const days: PlannedDay[] = [];

  let skippedExisting = 0;
  let skippedDensity = 0;
  let activeDays = 0;
  let totalCommits = 0;

  for (const date of dates) {
    if (options.existingDays.has(date)) {
      skippedExisting += 1;
      days.push({
        date,
        included: false,
        skipReason: "existing",
        commitCount: 0,
        commits: [],
      });
      continue;
    }

    const weekday = weekdayIndex(date);
    const isWeekend = weekday === 0 || weekday === 6;
    // weekdayBias raises effective density on weekdays and lowers it on weekends.
    const bias = options.weekdayBias;
    const effectiveDensity = isWeekend
      ? options.density * (1 - bias)
      : options.density + (1 - options.density) * bias * 0.35;

    const clamped = Math.min(1, Math.max(0, effectiveDensity));
    if (rng() > clamped) {
      skippedDensity += 1;
      days.push({
        date,
        included: false,
        skipReason: "density",
        commitCount: 0,
        commits: [],
      });
      continue;
    }

    const commitCount = randomInt(rng, options.min, options.max);
    const commits = buildCommitsForDay(
      date,
      commitCount,
      options.timezone,
      rng
    );

    activeDays += 1;
    totalCommits += commitCount;
    days.push({
      date,
      included: true,
      commitCount,
      commits,
    });
  }

  return {
    days,
    summary: {
      considered: dates.length,
      skippedExisting,
      skippedDensity,
      activeDays,
      totalCommits,
    },
  };
}

function buildCommitsForDay(
  date: string,
  count: number,
  timezone: string,
  rng: () => number
): PlannedCommit[] {
  const minutes = new Set<number>();
  while (minutes.size < count) {
    // Daytime window roughly 09:00–20:00
    minutes.add(randomInt(rng, 9 * 60, 20 * 60));
  }

  const sorted = [...minutes].sort((a, b) => a - b);
  return sorted.map((minuteOfDay, index) => {
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const second = randomInt(rng, 0, 59);
    const timestamp = zonedLocalDate(
      date,
      hour,
      minute,
      second,
      timezone
    );
    const message =
      COMMIT_MESSAGES[randomInt(rng, 0, COMMIT_MESSAGES.length - 1)] +
      (count > 1 ? ` (${index + 1}/${count})` : "");

    return { date, timestamp, message };
  });
}

export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday (UTC calendar date). */
function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Build a Date whose UTC instant corresponds to the given wall-clock time
 * in `timezone` on `isoDate`.
 */
export function zonedLocalDate(
  isoDate: string,
  hour: number,
  minute: number,
  second: number,
  timezone: string
): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Start with a UTC guess, then correct by the timezone offset at that instant.
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const parts = getTzParts(new Date(utc), timezone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

function getTzParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}
