import { useEffect, useState } from "react";
import {
  fetchHealth,
  fetchPreview,
  pushPlan,
  type PlanFormValues,
  type PreviewResponse,
} from "./api";
import ContributionGraph from "./components/ContributionGraph";
import PlanForm from "./components/PlanForm";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - 3);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const range = defaultRange();

const initialValues: PlanFormValues = {
  repo: "",
  from: range.from,
  to: range.to,
  min: 1,
  max: 3,
  density: 0.65,
  weekdayBias: 0.35,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  seed: "",
  authorName: "",
  authorEmail: "",
  allowPublic: false,
};

export default function App() {
  const [values, setValues] = useState<PlanFormValues>(initialValues);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => setTokenConfigured(h.tokenConfigured))
      .catch(() => setTokenConfigured(null));
  }, []);

  const onPreview = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data = await fetchPreview(values);
      setPreview(data);
      setStatus(
        `Preview for @${data.user} → ${data.repo}: ${data.summary.totalCommits} planned commits across ${data.summary.activeDays} days.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const onPush = async () => {
    if (!preview) return;
    const ok = window.confirm(
      `Push ${preview.summary.totalCommits} commit(s) to ${preview.repo}?\n\nThis uses GITHUB_TOKEN from your local .env.`
    );
    if (!ok) return;

    setPushing(true);
    setError(null);
    setStatus(null);
    try {
      const result = await pushPlan(values);
      setStatus(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />
      <main className="shell">
        <header className="brand">
          <p className="eyebrow">localhost</p>
          <h1>gitlarp</h1>
          <p className="lede">
            Paint a believable GitHub contribution graph into a private repo.
            Preview first — push only when it looks right.
          </p>
          <p
            className={`token-pill ${
              tokenConfigured === false
                ? "bad"
                : tokenConfigured === null
                  ? "unknown"
                  : ""
            }`}
          >
            {tokenConfigured === false
              ? "Set GITHUB_TOKEN in .env with the repo scope, then restart npm run web"
              : tokenConfigured === null
                ? "API offline — run npm run web"
                : "Ensure GITHUB_TOKEN is set in .env with repo permissions"}
          </p>
        </header>

        <PlanForm
          values={values}
          onChange={setValues}
          onPreview={onPreview}
          onPush={onPush}
          loading={loading}
          pushing={pushing}
          canPush={Boolean(preview && preview.summary.totalCommits > 0)}
        />

        {error ? <p className="banner error">{error}</p> : null}
        {status ? <p className="banner ok">{status}</p> : null}

        {preview ? (
          <div className="preview-panel">
            <div className="summary-row">
              <div>
                <strong>{preview.summary.considered}</strong>
                <span>days considered</span>
              </div>
              <div>
                <strong>{preview.summary.skippedExisting}</strong>
                <span>skipped (existing)</span>
              </div>
              <div>
                <strong>{preview.summary.skippedDensity}</strong>
                <span>skipped (density)</span>
              </div>
              <div>
                <strong>{preview.summary.activeDays}</strong>
                <span>active days</span>
              </div>
              <div>
                <strong>{preview.summary.totalCommits}</strong>
                <span>total commits</span>
              </div>
            </div>

            <ContributionGraph
              title="Before"
              subtitle="Existing contribution days in range"
              days={preview.days}
              mode="before"
            />
            <ContributionGraph
              title="After"
              subtitle="Existing activity plus planned commits"
              days={preview.days}
              mode="after"
            />
          </div>
        ) : (
          <p className="empty-hint">
            Set your private repo and date range, then hit Preview to see the
            before/after mock.
          </p>
        )}
      </main>
    </div>
  );
}
