import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Copy, Eye, EyeOff, Plus, Send, Trash2, Webhook, X } from "lucide-react";
import { Banner, Button, Checkbox, ConfirmDialog, EmptyState, FieldRow, FieldRows, IconButton, Segmented, Select, TextField, Toggle, useToast } from "../ui";
import { failureMessage } from "../../services/apiClient";
import {
  FIELD_KEY_PATTERN,
  FIELD_SOURCE_LABELS,
  MAX_FIELD_MAP,
  ZOHO_CRM_PRESET,
  previewBody,
  type FieldMapping,
  type PreviewMember,
  MAX_WEBHOOKS,
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  createWebhook,
  deleteWebhook,
  deliveryLabel,
  emptyWebhookDraft,
  fetchWebhookDeliveries,
  fetchWebhooks,
  testWebhook,
  updateWebhook,
  webhookDraftProblem,
  type SiteWebhook,
  type WebhookDelivery,
  type WebhookDraft,
  type WebhookEventType,
} from "../../services/webhooksService";
import type { TierLadderEntry } from "../../types/member";
import type { CustomFieldDefinition } from "../../utils/customFields";
import { cn } from "../../utils/cn";

export interface WebhooksPanelProps {
  siteId: string | null;
  tiers: ReadonlyArray<TierLadderEntry>;
  /** The site's profile fields, offered as values to send. */
  profileFields: ReadonlyArray<CustomFieldDefinition>;
  siteName: string;
}

const draftOf = (hook: SiteWebhook): WebhookDraft => ({
  name: hook.name,
  url: hook.url,
  events: [...hook.events],
  tiers: [...hook.tiers],
  enabled: hook.enabled,
  fieldMap: hook.fieldMap ? hook.fieldMap.map((row) => ({ ...row })) : null,
});

const sameDraft = (a: WebhookDraft, b: WebhookDraft) => JSON.stringify(a) === JSON.stringify(b);

/** Keep a toast inside the kit's 45 character limit. */
const short = (text: string) => (text.length > 45 ? `${text.slice(0, 44)}.` : text);

/**
 * Webhooks: member events posted to the creator's other tools. Development
 * doc: docs/development-docs/20-webhooks.md
 *
 * Each webhook is a card: where to send, which events, which plans. Send test
 * proves the address works before a real member is involved, and Recent
 * deliveries shows what happened to each event.
 */
