#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { Command } from "commander";
import { type GitlarpConfig, validateConfig } from "./config.js";
import { GitHubClient, getCurrentUser } from "./github/client.js";
import { fetchExistingActivityDays } from "./github/contributions.js";
import { httpsCloneUrl, parseRepoInput, resolveRepo } from "./github/repo.js";
import { buildActivityPlan } from "./plan/calendar.js";
import { formatPreview } from "./plan/preview.js";
import { applyCommits, resolveAuthor } from "./git/repo.js";

const program = new Command();

program
  .name("gitlarp")
  .description(
    "Paint realistic GitHub contribution activity into a dedicated private repo"
  )
  .version("0.1.0")
  .requiredOption(
    "-r, --repo <url>",
    "GitHub repo URL or owner/name (e.g. https://github.com/you/gitlarp-activity)"
  )
  .requiredOption("--from <date>", "Start date inclusive (YYYY-MM-DD)")
  .requiredOption("--to <date>", "End date inclusive (YYYY-MM-DD)")
  .option(
    "-t, --token <token>",
    "GitHub personal access token",
    process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  )
  .option("--min <n>", "Minimum commits per active day", "1")
  .option("--max <n>", "Maximum commits per active day", "3")
  .option("--density <n>", "Probability an eligible day gets commits (0-1)", "0.65")
  .option(
    "--weekday-bias <n>",
    "Prefer weekdays over weekends (0-1)",
    "0.35"
  )
  .option(
    "--timezone <tz>",
    "IANA timezone for day boundaries and commit times",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  )
  .option("--workdir <path>", "Local clone directory")
  .option("--author-name <name>", "Commit author name")
  .option("--author-email <email>", "Commit author email (must match GitHub)")
  .option("--seed <n>", "Optional RNG seed for reproducible plans")
  .option("--push", "Create commits and push after preview", false)
  .option("-y, --yes", "Skip confirmation prompt when using --push", false)
  .option("--allow-public", "Allow non-private target repos", false)
  .action(async (opts) => {
    try {
      await run(opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

const GITHUB_HOST = "https://github.com";

async function run(opts: Record<string, unknown>): Promise<void> {
  const repoInput = String(opts.repo);
  const parsedRepo = parseRepoInput(repoInput);

  const config: GitlarpConfig = {
    token: String(opts.token ?? ""),
    host: GITHUB_HOST,
    repo: parsedRepo.fullName,
    from: String(opts.from),
    to: String(opts.to),
    min: Number(opts.min),
    max: Number(opts.max),
    density: Number(opts.density),
    weekdayBias: Number(opts.weekdayBias),
    timezone: String(opts.timezone),
    push: Boolean(opts.push),
    yes: Boolean(opts.yes),
    allowPublic: Boolean(opts.allowPublic),
    workdir: opts.workdir ? String(opts.workdir) : undefined,
    authorName: opts.authorName ? String(opts.authorName) : undefined,
    authorEmail: opts.authorEmail ? String(opts.authorEmail) : undefined,
    seed: opts.seed !== undefined ? Number(opts.seed) : undefined,
  };

  validateConfig(config);
  warnIfExtreme(config);

  const client = new GitHubClient(config.host, config.token);
  console.error("Fetching GitHub user…");
  const user = await getCurrentUser(client);
  console.error(`Authenticated as @${user.login}`);

  console.error(`Resolving repository ${config.repo}…`);
  const repo = await resolveRepo(client, repoInput, {
    allowPublic: config.allowPublic,
  });

  console.error("Loading existing contribution days…");
  const existingDays = await fetchExistingActivityDays(
    client,
    user.login,
    config.from,
    config.to
  );
  console.error(`Found ${existingDays.size} day(s) with existing activity.`);

  const plan = buildActivityPlan({
    from: config.from,
    to: config.to,
    min: config.min,
    max: config.max,
    density: config.density,
    weekdayBias: config.weekdayBias,
    timezone: config.timezone,
    existingDays,
    seed: config.seed,
  });

  const preview = formatPreview(plan, {
    host: config.host,
    repo: repo.full_name,
    from: config.from,
    to: config.to,
    min: config.min,
    max: config.max,
    density: config.density,
    timezone: config.timezone,
    mode: config.push ? "push" : "dry-run",
  });
  console.log(preview);

  if (!config.push) {
    return;
  }

  if (plan.summary.totalCommits === 0) {
    console.error("Nothing to push.");
    return;
  }

  if (!config.yes) {
    const ok = await confirm("Proceed with creating and pushing commits?");
    if (!ok) {
      console.error("Aborted.");
      return;
    }
  }

  const workdir =
    config.workdir ??
    path.join(process.cwd(), ".workdir", repo.full_name.replace(/\//g, "__"));

  const author = await resolveAuthor(process.cwd(), {
    name: config.authorName ?? user.name ?? user.login,
    email: config.authorEmail ?? user.email ?? undefined,
  });

  const cloneUrl = httpsCloneUrl(config.host, repo.full_name, config.token);

  const commits = plan.days.flatMap((d) => d.commits);
  await applyCommits({
    workdir,
    cloneUrl,
    defaultBranch: repo.default_branch || "main",
    commits,
    authorName: author.name,
    authorEmail: author.email,
    push: true,
  });

  console.log(
    `\nDone. Pushed ${commits.length} commit(s) to ${repo.full_name}.`
  );
  console.log(
    "Tip: deleting that private repo removes these commits from your contribution graph."
  );
}

function warnIfExtreme(config: GitlarpConfig): void {
  const from = new Date(`${config.from}T00:00:00Z`);
  const to = new Date(`${config.to}T00:00:00Z`);
  const daySpan =
    Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const maxCommits = daySpan * config.max;

  if (daySpan > 730) {
    console.error(
      `Warning: date range spans ${daySpan} days (> 2 years).`
    );
  }
  if (maxCommits > 10_000) {
    console.error(
      `Warning: plan could create up to ${maxCommits} commits.`
    );
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!input.isTTY) {
    throw new Error("Confirmation required but stdin is not a TTY. Pass --yes.");
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

program.parseAsync(process.argv);
