import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, Crown, Gift, Layers, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Checkbox, ConfirmDialog,
  EmptyState,
  FieldRow,
  FieldRows,
  IconButton,
  InfoTip,
  Segmented,
  TextField,
  fieldErrorId,
} from "../ui";
import { cn } from "../../utils/cn";
import type { CurrencyCode, SiteTierRecord, TierFeature } from "../../types/site";
import {
  EMPTY_TIER_FORM_DRAFT,
  FREE_TIER_RANK,
  MAX_TIER_FEATURES,
  MAX_TIER_FEATURE_LENGTH,
  byRankDescending,
  isFreeTier,
  resolvedTierKey,
  suggestNextRank,
  tierEditorCta,
  validateTierDraft,
  type TierFieldErrors,
  type TierFormDraft,
  type TierKind,
} from "./tierValidation";
import { formatMinorPlain, formatMinorWithCurrency } from "../../utils/money";
import { currencyExponent } from "../../utils/currencies";
import { pluralize } from "./memberFilters";

export interface TierEditorProps {
  tiers: ReadonlyArray<SiteTierRecord>;
  /** The site currency from Payments. Every tier is priced in it. */
  currency: CurrencyCode;
  loading: boolean;
  saving: boolean;
  failure: { title: string; message: string } | null;
  onRetry: () => void;
  /** Resolves true when saved; the card then closes. False keeps it open with the creator's input. */
  onSave: (draft: TierFormDraft) => Promise<boolean>;
  /** Resolves true when deleted. */
  onDelete: (tier: SiteTierRecord) => Promise<boolean>;
}

function draftFromRecord(tier: SiteTierRecord, currency: CurrencyCode): TierFormDraft {
  const exponent = currencyExponent(currency);
  const text = (minor: number | null) => (minor === null ? "" : formatMinorPlain(minor, exponent));
  return {
    id: tier.id,
    key: tier.key,
    kind: isFreeTier(tier) ? "free" : "paid",
    name: tier.name,
    monthlyPrice: text(tier.monthlyPriceMinor),
    annualPrice: text(tier.annualPriceMinor),
    lifetimePrice: text(tier.lifetimePriceMinor),
    currency,
    rank: String(tier.rank),
    isActive: tier.isActive,
    features: (tier.features ?? []).map((feature) => ({ ...feature })),
  };
}

/** A placeholder price with as many decimals as the currency has: "9.99", "9", "9.990". */
function samplePrice(major: string, exponent: number): string {
  const [whole, fraction = ""] = major.split(".");
  return exponent === 0 ? whole : `${whole}.${fraction.padEnd(exponent, "0").slice(0, exponent)}`;
}

const KIND_OPTIONS: ReadonlyArray<{ value: TierKind; label: string }> = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

/**
 * The tier editor. PRD task 2.3, feature F02; dynamic tiers,
 * `docs/development-docs/23-dynamic-tiers.md`.
 *
 * Each tier is a card, the same accordion as a payment gateway: the bar names
 * the tier and its prices, and opening it puts the form inside the card, not
 * under the whole list. One card is open at a time. Create tier opens a new
 * card where the button was.
 *
 * Carries the Manage tab's one `.primary-cta` (PRD section 7.3): Create tier
 * under the list, or the open card's save, decided by `tierEditorCta`.
 * Validation is `tierValidation.ts`; errors render inline under their field.
 */