export const WebhooksPanel: React.FC<WebhooksPanelProps> = ({ siteId, tiers, profileFields, siteName }) => {
  const showToast = useToast();
  const [webhooks, setWebhooks] = useState<SiteWebhook[] | null>(null);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [adding, setAdding] = useState<WebhookDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!siteId) return;
    const result = await fetchWebhooks(siteId);
    if (result.kind === "ok") {
      setWebhooks(result.data.webhooks);
      setFailure(null);
    } else {
      setFailure(failureMessage(result));
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (hook: SiteWebhook) =>
    setWebhooks((current) => (current ?? []).map((entry) => (entry.id === hook.id ? hook : entry)));

  const handleCreate = async () => {
    if (!siteId || !adding || webhookDraftProblem(adding)) return;
    setBusy(true);
    const result = await createWebhook(siteId, adding);
    setBusy(false);
    if (result.kind === "ok") {
      setWebhooks((current) => [...(current ?? []), result.data.webhook]);
      setAdding(null);
      showToast({ tone: "success", message: "Webhook added. Send a test" });
    } else {
      showToast({ tone: "error", message: short(failureMessage(result).message) });
    }
  };

  if (!siteId) {
    return (
      <Banner tone="warning" title="Connect this project first" message="Webhooks are stored against the connected site." />
    );
  }

  const count = webhooks?.length ?? 0;

  return (
    <section className="section-group">
      <div className="section-header">
        <h2 className="section-title">Webhooks</h2>
        <p className="section-subtitle">
          Send sign ups, profile changes, and plan changes to Zapier, Make, Zoho Flow, n8n, or your server.
        </p>
      </div>

      {failure ? <Banner tone="warning" title={failure.title} message={failure.message} /> : null}
      {webhooks === null && !failure ? <p className="settings-help">Loading webhooks.</p> : null}

      <div className="page-rules-list">
        {(webhooks ?? []).map((hook) => (
          <WebhookCard
            key={hook.id}
            siteId={siteId}
            hook={hook}
            tiers={tiers}
            profileFields={profileFields}
            siteName={siteName}
            onChange={replace}
            onDelete={() => setWebhooks((current) => (current ?? []).filter((entry) => entry.id !== hook.id))}
          />
        ))}

        {adding ? (
          <div className="page-rule-card is-open">
            <div className="page-rule-card-header">
              <div className="page-rule-info">
                <span className="page-rule-title">New webhook</span>
              </div>
            </div>
            <div className="page-rule-card-body">
              <WebhookForm idPrefix="webhook-new" draft={adding} tiers={tiers} profileFields={profileFields} siteName={siteName} disabled={busy} onChange={setAdding} />
              <FormProblem draft={adding} />
              <div className="onpage-guide-actions">
                <Button variant="secondary" size="sm" disabled={busy || webhookDraftProblem(adding) !== null} onClick={() => void handleCreate()}>
                  <span>{busy ? "Saving" : "Save webhook"}</span>
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAdding(null)}>
                  <span>Cancel</span>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!adding && webhooks !== null && count === 0 ? (
        <EmptyState
          icon={<Webhook aria-hidden={true} />}
          title="No Webhooks Yet"
          description="Paste a webhook URL from Zapier, Make, or Zoho Flow, then send a test."
          action={
            <Button variant="secondary" onClick={() => setAdding(emptyWebhookDraft())}>
              <Plus aria-hidden={true} />
              Add webhook
            </Button>
          }
        />
      ) : null}

      {!adding && count > 0 ? (
        <div className="page-locks-btn-row">
          <Button variant="secondary" onClick={() => setAdding(emptyWebhookDraft())} disabled={count >= MAX_WEBHOOKS}>
            <Plus aria-hidden={true} />
            <span>Add webhook</span>
          </Button>
        </div>
      ) : null}
      {count >= MAX_WEBHOOKS ? <p className="settings-help">{`A site can have ${MAX_WEBHOOKS} webhooks.`}</p> : null}
    </section>
  );
};

/** The shared fields of a new or an existing webhook. */
const WebhookForm: React.FC<{
  idPrefix: string;
  draft: WebhookDraft;
  tiers: ReadonlyArray<TierLadderEntry>;
  profileFields: ReadonlyArray<CustomFieldDefinition>;
  siteName: string;
  disabled: boolean;
  onChange: (draft: WebhookDraft) => void;
}> = ({ idPrefix, draft, tiers, profileFields, siteName, disabled, onChange }) => {
  const ordered = useMemo(() => [...tiers].sort((a, b) => a.rank - b.rank), [tiers]);

  const toggleEvent = (event: WebhookEventType, on: boolean) =>
    onChange({ ...draft, events: on ? [...draft.events, event] : draft.events.filter((entry) => entry !== event) });
  const toggleTier = (key: string, on: boolean) =>
    onChange({ ...draft, tiers: on ? [...draft.tiers, key] : draft.tiers.filter((entry) => entry !== key) });

  return (
    <>
      <FieldRows>
        <FieldRow label="Name" htmlFor={`${idPrefix}-name`}>
          <TextField id={`${idPrefix}-name`} value={draft.name} disabled={disabled} placeholder="Zoho CRM" onChange={(name) => onChange({ ...draft, name })} />
        </FieldRow>
        <FieldRow
          label="URL"
          htmlFor={`${idPrefix}-url`}
          hint="A Zapier Catch Hook, Make Custom webhook, or Zoho Flow Webhook trigger. Failed sends retry for about 9 hours."
        >
          <TextField
            id={`${idPrefix}-url`}
            value={draft.url}
            disabled={disabled}
            placeholder="https://hooks.example.com/..."
            onChange={(url) => onChange({ ...draft, url })}
          />
        </FieldRow>
      </FieldRows>

      <div className="webhook-checks" role="group" aria-label="Events">
        <span className="webhook-checks-title">Send when</span>
        {WEBHOOK_EVENTS.map((event) => (
          <Checkbox key={event} checked={draft.events.includes(event)} disabled={disabled} onChange={(on) => toggleEvent(event, on)}>
            {WEBHOOK_EVENT_LABELS[event]}
          </Checkbox>
        ))}
      </div>

      <div className="webhook-checks" role="group" aria-label="Plans">
        <span className="webhook-checks-title">For members on</span>
        <Checkbox checked={draft.tiers.length === 0} disabled={disabled} onChange={(on) => on && onChange({ ...draft, tiers: [] })}>
          All plans
        </Checkbox>
        {ordered.map((tier) => (
          <Checkbox key={tier.key} checked={draft.tiers.includes(tier.key)} disabled={disabled} onChange={(on) => toggleTier(tier.key, on)}>
            {tier.name}
          </Checkbox>
        ))}
      </div>

      <FieldMapEditor idPrefix={idPrefix} draft={draft} tiers={ordered} profileFields={profileFields} siteName={siteName} disabled={disabled} onChange={onChange} />
    </>
  );
};

