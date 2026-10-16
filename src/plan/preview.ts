import type { ActivityPlan } from "./calendar.js";

export interface PreviewContext {
  host: string;
  repo: string;
  from: string;
  to: string;
  min: number;
  max: number;
  density: number;
  timezone: string;
  mode: "dry-run" | "push";
}

export function formatPreview(
  plan: ActivityPlan,
  ctx: PreviewContext
): string {
  const lines: string[] = [];
  lines.push("gitlarp preview");
  lines.push("===============");
  lines.push(`Host:     ${ctx.host}`);
  lines.push(`Repo:     ${ctx.repo}`);
  lines.push(`Range:    ${ctx.from} → ${ctx.to}`);
  lines.push(`Timezone: ${ctx.timezone}`);
  lines.push(`Commits:  ${ctx.min}–${ctx.max} / active day`);
  lines.push(`Density:  ${ctx.density}`);
  lines.push(`Mode:     ${ctx.mode}`);
  lines.push("");
  lines.push("Summary");
  lines.push("-------");
  lines.push(`Days considered:     ${plan.summary.considered}`);
  lines.push(`Skipped (existing):  ${plan.summary.skippedExisting}`);
  lines.push(`Skipped (density):   ${plan.summary.skippedDensity}`);
  lines.push(`Active days:         ${plan.summary.activeDays}`);
  lines.push(`Total commits:       ${plan.summary.totalCommits}`);
  lines.push("");
  lines.push("Calendar (x = existing activity | . = density skip | digit = commits)");
  lines.push("-----------------------------------------------------------------");
  lines.push(renderCalendar(plan));
  lines.push("");
  lines.push("Active days");
  lines.push("-----------");

  const active = plan.days.filter((d) => d.included);
  if (active.length === 0) {
    lines.push("(none)");
  } else {
    for (const day of active) {
      lines.push(`  ${day.date}  ×${day.commitCount}`);
    }
  }

  if (ctx.mode === "dry-run") {
    lines.push("");
    lines.push("Dry-run only. Re-run with --push to create and push commits.");
  } else {
    lines.push("");
    lines.push("About to create and push the commits listed above.");
  }

  return lines.join("\n");
}

function renderCalendar(plan: ActivityPlan): string {
  const byDate = new Map(plan.days.map((d) => [d.date, d]));
  if (plan.days.length === 0) return "(empty range)";

  const first = plan.days[0].date;
  const last = plan.days[plan.days.length - 1].date;
  const startPad = weekdayIndex(first); // 0 Sun

  const cells: string[] = [];
  for (let i = 0; i < startPad; i++) cells.push("   ");

  let cursor = first;
  while (cursor <= last) {
    const day = byDate.get(cursor);
    let cell: string;
    if (!day) {
      cell = "   ";
    } else if (!day.included) {
      cell = day.skipReason === "existing" ? " x " : " . ";
    } else if (day.commitCount >= 10) {
      cell = " 9+";
    } else {
      cell = ` ${day.commitCount} `;
    }
    cells.push(cell);
    cursor = addDays(cursor, 1);
  }

  const header = "Su Mo Tu We Th Fr Sa";
  const rows: string[] = [header];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7).join(""));
  }
  return rows.join("\n");
}

function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
