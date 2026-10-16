import type { GitHubClient } from "./client.js";

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface ContributionsResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: Array<{
          contributionDays: ContributionDay[];
        }>;
      };
    };
  } | null;
}

/**
 * Returns YYYY-MM-DD dates that already have GitHub contributions.
 * GraphQL contributionsCollection is limited to ~1 year per query, so we chunk.
 */
export async function fetchExistingActivityDays(
  client: GitHubClient,
  login: string,
  from: string,
  to: string
): Promise<Set<string>> {
  const days = new Set<string>();
  const chunks = chunkDateRange(from, to, 365);

  for (const chunk of chunks) {
    const data = await client.graphql<ContributionsResponse>(
      `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
      `,
      {
        login,
        from: `${chunk.from}T00:00:00Z`,
        // GitHub treats `to` as exclusive-ish; pad one day to include the end date.
        to: `${addDays(chunk.to, 1)}T00:00:00Z`,
      }
    );

    if (!data.user) {
      throw new Error(`GitHub user not found: ${login}`);
    }

    for (const week of data.user.contributionsCollection.contributionCalendar
      .weeks) {
      for (const day of week.contributionDays) {
        if (
          day.contributionCount > 0 &&
          day.date >= from &&
          day.date <= to
        ) {
          days.add(day.date);
        }
      }
    }
  }

  return days;
}

function chunkDateRange(
  from: string,
  to: string,
  maxDays: number
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const end = minDate(addDays(cursor, maxDays - 1), to);
    chunks.push({ from: cursor, to: end });
    cursor = addDays(end, 1);
  }
  return chunks;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
