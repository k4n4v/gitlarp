import type { FormEvent } from "react";
import type { PlanFormValues } from "../api";

interface Props {
  values: PlanFormValues;
  onChange: (next: PlanFormValues) => void;
  onPreview: () => void;
  onPush: () => void;
  loading: boolean;
  pushing: boolean;
  canPush: boolean;
}

export default function PlanForm({
  values,
  onChange,
  onPreview,
  onPush,
  loading,
  pushing,
  canPush,
}: Props) {
  const set =
    <K extends keyof PlanFormValues>(key: K) =>
    (value: PlanFormValues[K]) =>
      onChange({ ...values, [key]: value });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onPreview();
  };

  return (
    <form className="plan-form" onSubmit={handleSubmit}>
      <label className="field wide">
        <span>Repository URL</span>
        <input
          required
          placeholder="https://github.com/you/gitlarp-activity"
          value={values.repo}
          onChange={(e) => set("repo")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>From</span>
        <input
          type="date"
          required
          value={values.from}
          onChange={(e) => set("from")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>To</span>
        <input
          type="date"
          required
          value={values.to}
          onChange={(e) => set("to")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Min commits / day</span>
        <input
          type="number"
          min={1}
          value={values.min}
          onChange={(e) => set("min")(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span>Max commits / day</span>
        <input
          type="number"
          min={1}
          value={values.max}
          onChange={(e) => set("max")(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span>Density ({values.density.toFixed(2)})</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={values.density}
          onChange={(e) => set("density")(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span>Weekday bias ({values.weekdayBias.toFixed(2)})</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={values.weekdayBias}
          onChange={(e) => set("weekdayBias")(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span>Timezone</span>
        <input
          value={values.timezone}
          onChange={(e) => set("timezone")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Seed (optional)</span>
        <input
          inputMode="numeric"
          placeholder="reproducible plan"
          value={values.seed}
          onChange={(e) => set("seed")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Author name</span>
        <input
          placeholder="optional override"
          value={values.authorName}
          onChange={(e) => set("authorName")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Author email</span>
        <input
          type="email"
          placeholder="must match verified GitHub email"
          value={values.authorEmail}
          onChange={(e) => set("authorEmail")(e.target.value)}
        />
      </label>

      <label className="field check">
        <input
          type="checkbox"
          checked={values.allowPublic}
          onChange={(e) => set("allowPublic")(e.target.checked)}
        />
        <span>Allow public repo</span>
      </label>

      <div className="actions">
        <button type="submit" className="btn primary" disabled={loading || pushing}>
          {loading ? "Planning…" : "Preview"}
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={!canPush || loading || pushing}
          onClick={onPush}
        >
          {pushing ? "Pushing…" : "Push to GitHub"}
        </button>
      </div>
    </form>
  );
}
