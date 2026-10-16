# gitlarp

Paint realistic GitHub contribution activity into a **dedicated private repo**.

gitlarp plans backdated commits over a date range, skips days that already have activity, randomly skips other days for realism, and always shows a dry-run preview before pushing.

## How to start and run

### 1. Prerequisites

- **Node.js 20+**
- An empty **private** GitHub repo (e.g. `you/gitlarp-activity`) with default branch `main`
- A GitHub personal access token (see [Token permissions](#token-permissions))
- A **verified** email on your GitHub account (Settings → Emails) — commits must use that email or squares won’t count

### 2. Install

```bash
npm install
npm install --prefix web
```

### 3. Configure the token

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

### 4. Start the web app (recommended)

```bash
npm run web
```

Then open:

| Service | URL |
|---------|-----|
| Web UI | [http://localhost:3000](http://localhost:3000) |
| Local API | [http://localhost:8787](http://localhost:8787) |

In the UI:

1. Paste your private repo URL
2. Set the date range, commits/day, density, etc.
3. Click **Preview** to see the before/after contribution graph
4. Click **Push to GitHub** only after the preview looks right (uses `.env` token; never entered in the browser)

Stop with `Ctrl+C` in the terminal.

### 5. Or run the CLI instead

```bash
npm run build
# uses GITHUB_TOKEN from .env / environment
npm run dev -- \
  --repo https://github.com/you/gitlarp-activity \
  --from 2025-01-01 \
  --to 2025-06-30 \
  --min 1 \
  --max 3 \
  --density 0.7
```

Add `--push` after reviewing to create and push commits. Add `--yes` to skip the confirm prompt.

`--repo` also accepts `owner/name` or `git@github.com:you/gitlarp-activity.git`.

## Token permissions

### Classic personal access token (simplest)

Create at [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**.

Required scope:

- **`repo`** — full control of private repositories (needed to push to your private activity repo and read contribution data tied to private work)

That single scope is enough for dry-run + push.

### Fine-grained personal access token

Create at [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).

- **Resource owner:** your user
- **Repository access:** Only select the private activity repo (e.g. `gitlarp-activity`)
- **Permissions:**
  - **Contents:** Read and write (clone + push commits)
  - **Metadata:** Read (required)

## CLI options

| Flag | Description |
|------|-------------|
| `--repo` | Repo URL or `owner/name` |
| `--from` / `--to` | Inclusive date range (`YYYY-MM-DD`) |
| `--min` / `--max` | Commits per active day (default `1`–`3`) |
| `--density` | Chance an eligible day gets commits (default `0.65`) |
| `--weekday-bias` | Prefer weekdays over weekends (default `0.35`) |
| `--timezone` | IANA timezone (defaults to your system zone) |
| `--token` | PAT (or `GITHUB_TOKEN` / `GH_TOKEN`) |
| `--push` | Create commits and push after preview |
| `--yes` | Skip interactive confirm |
| `--workdir` | Local clone directory |
| `--author-name` / `--author-email` | Override git author |
| `--seed` | Reproducible random plan |
| `--allow-public` | Allow a non-private target repo |

## How it works

1. Authenticates with your PAT and resolves the target private repo.
2. Loads existing contribution days from GitHub’s contribution calendar (GraphQL) and **skips** them.
3. For remaining days, includes each day with probability `--density` (with mild weekday bias).
4. Picks a random commit count in `--min`–`--max` and daytime timestamps.
5. Shows a preview (CLI text calendar or web before/after heatmap).
6. With push, clones the repo (into `.workdir/…` by default), appends lines to `.gitlarp/log`, creates backdated commits on the default branch, and pushes.

## Undo

Delete the dedicated private repo on GitHub. Those commits leave your contribution graph once GitHub recalculates (can take a few minutes). Real commits in other repos are unaffected.

## Safety

- Default mode is dry-run / preview.
- Public repos are refused unless `--allow-public` / the UI checkbox.
- The token lives in `.env` for the web UI and is never printed.
- Extreme ranges (> 2 years or > 10k possible commits) print a warning in the CLI.
