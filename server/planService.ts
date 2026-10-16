import path from "node:path";
import { GitHubClient, getCurrentUser } from "../src/github/client.js";
import { fetchExistingActivityDays } from "../src/github/contributions.js";
import {
  httpsCloneUrl,
  parseRepoInput,
  resolveRepo,
} from "../src/github/repo.js";
import { buildActivityPlan } from "../src/plan/calendar.js";
import { applyCommits, resolveAuthor } from "../src/git/repo.js";
import type { PlanRequestBody, PreviewResponse } from "./types.js";

const GITHUB_HOST = "https://github.com";

export function getToken(): string {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    ""
  );
}

export async function buildPreview(
  body: PlanRequestBody
): Promise<PreviewResponse> {
  const token = getToken();
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. Copy .env.example to .env and add your token."
    );
  }

  parseRepoInput(body.repo);
  const host = GITHUB_HOST;
  const client = new GitHubClient(host, token);

  const user = await getCurrentUser(client);
  const repo = await resolveRepo(client, body.repo, {
    allowPublic: Boolean(body.allowPublic),
  });

  const existingDays = await fetchExistingActivityDays(
    client,
    user.login,
    body.from,
    body.to
  );

  const plan = buildActivityPlan({
    from: body.from,
    to: body.to,
    min: body.min ?? 1,
    max: body.max ?? 3,
    density: body.density ?? 0.65,
    weekdayBias: body.weekdayBias ?? 0.35,
    timezone: body.timezone ?? "UTC",
    existingDays,
    seed: body.seed,
  });

  const days = plan.days.map((d) => {
    const beforeCount = existingDays.has(d.date) ? 1 : 0;
    const afterCount = beforeCount + (d.included ? d.commitCount : 0);
    return {
      date: d.date,
      beforeCount,
      afterCount,
      planned: d.included,
      skipReason: d.skipReason,
    };
  });

  return {
    user: user.login,
    repo: repo.full_name,
    host,
    from: body.from,
    to: body.to,
    summary: plan.summary,
    days,
  };
}

export async function runPush(body: PlanRequestBody): Promise<{
  repo: string;
  commits: number;
  user: string;
}> {
  const token = getToken();
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. Copy .env.example to .env and add your token."
    );
  }

  parseRepoInput(body.repo);
  const host = GITHUB_HOST;
  const client = new GitHubClient(host, token);

  const user = await getCurrentUser(client);
  const repo = await resolveRepo(client, body.repo, {
    allowPublic: Boolean(body.allowPublic),
  });

  const existingDays = await fetchExistingActivityDays(
    client,
    user.login,
    body.from,
    body.to
  );

  const plan = buildActivityPlan({
    from: body.from,
    to: body.to,
    min: body.min ?? 1,
    max: body.max ?? 3,
    density: body.density ?? 0.65,
    weekdayBias: body.weekdayBias ?? 0.35,
    timezone: body.timezone ?? "UTC",
    existingDays,
    seed: body.seed,
  });

  const commits = plan.days.flatMap((d) => d.commits);
  if (commits.length === 0) {
    throw new Error("Nothing to push — plan has zero commits.");
  }

  const workdir = path.join(
    process.cwd(),
    ".workdir",
    repo.full_name.replace(/\//g, "__")
  );

  const author = await resolveAuthor(process.cwd(), {
    name: body.authorName ?? user.name ?? user.login,
    email: body.authorEmail ?? user.email ?? undefined,
  });

  const cloneUrl = httpsCloneUrl(host, repo.full_name, token);

  await applyCommits({
    workdir,
    cloneUrl,
    defaultBranch: repo.default_branch || "main",
    commits,
    authorName: author.name,
    authorEmail: author.email,
    push: true,
  });

  return {
    repo: repo.full_name,
    commits: commits.length,
    user: user.login,
  };
}
