import { GitHubClient, GitHubError } from "./client.js";

export interface GitHubRepo {
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  ssh_url: string;
}

export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
  /** Present when --repo was a URL; can override --host. */
  host?: string;
}

/**
 * Accepts owner/name, HTTPS URLs, or SSH URLs.
 * Examples:
 *   you/gitlarp-activity
 *   https://github.com/you/gitlarp-activity
 *   https://github.com/you/gitlarp-activity.git
 *   git@github.com:you/gitlarp-activity.git
 */
export function parseRepoInput(input: string): ParsedRepo {
  const raw = input.trim();
  if (!raw) {
    throw new Error('Invalid --repo. Pass a URL or "owner/name".');
  }

  let host: string | undefined;
  let pathPart = raw;

  const sshMatch = raw.match(/^git@([^:]+):(.+)$/i);
  if (sshMatch) {
    host = `https://${sshMatch[1]}`;
    pathPart = sshMatch[2];
  } else if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Invalid --repo URL: ${raw}`);
    }
    host = `${url.protocol}//${url.host}`;
    pathPart = url.pathname;
  }

  pathPart = pathPart.replace(/^\/+/, "").replace(/\.git$/i, "");
  // Drop trailing UI paths like /tree/main or /pulls
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(
      `Invalid --repo "${input}". Use a repo URL or owner/name.`
    );
  }

  const owner = segments[0];
  const name = segments[1];
  return { owner, name, fullName: `${owner}/${name}`, host };
}

export async function resolveRepo(
  client: GitHubClient,
  repoInput: string,
  options: { allowPublic: boolean }
): Promise<GitHubRepo> {
  const parsed = parseRepoInput(repoInput);

  let project: GitHubRepo;
  try {
    const { data } = await client.request<GitHubRepo>(
      `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`
    );
    project = data;
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) {
      throw new Error(
        `Repository not found: ${parsed.fullName}. Create a private empty repo on GitHub first.`
      );
    }
    throw err;
  }

  if (!project.private && !options.allowPublic) {
    throw new Error(
      `Repository ${parsed.fullName} is public. Use a private repo, or pass --allow-public.`
    );
  }

  return project;
}

export function httpsCloneUrl(
  host: string,
  fullName: string,
  token: string
): string {
  const base = host.replace(/\/$/, "").replace(/^https?:\/\//, "");
  return `https://x-access-token:${token}@${base}/${fullName}.git`;
}