export const TierEditor: React.FC<TierEditorProps> = ({
  tiers,
  currency,
  loading,
  saving,
  failure,
  onRetry,
  onSave,
  onDelete,
}) => {
  const [draft, setDraft] = useState<TierFormDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const ordered = useMemo(() => byRankDescending(tiers), [tiers]);
  const hasFreeTier = useMemo(() => tiers.some(isFreeTier), [tiers]);
  const validation = useMemo(() => (draft ? validateTierDraft(draft, tiers) : null), [draft, tiers]);

  /** One value, so one primary CTA (PRD section 7.5). */
  const cta = tierEditorCta({ loading, tierCount: ordered.length, editing: draft !== null });

  const patch = useCallback(
    <Key extends keyof TierFormDraft>(key: Key, value: TierFormDraft[Key]) =>
      setDraft((current) => (current ? { ...current, [key]: value } : current)),
    []
  );

  const startCreate = () => {
    setSubmitted(false);
    // Paid, unless the site has no Free tier yet: then that comes first.
    const kind: TierKind = hasFreeTier ? "paid" : "free";
    setDraft({
      ...EMPTY_TIER_FORM_DRAFT,
      kind,
      currency,
      rank: kind === "free" ? String(FREE_TIER_RANK) : String(suggestNextRank(tiers)),
    });
  };

  /** Open a tier's card, or close it when it is the open one. */
  const toggle = (tier: SiteTierRecord) => {
    setSubmitted(false);
    setDraft((current) => (current?.id === tier.id ? null : draftFromRecord(tier, currency)));
  };

  const setKind = (kind: TierKind) =>
    setDraft((current) =>
      current ? { ...current, kind, rank: kind === "free" ? String(FREE_TIER_RANK) : String(suggestNextRank(tiers)) } : current
    );

  /*
    Nothing is written until Save tier or Create tier, and a successful save
    closes the card. Before, the card stayed open after a create: the list
    reloaded with the new tier in it, and the still-open form was checked
    against itself, saying its own name was taken.
  */
  const submit = async () => {
    setSubmitted(true);
    if (!draft || !validation?.valid || saving) return;
    if (await onSave(draft)) {
      setDraft(null);
      setSubmitted(false);
    }
  };

  const remove = async (tier: SiteTierRecord) => {
    if (await onDelete(tier)) setDraft(null);
  };

  const errors: TierFieldErrors = submitted ? validation?.errors ?? {} : {};

  const form = (open: TierFormDraft) => (
    <TierForm
      draft={open}
      tiers={tiers}
      currency={currency}
      hasFreeTier={hasFreeTier}
      errors={errors}
      saving={saving}
      onPatch={patch}
      onKind={setKind}
      onCancel={() => setDraft(null)}
      onSubmit={() => void submit()}
      onDelete={
        open.id !== null && open.kind === "paid"
          ? () => {
              const tier = tiers.find((entry) => entry.id === open.id);
              if (tier) void remove(tier);
            }
          : null
      }
    />
  );

  return (
    <div className="tiers-panel">
      {failure ? (
        <Banner tone="danger" title={failure.title} message={failure.message} action={{ label: "Try again", onClick: onRetry }} />
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
          description="Start with your Free tier, where every member begins. Then add paid tiers to sell."
          action={
            <Button variant="primary" onClick={startCreate}>
              <Plus aria-hidden={true} />
              Create tier
            </Button>
          }
        />
      ) : null}

      {!loading && (ordered.length > 0 || draft?.id === null) ? (
        <>
          {ordered.length > 0 ? (
            <p className="tiers-count">
              {pluralize(ordered.length, "tier")}. Prices in {currency}.
            </p>
          ) : null}

          <div className="integration-grid">
            {ordered.map((tier) => {
              const open = draft !== null && draft.id === tier.id;
              return (
                <TierCard
                  key={tier.id}
                  id={`tier-card-${tier.id}`}
                  title={tier.name}
                  subtitle={describePrices(tier)}
                  free={isFreeTier(tier)}
                  hidden={!tier.isActive}
                  open={open}
                  onToggle={() => toggle(tier)}
                >
                  {open && draft ? form(draft) : null}
                </TierCard>
              );
            })}

            {draft !== null && draft.id === null ? (
              <TierCard
                id="tier-card-new"
                title={draft.name.trim() || "New tier"}
                subtitle={draft.kind === "free" ? "Everyone starts here" : "Paid"}
                free={draft.kind === "free"}
                hidden={false}
                open={true}
                onToggle={() => setDraft(null)}
              >
                {form(draft)}
              </TierCard>
            ) : null}
          </div>
        </>
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

/** A tier's card: the bar, and the form inside it when open. The gateway card's markup. */
const TierCard: React.FC<{
  id: string;
  title: string;
  subtitle: string;
  free: boolean;
  hidden: boolean;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ id, title, subtitle, free, hidden, open, onToggle, children }) => (
  <article className={cn("integration-card", open && "is-open")}>
    <div
      className="integration-card-bar"
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-controls={`${id}-form`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="integration-card-bar-left">
        <span className="integration-card-icon">{free ? <Gift aria-hidden={true} /> : <Crown aria-hidden={true} />}</span>
        <div className="integration-card-text">
          <span className="integration-card-title">{title}</span>
          <span className="integration-card-sub">{subtitle}</span>
        </div>
      </div>
      <div className="integration-card-bar-right">
        {hidden ? <Badge tone="neutral">Hidden</Badge> : null}
        <Badge tone={free ? "neutral" : "brand"}>{free ? "Free" : "Paid"}</Badge>
        <span className={cn("integration-chevron", open && "is-open")}>
          <ChevronDown aria-hidden={true} />
        </span>
      </div>
    </div>
    {open ? (
      <div className="integration-tier-form" id={`${id}-form`} role="group" aria-label={`${title} details`}>
        {children}
      </div>
    ) : null}
  </article>
);

/** The fields of one tier, inside its open card. */
const TierForm: React.FC<{
  draft: TierFormDraft;
  tiers: ReadonlyArray<SiteTierRecord>;
  currency: CurrencyCode;
  hasFreeTier: boolean;
  errors: TierFieldErrors;
  saving: boolean;
  onPatch: <Key extends keyof TierFormDraft>(key: Key, value: TierFormDraft[Key]) => void;
  onKind: (kind: TierKind) => void;
  onCancel: () => void;
  onSubmit: () => void;
  /** Present for a saved paid tier. The Free tier cannot be deleted. */
  onDelete: (() => void) | null;
}> = ({ draft, tiers, currency, hasFreeTier, errors, saving, onPatch, onKind, onCancel, onSubmit, onDelete }) => {
  const exponent = currencyExponent(currency);
  // Deleting asks first, in a popup (2026-10-19: nothing deletes on one click).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const idPreview = draft.id !== null || draft.name.trim() !== "" ? resolvedTierKey(draft, tiers) : "";
  const describedBy = (field: keyof TierFormDraft, inputId: string) => (errors[field] ? fieldErrorId(inputId) : undefined);

  const price = (field: "monthlyPrice" | "annualPrice" | "lifetimePrice", label: string, inputId: string, sample: string) => (
    <FieldRow label={`${label}, ${currency}`} htmlFor={inputId} error={errors[field]}>
      <TextField
        id={inputId}
        value={draft[field]}
        placeholder={samplePrice(sample, exponent)}
        inputMode="decimal"
        invalid={Boolean(errors[field])}
        aria-describedby={describedBy(field, inputId)}
        onChange={(value) => onPatch(field, value)}
      />
    </FieldRow>
  );

  return (
    <>
      <FieldRows>
        <FieldRow
          label="Type"
          htmlFor="tier-kind"
          error={errors.kind}
          hint="Free is where every member starts, with nothing to pay. A site has one. Paid tiers are what members buy."
          fill
        >
          {draft.id === null ? (
            <Segmented
              label="Tier type"
              options={KIND_OPTIONS.map((option) => ({ ...option, disabled: option.value === "free" && hasFreeTier }))}
              value={draft.kind}
              onChange={onKind}
            />
          ) : (
            <Badge tone="neutral">{draft.kind === "free" ? "Free" : "Paid"}</Badge>
          )}
        </FieldRow>

        <FieldRow label="Name" htmlFor="tier-name" error={errors.name} fill>
          <TextField
            id="tier-name"
            value={draft.name}
            placeholder={draft.kind === "free" ? "Free" : "Gold"}
            invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name", "tier-name")}
            onChange={(value) => onPatch("name", value)}
            fill
          />
        </FieldRow>

        <FieldRow
          label="ID"
          htmlFor="tier-id"
          error={errors.key}
          hint="Made from the name. Gates, locks, and plans use it, so it never changes once saved."
          fill
        >
          <span id="tier-id">
            {idPreview ? <code className="code-chip">{idPreview}</code> : <span className="settings-help">From the name</span>}
          </span>
        </FieldRow>

        {draft.kind === "paid" ? (
          <>
            <FieldRow label="Level" htmlFor="tier-rank" error={errors.rank} hint="Higher levels include everything below them. Free is level 0.">
              <TextField
                id="tier-rank"
                value={draft.rank}
                inputMode="numeric"
                invalid={Boolean(errors.rank)}
                aria-describedby={describedBy("rank", "tier-rank")}
                onChange={(value) => onPatch("rank", value)}
              />
            </FieldRow>
            {price("monthlyPrice", "Monthly", "tier-monthly", "9.99")}
            {price("annualPrice", "Annual", "tier-annual", "99.00")}
            {price("lifetimePrice", "Lifetime", "tier-lifetime", "249.00")}
          </>
        ) : null}

        {/*
          A checkbox, not a toggle. PRD section 7.5: a toggle is for
          instant-apply only, and this change is not applied until Save.
        */}
        <FieldRow label="Visible to members" htmlFor="tier-active">
          <Checkbox id="tier-active" checked={draft.isActive} onChange={(checked) => onPatch("isActive", checked)} />
        </FieldRow>
      </FieldRows>

      <TierFeatures
        features={draft.features}
        error={errors.features}
        disabled={saving}
        onChange={(features) => onPatch("features", features)}
      />

      <div className="integration-card-actions">
        {onDelete ? (
          <Button
            variant="danger"
            size="sm"
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden={true} />
            Delete tier
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/*
        The primary on its own row. The kit's .primary-cta is full width by
        design, so in one row with Delete and Cancel it pushed them out of a
        360px panel and only Save showed.
      */}
      <div className="tier-form-cta">
        <Button variant="primary" size="md" className="fill" disabled={saving} onClick={onSubmit}>
          {saving ? "Saving" : draft.id === null ? "Create tier" : "Save tier"}
        </Button>
      </div>

      {confirmDelete && onDelete ? (
        <ConfirmDialog
          title={draft.name.trim() ? `Delete the ${draft.name.trim()} tier?` : "Delete this tier?"}
          message={
            <>
              <p>Pages, sections, and paywalls set to this tier lock for everyone until you choose another tier for them.</p>
              <p>A tier members still hold cannot be deleted. This cannot be undone.</p>
            </>
          }
          confirmLabel="Delete tier"
          cancelLabel="Keep tier"
          busy={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
        />
      ) : null}
    </>
  );
};

/**
 * The tier's pricing card lines (28-tier-features.md): each one a checkbox for
 * whether the tier includes it, the text, and a remove button. Removing asks
 * first, in a popup, even though nothing is written until Save tier
 * (2026-10-19: nothing is removed on one click).
 */
const TierFeatures: React.FC<{
  features: ReadonlyArray<TierFeature>;
  error: string | undefined;
  disabled: boolean;
  onChange: (features: TierFeature[]) => void;
}> = ({ features, error, disabled, onChange }) => {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const setRow = (index: number, patch: Partial<TierFeature>) =>
    onChange(features.map((feature, i) => (i === index ? { ...feature, ...patch } : feature)));
  const removing = removingIndex === null ? null : features[removingIndex];

  return (
    <div className="tier-features" role="group" aria-label="Features">
      {/* The explanation is an info tip beside the title, as FieldRow does: never a paragraph. */}
      <div className="tier-features-head">
        <span className="tier-features-title">Features</span>
        <InfoTip label="Features">
          Shown on this tier's pricing card, in this order. Untick a line the tier does not include: it shows with a
          cross, so buyers see what a higher tier adds.
        </InfoTip>
      </div>

      {features.map((feature, index) => (
        <div key={index} className={cn("tier-feature-row", !feature.included && "is-excluded")}>
          <Checkbox
            id={`tier-feature-included-${index}`}
            ariaLabel={`Feature ${index + 1} included`}
            checked={feature.included}
            disabled={disabled}
            onChange={(included) => setRow(index, { included })}
          />
          <TextField
            id={`tier-feature-text-${index}`}
            aria-label={`Feature ${index + 1}`}
            value={feature.text}
            placeholder={index === 0 ? "All courses" : "Another feature"}
            maxLength={MAX_TIER_FEATURE_LENGTH}
            invalid={Boolean(error) && feature.text.trim() === ""}
            disabled={disabled}
            onChange={(text) => setRow(index, { text })}
            fill
            muted={!feature.included}
          />
          <IconButton label="Remove feature" variant="ghost" disabled={disabled} onClick={() => setRemovingIndex(index)}>
            <X aria-hidden={true} />
          </IconButton>
        </div>
      ))}

      {error ? (
        <span className="field-error-message" role="alert">
          {error}
        </span>
      ) : null}

      <div className="tier-features-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || features.length >= MAX_TIER_FEATURES}
          onClick={() => onChange([...features, { text: "", included: true }])}
        >
          <Plus aria-hidden={true} />
          <span>Add feature</span>
        </Button>
      </div>

      {removing ? (
        <ConfirmDialog
          title={removing.text.trim() ? `Remove "${removing.text.trim()}"?` : "Remove this feature?"}
          message={<p>It leaves this tier's pricing card when you save the tier. Until then, Cancel keeps it.</p>}
          confirmLabel="Remove feature"
          cancelLabel="Keep feature"
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            const index = removingIndex;
            setRemovingIndex(null);
            if (index !== null) onChange(features.filter((_, i) => i !== index));
          }}
        />
      ) : null}
    </div>
  );
};

/** The line under a tier's name: its prices, or for the Free tier, what it is. */
function describePrices(tier: SiteTierRecord): string {
  if (isFreeTier(tier)) return "Everyone starts here";

  const exponent = currencyExponent(tier.currency);
  const parts: string[] = [];
  if (tier.monthlyPriceMinor !== null) parts.push(`${formatMinorWithCurrency(tier.monthlyPriceMinor, tier.currency, exponent)} monthly`);
  if (tier.annualPriceMinor !== null) parts.push(`${formatMinorWithCurrency(tier.annualPriceMinor, tier.currency, exponent)} annual`);
  if (tier.lifetimePriceMinor !== null) parts.push(`${formatMinorWithCurrency(tier.lifetimePriceMinor, tier.currency, exponent)} lifetime`);
  return parts.length === 0 ? "No price yet" : parts.join(". ");
}
