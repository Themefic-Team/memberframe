import React, { useCallback, useMemo, useState } from "react";
import { Layers, Plus, Trash2, X } from "lucide-react";
import {
  Banner,
  Button,
  Checkbox,
  EmptyState,
  FieldRow,
  FieldRows,
  IconButton,
  Select,
  TextField,
  fieldErrorId,
} from "../ui";
import { cn } from "../../utils/cn";
import type { CurrencyCode, SiteTierRecord } from "../../types/site";
import {
  CUSTOM_TIER_KEY,
  EMPTY_TIER_FORM_DRAFT,
  tierEditorCta,
  tierKeyOptions,
  byRankDescending,
  resolvedTierKey,
  suggestNextRank,
  validateTierDraft,
  type ExtraPriceDraft,
  type TierFormDraft,
} from "./tierValidation";
import { formatMinorPlain, formatMinorWithCurrency } from "../../utils/money";
import { pluralize } from "./memberFilters";

const CURRENCY_OPTIONS: ReadonlyArray<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "INR", label: "INR" },
];

export interface TierEditorProps {
  tiers: ReadonlyArray<SiteTierRecord>;
  loading: boolean;
  saving: boolean;
  failure: { title: string; message: string } | null;
  onRetry: () => void;
  onSave: (draft: TierFormDraft) => void;
}

function draftFromRecord(tier: SiteTierRecord): TierFormDraft {
  return {
    id: tier.id,
    key: tier.key,
    name: tier.name,
    monthlyPrice: tier.monthlyPriceMinor === null ? "" : formatMinorPlain(tier.monthlyPriceMinor),
    annualPrice: tier.annualPriceMinor === null ? "" : formatMinorPlain(tier.annualPriceMinor),
    lifetimePrice:
      tier.lifetimePriceMinor === null ? "" : formatMinorPlain(tier.lifetimePriceMinor),
    currency: tier.currency,
    rank: String(tier.rank),
    isActive: tier.isActive,
    extraPrices: extraDraftsFrom(tier),
  };
}

/** The stored extra prices, grouped one draft per currency. */
function extraDraftsFrom(tier: SiteTierRecord): ExtraPriceDraft[] {
  const byCurrency = new Map<CurrencyCode, ExtraPriceDraft>();
  for (const price of tier.extraPrices ?? []) {
    const entry = byCurrency.get(price.currency) ?? { currency: price.currency, monthly: "", annual: "", lifetime: "" };
    const text = formatMinorPlain(price.amountMinor);
    if (price.interval === "month") entry.monthly = text;
    else if (price.interval === "year") entry.annual = text;
    else entry.lifetime = text;
    byCurrency.set(price.currency, entry);
  }
  return [...byCurrency.values()];
}

/**
 * The tier editor. PRD task 2.3, feature F02.
 *
 * Carries the Manage tab's one `.primary-cta`, "Create tier", per PRD section
 * 7.3. The Members segment has none, which is why that segment's empty state
 * uses a secondary button to get here.
 *
 * Validation is `tierValidation.ts` and nothing is validated in this file. The
 * rank uniqueness rule is the most consequential logic in F02, because
 * `isEntitled` compares ranks, and with no DOM test environment (blocker B5)
 * logic living in a submit handler is logic nothing can check.
 *
 * Errors are rendered inline under their own field through `FieldRow`'s `error`
 * prop, never promoted to a banner. PRD section 7.5's feedback hierarchy sends
 * a field error inline, a persistent state to a banner, and a finished action
 * to a toast.
 */
