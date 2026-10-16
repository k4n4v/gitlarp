export interface GitlarpConfig {
  token: string;
  host: string;
  repo: string;
  from: string;
  to: string;
  min: number;
  max: number;
  density: number;
  weekdayBias: number;
  timezone: string;
  push: boolean;
  yes: boolean;
  allowPublic: boolean;
  workdir?: string;
  authorName?: string;
  authorEmail?: string;
  seed?: number;
}

export function validateConfig(config: GitlarpConfig): void {
  if (!config.token) {
    throw new Error(
      "GitHub token required. Set GITHUB_TOKEN (or GH_TOKEN) or pass --token."
    );
  }
  if (!config.repo) {
    throw new Error(
      "Repository required. Pass --repo with a URL or owner/name."
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.from)) {
    throw new Error(`Invalid --from date: ${config.from} (use YYYY-MM-DD)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.to)) {
    throw new Error(`Invalid --to date: ${config.to} (use YYYY-MM-DD)`);
  }
  if (config.from > config.to) {
    throw new Error("--from must be on or before --to");
  }
  if (!Number.isInteger(config.min) || config.min < 1) {
    throw new Error("--min must be an integer >= 1");
  }
  if (!Number.isInteger(config.max) || config.max < config.min) {
    throw new Error("--max must be an integer >= --min");
  }
  if (config.density < 0 || config.density > 1) {
    throw new Error("--density must be between 0 and 1");
  }
  if (config.weekdayBias < 0 || config.weekdayBias > 1) {
    throw new Error("--weekday-bias must be between 0 and 1");
  }
}