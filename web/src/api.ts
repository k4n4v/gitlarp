export interface PlanFormValues {
  repo: string;
  from: string;
  to: string;
  min: number;
  max: number;
  density: number;
  weekdayBias: number;
  timezone: string;
  seed: string;
  authorName: string;
  authorEmail: string;
  allowPublic: boolean;
}

export interface DayCell {
  date: string;
  beforeCount: number;
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

export interface HealthResponse {
  ok: boolean;
  tokenConfigured: boolean;
}

function toBody(values: PlanFormValues) {
  return {
    repo: values.repo.trim(),
    from: values.from,
    to: values.to,
    min: values.min,
    max: values.max,
    density: values.density,
    weekdayBias: values.weekdayBias,
    timezone: values.timezone,
    seed: values.seed === "" ? undefined : Number(values.seed),
    authorName: values.authorName.trim() || undefined,
    authorEmail: values.authorEmail.trim() || undefined,
    allowPublic: values.allowPublic,
  };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("API not reachable. Is the server running?");
  return res.json();
}

export async function fetchPreview(
  values: PlanFormValues
): Promise<PreviewResponse> {
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(values)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Preview failed");
  return data;
}

export async function pushPlan(values: PlanFormValues): Promise<{
  ok: boolean;
  message: string;
  commits: number;
  repo: string;
}> {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(values)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Push failed");
  return data;
}