export const TierEditor: React.FC<TierEditorProps> = ({
  tiers,
  loading,
  saving,
  failure,
  onRetry,
  onSave,
}) => {
  const [draft, setDraft] = useState<TierFormDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const ordered = useMemo(() => byRankDescending(tiers), [tiers]);
  const validation = useMemo(
    () => (draft ? validateTierDraft(draft, tiers) : null),
    [draft, tiers]
  );

  /**
   * One value, so one primary CTA. PRD section 7.5 allows exactly one per view,
   * and this segment has three candidate buttons. Deciding between them in a
   * pure function makes the rule structural rather than an argument about three
   * separate JSX guards staying in step.
   */
  const cta = tierEditorCta({ loading, tierCount: ordered.length, editing: draft !== null });

  const patch = useCallback(
    <Key extends keyof TierFormDraft>(key: Key, value: TierFormDraft[Key]) =>
      setDraft((current) => (current ? { ...current, [key]: value } : current)),
    []
  );

  const startCreate = () => {
    setSubmitted(false);
    // The first built in key no tier uses yet, or a custom one once all four are taken.
    const firstKey = tierKeyOptions({ ...EMPTY_TIER_FORM_DRAFT }, tiers)[0]?.value ?? CUSTOM_TIER_KEY;
    setDraft({ ...EMPTY_TIER_FORM_DRAFT, key: firstKey, rank: String(suggestNextRank(tiers)), extraPrices: [] });
  };

  const updateExtra = (index: number, next: Partial<ExtraPriceDraft>) =>
    setDraft((current) =>
      current
        ? { ...current, extraPrices: current.extraPrices.map((entry, position) => (position === index ? { ...entry, ...next } : entry)) }
        : current
    );

  const addExtra = () =>
    setDraft((current) => {
      if (!current) return current;
      const free = CURRENCY_OPTIONS.find(
        (option) => option.value !== current.currency && !current.extraPrices.some((entry) => entry.currency === option.value)
      );
      if (!free) return current;
      return { ...current, extraPrices: [...current.extraPrices, { currency: free.value, monthly: "", annual: "", lifetime: "" }] };
    });

  const removeExtra = (index: number) =>
    setDraft((current) =>
      current ? { ...current, extraPrices: current.extraPrices.filter((_, position) => position !== index) } : current
    );

  const startEdit = (tier: SiteTierRecord) => {
    setSubmitted(false);
    setDraft(draftFromRecord(tier));
  };

  const submit = () => {
    setSubmitted(true);
    if (draft && validation?.valid) onSave(draft);
  };

  /** Only show an error once the creator has tried to save, or left the field dirty. */
  const errorFor = (field: keyof TierFormDraft): string | undefined =>
    submitted ? validation?.errors[field] : undefined;

  return (
    <div className="tiers-panel">
      {failure ? (
        <Banner
          tone="danger"
          title={failure.title}
          message={failure.message}
          action={{ label: "Try again", onClick: onRetry }}
        />
      ) : null}

      {loading ? (
        <div className="tiers-list" aria-busy={true} aria-label="Loading tiers">
          {[0, 1].map((index) => (
            <div key={index} className="member-row-skeleton" />
          ))}
        </div>
      ) : null}

      {cta === "empty_create" ? (
        <EmptyState
          icon={<Layers aria-hidden={true} />}
          title="No Tiers Yet"
          description="A tier is what a member pays for. Create one to start selling access."
          action={
            <Button variant="primary" onClick={startCreate}>
              <Plus aria-hidden={true} />
              Create tier
            </Button>
          }
        />
      ) : null}

      {!loading && ordered.length > 0 ? (
        <>
          <p className="tiers-count">{pluralize(ordered.length, "tier")}</p>

          <div className="tiers-list">
            {ordered.map((tier) => (
              <button
                key={tier.id}
                type="button"
                className={cn("tier-row", !tier.isActive && "is-inactive")}
                onClick={() => startEdit(tier)}
              >
                <span className="tier-row-rank" aria-hidden={true}>
                  {tier.rank}
                </span>
                <span className="tier-row-body">
                  <span className="tier-row-name">{tier.name}</span>
                  <span className="tier-row-prices">
                    {describePrices(tier)}
                  </span>
                </span>
                {tier.isActive ? null : <span className="badge badge-neutral">Hidden</span>}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {draft ? (
        <div className="tier-form" role="group" aria-label="Tier details">
          <div className="tier-form-head">
            <span className="tier-form-title">
              {draft.id === null ? "New Tier" : `Edit ${draft.name || "Tier"}`}
            </span>
            <IconButton label="Close tier editor" variant="ghost" onClick={() => setDraft(null)}>
              <X aria-hidden={true} />
            </IconButton>
          </div>

          <FieldRows>
            <FieldRow label="Name" htmlFor="tier-name" error={errorFor("name")} fill>
              <TextField
                id="tier-name"
                value={draft.name}
                placeholder="Silver"
                invalid={Boolean(errorFor("name"))}
                aria-describedby={errorFor("name") ? fieldErrorId("tier-name") : undefined}
                onChange={(value) => patch("name", value)}
                fill
              />
            </FieldRow>

            <FieldRow
              label="Tier type"
              htmlFor="tier-key"
              error={errorFor("key")}
              hint="Built in types are Free, Silver, Gold, and VIP. Custom makes a key from the name, so you can have as many tiers as you like. The key cannot change once saved, because gates use it."
              fill
            >
              <Select
                id="tier-key"
                value={draft.key}
                options={tierKeyOptions(draft, tiers)}
                disabled={draft.id !== null}
                onChange={(value) => patch("key", value)}
                fill
              />
            </FieldRow>

            {draft.id === null && draft.key === CUSTOM_TIER_KEY && draft.name.trim() !== "" ? (
              <p className="settings-help">
                Saved as <code className="code-chip">{resolvedTierKey(draft, tiers)}</code>
              </p>
            ) : null}

            <FieldRow label="Rank" htmlFor="tier-rank" error={errorFor("rank")}>
              <TextField
                id="tier-rank"
                value={draft.rank}
                inputMode="numeric"
                invalid={Boolean(errorFor("rank"))}
                aria-describedby={errorFor("rank") ? fieldErrorId("tier-rank") : undefined}
                onChange={(value) => patch("rank", value)}
              />
            </FieldRow>

            <FieldRow label="Currency" htmlFor="tier-currency">
              <Select
                id="tier-currency"
                value={draft.currency}
                options={CURRENCY_OPTIONS}
                onChange={(value) => patch("currency", value)}
              />
            </FieldRow>

            <FieldRow label="Monthly" htmlFor="tier-monthly" error={errorFor("monthlyPrice")}>
              <TextField
                id="tier-monthly"
                value={draft.monthlyPrice}
                placeholder="9.99"
                inputMode="decimal"
                invalid={Boolean(errorFor("monthlyPrice"))}
                aria-describedby={
                  errorFor("monthlyPrice") ? fieldErrorId("tier-monthly") : undefined
                }
                onChange={(value) => patch("monthlyPrice", value)}
              />
            </FieldRow>

            <FieldRow label="Annual" htmlFor="tier-annual" error={errorFor("annualPrice")}>
              <TextField
                id="tier-annual"
                value={draft.annualPrice}
                placeholder="99.00"
                inputMode="decimal"
                invalid={Boolean(errorFor("annualPrice"))}
                aria-describedby={errorFor("annualPrice") ? fieldErrorId("tier-annual") : undefined}
                onChange={(value) => patch("annualPrice", value)}
              />
            </FieldRow>

            <FieldRow label="Lifetime" htmlFor="tier-lifetime" error={errorFor("lifetimePrice")}>
              <TextField
                id="tier-lifetime"
                value={draft.lifetimePrice}
                placeholder="249.00"
                inputMode="decimal"
                invalid={Boolean(errorFor("lifetimePrice"))}
                aria-describedby={
                  errorFor("lifetimePrice") ? fieldErrorId("tier-lifetime") : undefined
                }
                onChange={(value) => patch("lifetimePrice", value)}
              />
            </FieldRow>

            {draft.extraPrices.map((extra, index) => (
              <React.Fragment key={`${extra.currency}-${index}`}>
                <FieldRow
                  label="Currency"
                  htmlFor={`tier-extra-${index}-currency`}
                  hint="Buyers whose country uses this currency see these prices instead. India sees INR, which Razorpay needs."
                >
                  <div className="integration-input">
                    <Select
                      id={`tier-extra-${index}-currency`}
                      value={extra.currency}
                      options={CURRENCY_OPTIONS.filter((option) => option.value !== draft.currency)}
                      onChange={(value) => updateExtra(index, { currency: value })}
                    />
                    <IconButton label={`Remove ${extra.currency} prices`} variant="ghost" onClick={() => removeExtra(index)}>
                      <Trash2 aria-hidden={true} />
                    </IconButton>
                  </div>
                </FieldRow>
                <FieldRow label={`${extra.currency} monthly`} htmlFor={`tier-extra-${index}-monthly`}>
                  <TextField
                    id={`tier-extra-${index}-monthly`}
                    value={extra.monthly}
                    inputMode="decimal"
                    onChange={(value) => updateExtra(index, { monthly: value })}
                  />
                </FieldRow>
                <FieldRow label={`${extra.currency} annual`} htmlFor={`tier-extra-${index}-annual`}>
                  <TextField
                    id={`tier-extra-${index}-annual`}
                    value={extra.annual}
                    inputMode="decimal"
                    onChange={(value) => updateExtra(index, { annual: value })}
                  />
                </FieldRow>
                <FieldRow label={`${extra.currency} lifetime`} htmlFor={`tier-extra-${index}-lifetime`}>
                  <TextField
                    id={`tier-extra-${index}-lifetime`}
                    value={extra.lifetime}
                    inputMode="decimal"
                    onChange={(value) => updateExtra(index, { lifetime: value })}
                  />
                </FieldRow>
              </React.Fragment>
            ))}

            {errorFor("extraPrices") ? (
              <p className="integration-field-problem" role="alert">
                {errorFor("extraPrices")}
              </p>
            ) : null}

            {draft.extraPrices.length < CURRENCY_OPTIONS.length - 1 ? (
              <div className="tier-extra-add">
                <Button variant="secondary" size="sm" onClick={addExtra}>
                  <Plus aria-hidden={true} />
                  Add currency
                </Button>
              </div>
            ) : null}

            {/*
              A checkbox, not a toggle. PRD section 7.5: a toggle is for
              instant-apply only, and this change is not applied until Save.
            */}
            <FieldRow label="Visible to members" htmlFor="tier-active">
              <Checkbox
                id="tier-active"
                checked={draft.isActive}
                onChange={(checked) => patch("isActive", checked)}
              />
            </FieldRow>
          </FieldRows>

          <div className="tier-form-cta">
            <Button variant="primary" size="md" className="fill" disabled={saving} onClick={submit}>
              <Plus aria-hidden={true} />
              {draft.id === null ? "Create tier" : "Save tier"}
            </Button>
          </div>
        </div>
      ) : null}

      {cta === "list_create" ? (
        <div className="tiers-cta">
          <Button variant="primary" size="md" className="fill" onClick={startCreate}>
            <Plus aria-hidden={true} />
            Create tier
          </Button>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The price line under a tier name.
 *
 * A tier with no price at all is legitimate: PRD section 12.2 lists a free
 * member tier. It reads "Free" rather than showing nothing, so the row never
 * looks unfinished.
 */
function describePrices(tier: SiteTierRecord): string {
  const parts: string[] = [];

  if (tier.monthlyPriceMinor !== null) {
    parts.push(`${formatMinorWithCurrency(tier.monthlyPriceMinor, tier.currency)} monthly`);
  }
  if (tier.annualPriceMinor !== null) {
    parts.push(`${formatMinorWithCurrency(tier.annualPriceMinor, tier.currency)} annual`);
  }
  if (tier.lifetimePriceMinor !== null) {
    parts.push(`${formatMinorWithCurrency(tier.lifetimePriceMinor, tier.currency)} lifetime`);
  }

  const extra = [...new Set((tier.extraPrices ?? []).map((price) => price.currency))];
  if (extra.length > 0) parts.push(`also ${extra.join(", ")}`);

  return parts.length === 0 ? "Free" : parts.join(". ");
}
