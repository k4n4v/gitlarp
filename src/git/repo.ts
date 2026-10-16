import { mkdir, appendFile, access } from "node:fs/promises";
import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import type { PlannedCommit } from "../plan/calendar.js";

export interface ApplyOptions {
  workdir: string;
  cloneUrl: string;
  defaultBranch: string;
  commits: PlannedCommit[];
  authorName: string;
  authorEmail: string;
  push: boolean;
}

export async function applyCommits(options: ApplyOptions): Promise<void> {
  await mkdir(options.workdir, { recursive: true });

  const git = simpleGit({ baseDir: options.workdir });
  const isRepo = await pathExists(path.join(options.workdir, ".git"));

  if (!isRepo) {
    console.error(`Cloning into ${options.workdir}…`);
    await simpleGit().clone(options.cloneUrl, options.workdir);
  } else {
    await git.fetch();
  }

  const branch = options.defaultBranch || "main";
  const branches = await git.branchLocal();
  if (branches.all.includes(branch)) {
    await git.checkout(branch);
  } else {
    // Empty project may have no commits yet.
    const remotes = await git.branch(["-r"]);
    const remoteBranch = remotes.all.find((b) => b.endsWith(`/${branch}`));
    if (remoteBranch) {
      await git.checkout(["-B", branch, remoteBranch]);
    } else {
      await ensureInitialBranch(git, branch);
    }
  }

  const logDir = path.join(options.workdir, ".gitlarp");
  const logFile = path.join(logDir, "log");
  await mkdir(logDir, { recursive: true });

  const logExists = await pathExists(logFile);
  if (!logExists) {
    await appendFile(logFile, "# gitlarp activity log\n", "utf8");
  }

  let created = 0;
  for (const commit of options.commits) {
    const iso = commit.timestamp.toISOString();
    const line = `${iso} ${commit.message}\n`;
    await appendFile(logFile, line, "utf8");
    await git.add(".gitlarp/log");

    await git
      .env({
        GIT_AUTHOR_DATE: iso,
        GIT_COMMITTER_DATE: iso,
        GIT_AUTHOR_NAME: options.authorName,
        GIT_AUTHOR_EMAIL: options.authorEmail,
        GIT_COMMITTER_NAME: options.authorName,
        GIT_COMMITTER_EMAIL: options.authorEmail,
      })
      .commit(commit.message);

    created += 1;
    if (created % 25 === 0 || created === options.commits.length) {
      console.error(`Created ${created}/${options.commits.length} commits…`);
    }
  }

  if (options.push) {
    console.error("Pushing to origin…");
    // Set remote URL with token for this push without printing it.
    await git.remote(["set-url", "origin", options.cloneUrl]);
    await git.push(["-u", "origin", branch]);
    console.error("Push complete.");
  }
}

async function ensureInitialBranch(
  git: SimpleGit,
  branch: string
): Promise<void> {
  // Brand-new empty repo: create orphan branch; first planned commit initializes history.
  await git.checkout(["--orphan", branch]);
  try {
    await git.raw(["rm", "-rf", "--cached", "."]);
  } catch {
    // ignore when nothing is cached
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolveAuthor(
  workdir: string,
  overrides: { name?: string; email?: string }
): Promise<{ name: string; email: string }> {
  const git = simpleGit({ baseDir: workdir });
  let name = overrides.name;
  let email = overrides.email;

  if (!name) {
    try {
      name = (await git.getConfig("user.name")).value ?? undefined;
    } catch {
      name = undefined;
    }
  }
  if (!email) {
    try {
      email = (await git.getConfig("user.email")).value ?? undefined;
    } catch {
      email = undefined;
    }
  }

  // Fall back to global config via a temp git in cwd.
  if (!name || !email) {
    const globalGit = simpleGit();
    if (!name) {
      try {
        name = (await globalGit.getConfig("user.name")).value ?? undefined;
      } catch {
        /* ignore */
      }
    }
    if (!email) {
      try {
        email = (await globalGit.getConfig("user.email")).value ?? undefined;
      } catch {
        /* ignore */
      }
    }
  }

  if (!name || !email) {
    throw new Error(
      "Git author name/email required. Set git config user.name / user.email, or pass --author-name and --author-email. Email must match a verified email on your GitHub account for contributions to count."
    );
  }

  return { name, email };
}
