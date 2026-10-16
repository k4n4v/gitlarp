export interface PlanRequestBody {
  repo: string;
  from: string;
  to: string;
  min?: number;
  max?: number;
  density?: number;
  weekdayBias?: number;
  timezone?: string;
  seed?: number;
  authorName?: string;
  authorEmail?: string;
  allowPublic?: boolean;
}

export interface DayCell {
  date: string;
  /** Existing contribution count proxy: 0 or 1 from calendar presence. */
  beforeCount: number;
  /** After = before + planned commits for that day. */
  afterCount: number;
  planned: boolean;
  skipReason?: "existing" | "density";
}

export interface PreviewResponse {
  user: string;
  repo: string;
  host: string;
  from: string;
  to: string;
  summary: {
    considered: number;
    skippedExisting: number;
    skippedDensity: number;
    activeDays: number;
    totalCommits: number;
  };
  days: DayCell[];
}

export function parsePlanBody(body: unknown): PlanRequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;
  const repo = String(b.repo ?? "").trim();
  const from = String(b.from ?? "").trim();
  const to = String(b.to ?? "").trim();

  if (!repo) throw new Error("repo is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("from must be YYYY-MM-DD");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("to must be YYYY-MM-DD");
  }
  if (from > to) throw new Error("from must be on or before to");

  const min = b.min !== undefined ? Number(b.min) : 1;
  const max = b.max !== undefined ? Number(b.max) : 3;
  const density = b.density !== undefined ? Number(b.density) : 0.65;
  const weekdayBias =
    b.weekdayBias !== undefined ? Number(b.weekdayBias) : 0.35;

  if (!Number.isInteger(min) || min < 1) {
    throw new Error("min must be an integer >= 1");
  }
  if (!Number.isInteger(max) || max < min) {
    throw new Error("max must be an integer >= min");
  }
  if (density < 0 || density > 1) {
    throw new Error("density must be between 0 and 1");
  }
  if (weekdayBias < 0 || weekdayBias > 1) {
    throw new Error("weekdayBias must be between 0 and 1");
  }

  return {
    repo,
    from,
    to,
    min,
    max,
    density,
    weekdayBias,
    timezone:
      typeof b.timezone === "string" && b.timezone
        ? b.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    seed: b.seed !== undefined && b.seed !== "" ? Number(b.seed) : undefined,
    authorName:
      typeof b.authorName === "string" && b.authorName
        ? b.authorName
        : undefined,
    authorEmail:
      typeof b.authorEmail === "string" && b.authorEmail
        ? b.authorEmail
        : undefined,
    allowPublic: Boolean(b.allowPublic),
  };
}
