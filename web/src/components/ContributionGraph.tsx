import type { DayCell } from "../api";

interface Props {
  title: string;
  subtitle?: string;
  days: DayCell[];
  mode: "before" | "after";
}

function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function buildWeeks(days: DayCell[]): Array<Array<DayCell | null>> {
  if (days.length === 0) return [];

  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = days[0].date;
  const last = days[days.length - 1].date;

  const startPad = weekdayIndex(first);
  const cells: Array<DayCell | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);

  let cursor = first;
  while (cursor <= last) {
    cells.push(byDate.get(cursor) ?? null);
    cursor = addDays(cursor, 1);
  }

  const weeks: Array<Array<DayCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
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

export default function ContributionGraph({
  title,
  subtitle,
  days,
  mode,
}: Props) {
  const weeks = buildWeeks(days);
  const labels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <section className="graph-block">
      <header className="graph-header">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      <div className="graph-scroll">
        <div className="graph-grid" role="img" aria-label={title}>
          <div className="graph-dow">
            {labels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="graph-weeks">
            {weeks.map((week, wi) => (
              <div className="graph-week" key={wi}>
                {week.map((day, di) => {
                  if (!day) {
                    return <span className="cell empty" key={`${wi}-${di}`} />;
                  }
                  const count =
                    mode === "before" ? day.beforeCount : day.afterCount;
                  const level = levelForCount(count);
                  const isNew = mode === "after" && day.planned;
                  return (
                    <span
                      key={day.date}
                      className={`cell level-${level}${isNew ? " planned" : ""}`}
                      title={`${day.date}: ${count} contribution${count === 1 ? "" : "s"}${isNew ? " (planned)" : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="graph-legend">
        <span>Less</span>
        <span className="cell level-0" />
        <span className="cell level-1" />
        <span className="cell level-2" />
        <span className="cell level-3" />
        <span className="cell level-4" />
        <span>More</span>
      </div>
    </section>
  );
}