/** A believable value of each field type, for the preview. */
function sampleValue(field: CustomFieldDefinition): unknown {
  switch (field.type) {
    case "boolean":
      return true;
    case "number":
      return 1;
    case "select":
      return field.options[0] ?? null;
    case "url":
      return "https://example.com";
    case "phone":
      return "+1 555 0100";
    default:
      return `Sample ${field.label}`;
  }
}

const FORMAT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Choose fields" },
] as const;

/**
 * Fields sent: the standard payload, or the creator's own keys.
 *
 * Each row is "send this value as this key". The preview below is the exact
 * body the receiving service gets for the sample member Send test uses, so
 * the creator can map it in Zoho Flow or Zapier before any real member exists.
 */
const FieldMapEditor: React.FC<{
  idPrefix: string;
  draft: WebhookDraft;
  tiers: ReadonlyArray<TierLadderEntry>;
  profileFields: ReadonlyArray<CustomFieldDefinition>;
  siteName: string;
  disabled: boolean;
  onChange: (draft: WebhookDraft) => void;
}> = ({ idPrefix, draft, tiers, profileFields, siteName, disabled, onChange }) => {
  const map = draft.fieldMap;
  const sourceOptions = useMemo(
    () => [
      ...FIELD_SOURCE_LABELS,
      ...profileFields.map((field) => ({ value: `profile.${field.key}`, label: `Profile: ${field.label}` })),
    ],
    [profileFields]
  );

  const sample = useMemo<PreviewMember>(() => {
    const top = tiers[tiers.length - 1];
    // The Free tier is rank 0, whatever its key (23-dynamic-tiers.md).
    const free = tiers.find((tier) => tier.rank === 0);
    const profile: Record<string, unknown> = {};
    for (const field of profileFields) profile[field.key] = sampleValue(field);
    return {
      email: "jordan@example.com",
      name: "Jordan Okafor",
      status: "active",
      tier: { key: top?.key ?? free?.key ?? "free", name: top?.name ?? "Free" },
      previousTier: { key: free?.key ?? "free", name: free?.name ?? "Free" },
      profile,
    };
  }, [tiers, profileFields]);

  const setMap = (next: FieldMapping[] | null) => onChange({ ...draft, fieldMap: next });
  const setRow = (index: number, patch: Partial<FieldMapping>) =>
    setMap((map ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const preview = map
    ? previewBody(map, sample, "member.tier_changed", siteName)
    : { type: "member.tier_changed", site: { name: siteName }, member: { email: sample.email, name: sample.name, tier: sample.tier, profile: sample.profile }, previousTier: sample.previousTier };

  return (
    <div className="webhook-checks" role="group" aria-label="Fields sent">
      <span className="webhook-checks-title">Fields sent</span>
      <Segmented
        label="Fields sent"
        options={FORMAT_OPTIONS}
        value={map ? "custom" : "standard"}
        onChange={(value) => setMap(value === "custom" ? (map && map.length > 0 ? map : [...ZOHO_CRM_PRESET]) : null)}
      />

      {map ? (
        <>
          <p className="settings-help">Each row sends one value under the key your service expects.</p>
          {map.map((row, index) => (
            <div key={index} className="webhook-map-row">
              <Select
                id={`${idPrefix}-source-${index}`}
                value={row.source}
                options={sourceOptions}
                disabled={disabled}
                onChange={(source) => setRow(index, { source })}
                fill
              />
              <span className="webhook-map-arrow" aria-hidden={true}>
                <ArrowRight aria-hidden={true} />
              </span>
              <TextField
                id={`${idPrefix}-key-${index}`}
                value={row.key}
                disabled={disabled}
                placeholder="Key"
                invalid={row.key !== "" && !FIELD_KEY_PATTERN.test(row.key)}
                onChange={(key) => setRow(index, { key: key.trim() })}
                fill
              />
              <IconButton label="Remove field" variant="ghost" disabled={disabled} onClick={() => setMap(map.filter((_, i) => i !== index))}>
                <X aria-hidden={true} />
              </IconButton>
            </div>
          ))}
          <div className="onpage-guide-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || map.length >= MAX_FIELD_MAP}
              onClick={() => setMap([...map, { source: "member.name", key: "" }])}
            >
              <Plus aria-hidden={true} />
              <span>Add field</span>
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setMap([...ZOHO_CRM_PRESET])}>
              <span>Use Zoho CRM fields</span>
            </Button>
          </div>
        </>
      ) : (
        <p className="settings-help">
          The full member record, with every profile field. Map it in your service, or switch to Choose fields.
        </p>
      )}

      <span className="webhook-checks-title">Preview, a plan change</span>
      <pre className="webhook-preview">{JSON.stringify(preview, null, 2)}</pre>
    </div>
  );
};

const FormProblem: React.FC<{ draft: WebhookDraft }> = ({ draft }) => {
  const problem = webhookDraftProblem(draft);
  return problem ? <p className="settings-help settings-help-problem">{problem}</p> : null;
};

const WebhookCard: React.FC<{
  siteId: string;
  hook: SiteWebhook;
  tiers: ReadonlyArray<TierLadderEntry>;
  profileFields: ReadonlyArray<CustomFieldDefinition>;
  siteName: string;
  onChange: (hook: SiteWebhook) => void;
  onDelete: () => void;
}> = ({ siteId, hook, tiers, profileFields, siteName, onChange, onDelete }) => {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WebhookDraft>(() => draftOf(hook));
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);

  useEffect(() => setDraft(draftOf(hook)), [hook]);

  const dirty = !sameDraft(draft, draftOf(hook));
  const last = hook.lastDelivery;

  const save = async (patch: Partial<WebhookDraft>, message: string) => {
    setBusy(true);
    const result = await updateWebhook(siteId, hook.id, patch);
    setBusy(false);
    if (result.kind === "ok") {
      onChange(result.data.webhook);
      showToast({ tone: "success", message });
    } else {
      showToast({ tone: "error", message: short(failureMessage(result).message) });
    }
  };

  const loadDeliveries = async () => {
    const result = await fetchWebhookDeliveries(siteId, hook.id);
    if (result.kind === "ok") setDeliveries(result.data.deliveries);
  };

  const sendTest = async () => {
    setBusy(true);
    const result = await testWebhook(siteId, hook.id);
    setBusy(false);
    if (result.kind !== "ok") {
      showToast({ tone: "error", message: short(failureMessage(result).message) });
      return;
    }
    const { ok, status, error } = result.data.result;
    showToast({ tone: ok ? "success" : "error", message: short(ok ? `Test delivered (${status})` : error ?? "Test failed") });
    void loadDeliveries();
  };

  const remove = async () => {
    setBusy(true);
    const result = await deleteWebhook(siteId, hook.id);
    setBusy(false);
    setConfirmingDelete(false);
    if (result.kind === "ok") {
      onDelete();
      showToast({ tone: "success", message: "Webhook deleted" });
    } else {
      showToast({ tone: "error", message: short(failureMessage(result).message) });
    }
  };

  const toggleOpen = () => {
    setOpen((value) => !value);
    if (!open && deliveries === null) void loadDeliveries();
  };

  return (
    <div className={cn("page-rule-card", open && "is-open")}>
      <div
        className="page-rule-card-header"
        role="button"
        tabIndex={0}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleOpen();
          }
        }}
      >
        <div className="page-rule-info">
          <span className="page-rule-status-dot" data-enabled={hook.enabled} />
          <span className="page-rule-title">{hook.name}</span>
          {last ? (
            <span className={cn("badge", last.status === "failed" ? "badge-danger" : last.status === "delivered" ? "badge-success" : "badge-neutral")}>
              {last.status === "failed" ? "Failing" : last.status === "delivered" ? "Working" : "Sending"}
            </span>
          ) : null}
        </div>
        <div className="page-rule-header-actions" onClick={(event) => event.stopPropagation()}>
          <Toggle
            id={`webhook-toggle-${hook.id}`}
            checked={hook.enabled}
            disabled={busy}
            label={`Enable ${hook.name}`}
            onChange={(enabled) => void save({ enabled }, enabled ? "Webhook on" : "Webhook off")}
          />
          <IconButton label="Delete webhook" variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(true)}>
            <Trash2 aria-hidden={true} />
          </IconButton>
          <span className={cn("page-rule-chevron", open && "is-open")}>
            <ChevronDown aria-hidden={true} />
          </span>
        </div>
      </div>

      {confirmingDelete ? (
        <ConfirmDialog
          title={`Delete ${hook.name || "this webhook"}?`}
          message={<p>Events stop going to this address at once, and its delivery history is removed. This cannot be undone.</p>}
          confirmLabel="Delete webhook"
          cancelLabel="Keep webhook"
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void remove()}
        />
      ) : null}

      {open ? (
        <div className="page-rule-card-body">
          <WebhookForm idPrefix={`webhook-${hook.id}`} draft={draft} tiers={tiers} profileFields={profileFields} siteName={siteName} disabled={busy} onChange={setDraft} />
          <FormProblem draft={draft} />

          <FieldRows>
            <FieldRow label="Signing secret" hint="Your server can use it to check each request came from MemberFrame.">
              <code className="code-chip webhook-secret">{revealed ? hook.secret : "whsec_••••••••••••"}</code>
            </FieldRow>
          </FieldRows>

          <div className="onpage-guide-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !dirty || webhookDraftProblem(draft) !== null}
              onClick={() => void save(draft, "Webhook saved")}
            >
              <span>{busy ? "Saving" : "Save changes"}</span>
            </Button>
            <Button variant="secondary" size="sm" disabled={busy || dirty} onClick={() => void sendTest()}>
              <Send aria-hidden={true} />
              <span>Send test</span>
            </Button>
            <IconButton label={revealed ? "Hide secret" : "Show secret"} variant="ghost" onClick={() => setRevealed((value) => !value)}>
              {revealed ? <EyeOff aria-hidden={true} /> : <Eye aria-hidden={true} />}
            </IconButton>
            <IconButton
              label="Copy secret"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(hook.secret);
                showToast({ tone: "success", message: "Secret copied" });
              }}
            >
              <Copy aria-hidden={true} />
            </IconButton>
          </div>

          <div className="webhook-deliveries" aria-label="Recent deliveries">
            <span className="webhook-checks-title">Recent deliveries</span>
            {deliveries === null ? (
              <p className="settings-help">Loading.</p>
            ) : deliveries.length === 0 ? (
              <p className="settings-help">Nothing sent yet. Send a test to check the address.</p>
            ) : (
              deliveries.slice(0, 8).map((delivery) => (
                <div key={delivery.id} className="webhook-delivery-row">
                  <span className={cn("badge", delivery.status === "failed" ? "badge-danger" : delivery.status === "delivered" ? "badge-success" : "badge-neutral")}>
                    {delivery.status === "failed" ? "Failed" : delivery.status === "delivered" ? "Sent" : "Retrying"}
                  </span>
                  <span className="webhook-delivery-text">
                    {`${WEBHOOK_EVENT_LABELS[delivery.event as WebhookEventType] ?? "Test"}. ${deliveryLabel(delivery)}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
