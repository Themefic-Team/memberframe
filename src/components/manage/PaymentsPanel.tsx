import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, CreditCard, Eye, EyeOff, Save, Unplug } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  FieldRow,
  FieldRows,
  IconButton,
  InfoTip,
  SearchSelect,
  Segmented,
  TextField,
  Toggle,
  useToast,
} from "../ui";
import { cn } from "../../utils/cn";
import {
  GATEWAY_FIELDS,
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
  DEFAULT_METHOD_LABELS,
  connectGateway,
  disconnectGateway,
  fetchPayments,
  paymentsFailure,
  savePaymentSettings,
  setGatewayEnabled,
  type GatewayStatus,
  type MethodLabel,
  type PaymentGateway,
  type PaymentMode,
  type PaymentSettings,
  type PaymentsOverview,
} from "../../services/paymentsService";
import { isSafeSitePath } from "../../services/siteSettingsService";
import { CURRENCY_OPTIONS } from "../../utils/currencies";

const MODE_OPTIONS = [
  { value: "test", label: "Test" },
  { value: "live", label: "Live" },
] as const satisfies ReadonlyArray<{ value: PaymentMode; label: string }>;

const GATEWAY_BLURB: Record<PaymentGateway, string> = {
  stripe: "Cards, Apple Pay, Google Pay",
  lemonsqueezy: "Tax & VAT compliance for EU/global",
  razorpay: "UPI, cards & net banking for India",
};

export interface PaymentsPanelProps {
  siteId: string;
}

/**
 * Manage, Payments. FP-16 section 9.4.
 *
 * Next to Tiers because the two are one job: a tier's prices are only
 * sellable once a gateway is connected here. Three groups, in the order a
 * creator meets them: which mode the site sells in, the gateways for that
 * mode, and how checkout behaves.
 *
 * Gateway keys go up once, inside a connect call, and are never shown again:
 * the server answers with an account name and a masked suffix. Nothing here
 * stores a key, in state beyond the open form, or anywhere else.
 */
export const PaymentsPanel: React.FC<PaymentsPanelProps> = ({ siteId }) => {
  const showToast = useToast();
  const [overview, setOverview] = useState<PaymentsOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Which keys the gateway cards show. Separate from the mode the site sells
   * in, so live keys can be connected while the site still sells in test:
   * going live is refused until they are.
   */
  const [viewMode, setViewMode] = useState<PaymentMode | null>(null);
  const [busyGateway, setBusyGateway] = useState<PaymentGateway | null>(null);

  const apply = useCallback((next: PaymentsOverview) => {
    setOverview(next);
    setDraft(next.settings);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPayments(siteId).then((result) => {
      if (!active) return;
      if (result.kind === "ok") {
        apply(result.data);
        setViewMode((current) => current ?? result.data.settings.mode);
        setLoadError(null);
      } else {
        setLoadError(paymentsFailure(result));
      }
    });
    return () => {
      active = false;
    };
  }, [apply, siteId]);

  /** Switch the mode the site sells in. Only ever called from a banner's action. */
  const changeMode = useCallback(
    async (mode: PaymentMode) => {
      if (!overview || saving || mode === overview.settings.mode) return;

      setSaving(true);
      const result = await savePaymentSettings(siteId, { mode });
      setSaving(false);

      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: mode === "live" ? "Payments are live" : "Back in test mode" });
        return;
      }
      showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
    },
    [apply, overview, saving, showToast, siteId]
  );

  const pathProblem = (path: string | undefined) =>
    path !== undefined && !isSafeSitePath(path) ? "Use a path that starts with a slash, like /pricing." : undefined;

  const saveSettings = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    const { mode: _mode, ...rest } = draft;
    const result = await savePaymentSettings(siteId, rest);
    setSaving(false);

    if (result.kind === "ok") {
      apply(result.data);
      showToast({ tone: "success", message: "Checkout settings saved" });
      return;
    }
    showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
  }, [apply, draft, showToast, siteId]);

  const connect = useCallback(
    async (gateway: PaymentGateway, values: Record<string, string>): Promise<string | null> => {
      if (!overview || !viewMode) return null;
      setBusyGateway(gateway);
      const result = await connectGateway(siteId, gateway, viewMode, values);
      setBusyGateway(null);

      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} connected` });
        return result.data.notice ?? null;
      }
      throw new Error(paymentsFailure(result));
    },
    [apply, overview, showToast, siteId, viewMode]
  );

  const disconnect = useCallback(
    async (gateway: PaymentGateway) => {
      if (!overview || !viewMode) return;
      setBusyGateway(gateway);
      const result = await disconnectGateway(siteId, gateway, viewMode);
      setBusyGateway(null);

      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} removed` });
        return;
      }
      showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
    },
    [apply, overview, showToast, siteId, viewMode]
  );

  /** Show or hide a connected gateway at checkout. Instant, like every Toggle. */
  const toggleEnabled = useCallback(
    async (gateway: PaymentGateway, enabled: boolean) => {
      if (!overview || !viewMode) return;
      setBusyGateway(gateway);
      const result = await setGatewayEnabled(siteId, gateway, viewMode, enabled);
      setBusyGateway(null);
      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} ${enabled ? "shown" : "hidden"} at checkout` });
        return;
      }
      showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
    },
    [apply, overview, showToast, siteId, viewMode]
  );

  /** One gateway's checkout title and description. Empty fields use the defaults. */
  const saveLabels = useCallback(
    async (gateway: PaymentGateway, label: MethodLabel): Promise<boolean> => {
      if (!overview) return false;
      setBusyGateway(gateway);
      const methodLabels = { ...(overview.settings.methodLabels ?? {}), [gateway]: label };
      const result = await savePaymentSettings(siteId, { methodLabels });
      setBusyGateway(null);
      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} saved` });
        return true;
      }
      showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
      return false;
    },
    [apply, overview, showToast, siteId]
  );

  if (loadError) {
    return <Banner tone="warning" title="Payments could not load" message={loadError} />;
  }

  if (!overview || !draft) {
    return <p className="settings-help">Loading payments.</p>;
  }

  const siteMode = overview.settings.mode;
  const mode = viewMode ?? siteMode;
  const gateways = overview.gateways.filter((entry) => entry.mode === mode);
  const connected = gateways.filter((entry) => entry.connected);
  /** The server refuses Live without one of these (no_live_gateway). */
  const liveReady = overview.gateways.some(
    (entry) => entry.mode === "live" && entry.connected && entry.enabled !== false
  );

  return (
    <>
      {!overview.secretsAvailable ? (
        <Banner
          tone="danger"
          title="Payments disabled"
          message="Set PAYMENTS_ENCRYPTION_KEY in .env to enable gateways."
        />
      ) : null}

      <section className="section-group">
        <div className="section-header-row payments-header-row">
          <div className="payments-header-title">
            <h2 className="section-title">Gateways</h2>
            <InfoTip label="Gateways">
              Buyers choose from the gateways shown at checkout, with the one suiting their location preselected. With
              one gateway shown, checkout opens directly.
            </InfoTip>
            {!overview.publicApi ? (
              <InfoTip label="Webhook address">
                Local API detected. Webhooks require a public https tunnel address to receive events during testing.
              </InfoTip>
            ) : null}
          </div>
          <div className="payments-mode-wrap">
            <Segmented
              label="Payment mode"
              options={MODE_OPTIONS}
              value={mode}
              onChange={setViewMode}
            />
          </div>
        </div>

        {/* The switch picks which keys are shown. The site's own mode changes only from these banners. */}
        {mode === "live" && siteMode === "test" ? (
          liveReady ? (
            <Banner
              tone="warning"
              title="Switch to live payments?"
              message={
                overview.activeSubscriptions.test > 0
                  ? `Buyers will be charged for real. The ${overview.activeSubscriptions.test} test purchase(s) stop granting access.`
                  : "Buyers will be charged for real through connected live keys."
              }
              action={{ label: "Go live", onClick: () => void changeMode("live") }}
            />
          ) : (
            <Banner
              tone="info"
              title="Your site takes test payments"
              message="Connect a gateway below with its live keys. Then you can go live."
            />
          )
        ) : null}

        {mode === "test" && siteMode === "live" ? (
          <Banner
            tone="info"
            title="Your site takes live payments"
            message="These are your test keys. Checkout uses the live ones."
            action={{ label: "Switch to test", onClick: () => void changeMode("test") }}
          />
        ) : null}

        <div className="integration-grid">
          {PAYMENT_GATEWAYS.map((gateway) => (
            <GatewayCard
              key={`${gateway}-${mode}`}
              status={gateways.find((entry) => entry.gateway === gateway)!}
              busy={busyGateway === gateway}
              disabled={!overview.secretsAvailable}
              onConnect={(values) => connect(gateway, values)}
              onDisconnect={() => void disconnect(gateway)}
              onToggleEnabled={(enabled) => void toggleEnabled(gateway, enabled)}
              label={overview.settings.methodLabels?.[gateway] ?? {}}
              // The plugin's own defaults, always: an older server sends older wording.
              defaultLabel={DEFAULT_METHOD_LABELS[gateway]}
              onSaveLabel={(label) => saveLabels(gateway, label)}
            />
          ))}
        </div>
      </section>

      <section className="section-group">
        <div className="section-header-row">
          <h2 className="section-title">Checkout Settings</h2>
        </div>

        <FieldRows>
          <FieldRow
            label="Grace period"
            htmlFor="payments-grace"
            hint="Days members keep access while renewal payments retry."
          >
            <TextField
              id="payments-grace"
              inputMode="numeric"
              value={String(draft.graceDays)}
              onChange={(value) =>
                setDraft({ ...draft, graceDays: Math.max(0, Math.min(30, Math.round(Number(value) || 0))) })
              }
            />
          </FieldRow>

          <FieldRow
            label="Pricing page"
            htmlFor="payments-pricing-path"
            error={pathProblem(draft.pricingPath)}
            hint="Target path for upgrade links (e.g. /pricing)."
          >
            <TextField
              id="payments-pricing-path"
              value={draft.pricingPath}
              invalid={pathProblem(draft.pricingPath) !== undefined}
              onChange={(value) => setDraft({ ...draft, pricingPath: value })}
            />
          </FieldRow>

          <FieldRow
            label="After purchase"
            htmlFor="payments-after-path"
            error={pathProblem(draft.afterPurchasePath)}
            hint="Redirect destination after confirmed payment."
          >
            <TextField
              id="payments-after-path"
              value={draft.afterPurchasePath}
              invalid={pathProblem(draft.afterPurchasePath) !== undefined}
              onChange={(value) => setDraft({ ...draft, afterPurchasePath: value })}
            />
          </FieldRow>

          <FieldRow
            label="Site currency"
            htmlFor="payments-currency"
            hint="Every tier is priced in it, so buyers always compare like with like."
          >
            <SearchSelect
              id="payments-currency"
              value={draft.defaultCurrency}
              options={CURRENCY_OPTIONS}
              searchPlaceholder="Search currencies"
              onChange={(value) => setDraft({ ...draft, defaultCurrency: value })}
            />
          </FieldRow>
        </FieldRows>

        {overview && draft.defaultCurrency !== overview.settings.defaultCurrency ? (
          <Banner
            tone="warning"
            title={`Every tier moves to ${draft.defaultCurrency}`}
            message="Prices keep their numbers, so 9.99 stays 9.99. Check them in Tiers after saving."
          />
        ) : null}

        <div className="section-actions">
          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={
              saving ||
              pathProblem(draft.pricingPath) !== undefined ||
              pathProblem(draft.afterPurchasePath) !== undefined
            }
            onClick={() => void saveSettings()}
          >
            <Save aria-hidden={true} />
            {saving ? "Saving" : "Save checkout settings"}
          </Button>
        </div>
      </section>
    </>
  );
};

interface GatewayCardProps {
  status: GatewayStatus;
  busy: boolean;
  disabled: boolean;
  /** Resolves to a notice for the creator, or rejects with a message for the form. */
  onConnect: (values: Record<string, string>) => Promise<string | null>;
  onDisconnect: () => void;
  /** Show or hide this gateway at checkout (29-checkout-methods.md). */
  onToggleEnabled: (enabled: boolean) => void;
  /** The creator's own checkout wording, and the default it falls back to. */
  label: Partial<MethodLabel>;
  defaultLabel: MethodLabel | null;
  /** Resolves true when saved. */
  onSaveLabel: (label: MethodLabel) => Promise<boolean>;
}

const GatewayCard: React.FC<GatewayCardProps> = ({
  status,
  busy,
  disabled,
  onConnect,
  onDisconnect,
  onToggleEnabled,
  label: methodLabel,
  defaultLabel,
  onSaveLabel,
}) => {
  const fields = GATEWAY_FIELDS[status.gateway];
  const label = PAYMENT_GATEWAY_LABELS[status.gateway];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<ReadonlyArray<string>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wording, setWording] = useState<MethodLabel>({ title: "", description: "" });
  /** What the form opened with: Save only sends what changed. */
  const [opened, setOpened] = useState<{ values: Record<string, string>; wording: MethodLabel }>({
    values: {},
    wording: { title: "", description: "" },
  });
  const shown = status.connected && status.enabled !== false;
  /** Remove is destructive, so the first press asks and the second acts. */
  const [confirmRemove, setConfirmRemove] = useState(false);

  const id = `gateway-${status.gateway}`;
  const manualWebhook = status.gateway === "razorpay";

  const reset = useCallback(() => {
    // Non-secret values the server already holds are shown, so an edit can
    // change one variant without pasting everything again.
    const initial: Record<string, string> = {};
    for (const field of fields) {
      if (field.secret) continue;
      const stored =
        field.key === "storeId" || field.key === "keyId" ? status.publicId : status.options[field.key];
      if (typeof stored === "string") initial[field.key] = stored;
    }
    setValues(initial);
    setRevealed([]);
    setError(null);
    // Prefilled with what buyers see today: the creator's own wording, else
    // the gateway's default (its name, and what it takes).
    const startWording = {
      title: methodLabel.title || defaultLabel?.title || label,
      description: methodLabel.description || defaultLabel?.description || "",
    };
    setWording(startWording);
    setOpened({ values: initial, wording: startWording });
  }, [defaultLabel, fields, label, methodLabel.description, methodLabel.title, status.options, status.publicId]);

  const toggle = () => {
    if (!open) reset();
    setConfirmRemove(false);
    setOpen(!open);
  };

  const submit = async () => {
    const missing = fields.find((field) => field.required && !status.connected && (values[field.key] ?? "").trim() === "");
    if (missing) {
      setError(`${missing.label} is needed.`);
      return;
    }
    setError(null);

    // One Save for the whole card (product owner, 2026-10-20). Keys go up only
    // when one changed: reconnecting re-checks them and re-registers the
    // webhook, which a wording edit should not do.
    const keysChanged =
      !status.connected ||
      fields.some((field) =>
        field.secret
          ? (values[field.key] ?? "").trim() !== ""
          : (values[field.key] ?? "").trim() !== (opened.values[field.key] ?? "").trim()
      );
    const nextWording = { title: wording.title.trim(), description: wording.description.trim() };
    const wordingChanged =
      status.connected &&
      (nextWording.title !== opened.wording.title.trim() || nextWording.description !== opened.wording.description.trim());

    try {
      if (keysChanged) {
        const message = await onConnect(values);
        setNotice(message);
        setValues({});
      }
      if (wordingChanged && !(await onSaveLabel(nextWording))) return;
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not connect.");
    }
  };

  const webhookState = !status.connected
    ? null
    : status.lastWebhookAt
      ? "Receiving events"
      : status.webhookConfigured
        ? "Waiting for the first event"
        : "Webhook not set up";

  const statusSubtitle = status.connected
    ? [status.accountName, status.maskedSuffix ? `ending ${status.maskedSuffix}` : null, webhookState]
        .filter(Boolean)
        .join(" · ")
    : GATEWAY_BLURB[status.gateway];

  return (
    <article className={cn("integration-card", open && "is-open", status.connected && "is-configured")}>
      <div
        className="integration-card-bar"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`${id}-form`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div className="integration-card-bar-left">
          <span className="integration-card-icon">
            {status.connected ? <Check aria-hidden={true} /> : <CreditCard aria-hidden={true} />}
          </span>
          <div className="integration-card-text">
            <span className="integration-card-title">{label}</span>
            <span className="integration-card-sub">{statusSubtitle}</span>
          </div>
        </div>
        {/* The Toggle acts on its own: a click on it must not open or close the card. */}
        <div className="integration-card-bar-right" onClick={(event) => event.stopPropagation()}>
          {status.connected ? (
            <Badge tone={shown ? "success" : "neutral"}>{shown ? "Connected" : "Off"}</Badge>
          ) : (
            <Badge tone="neutral">Not connected</Badge>
          )}
          {status.connected ? (
            <Toggle
              id={`${id}-enabled`}
              checked={shown}
              disabled={busy || disabled}
              label={`Show ${label} at checkout`}
              onChange={onToggleEnabled}
            />
          ) : null}
          <span className={cn("integration-chevron", open && "is-open")} onClick={toggle}>
            <ChevronDown aria-hidden={true} />
          </span>
        </div>
      </div>

      {notice && !open ? <p className="integration-card-pending">{notice}</p> : null}

      {open ? (
        <div className="integration-tier-form" id={`${id}-form`} role="group" aria-label={`${label} keys`}>
          <FieldRows>
            {fields.map((field) => {
              const isRevealed = revealed.includes(field.key);
              return (
                <FieldRow
                  key={field.key}
                  label={field.label}
                  htmlFor={`${id}-${field.key}`}
                  hint={field.hint}
                  fill
                >
                  <div className="integration-input">
                    <TextField
                      id={`${id}-${field.key}`}
                      fill
                      type={field.secret && !isRevealed ? "password" : "text"}
                      autoComplete="off"
                      value={values[field.key] ?? ""}
                      disabled={busy || disabled}
                      placeholder={field.secret && status.connected ? "Saved. Type to replace it." : field.placeholder}
                      onChange={(next) => setValues((current) => ({ ...current, [field.key]: next }))}
                    />
                    {field.secret ? (
                      <IconButton
                        label={isRevealed ? `Hide ${field.label}` : `Show ${field.label}`}
                        disabled={busy || (values[field.key] ?? "") === ""}
                        onClick={() =>
                          setRevealed((current) =>
                            current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key]
                          )
                        }
                      >
                        {isRevealed ? <EyeOff aria-hidden={true} /> : <Eye aria-hidden={true} />}
                      </IconButton>
                    ) : null}
                  </div>
                </FieldRow>
              );
            })}

            <FieldRow
              label="Webhook URL"
              htmlFor={`${id}-webhook`}
              hint={
                manualWebhook
                  ? `Add in Razorpay, Webhooks with: ${status.events.join(", ")}.`
                  : `Auto-registered with ${label} on connect.`
              }
              fill
            >
              <div className="integration-input">
                <TextField id={`${id}-webhook`} fill readOnly value={status.webhookUrl} onChange={() => undefined} />
                <IconButton
                  label={copied ? "Copied" : "Copy webhook URL"}
                  onClick={() => {
                    void navigator.clipboard.writeText(status.webhookUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check aria-hidden={true} /> : <Copy aria-hidden={true} />}
                </IconButton>
              </div>
            </FieldRow>
          </FieldRows>

          {status.connected ? (
            <>
              {/* How buyers see this gateway in the checkout chooser (29-checkout-methods.md). */}
              <FieldRows>
                <FieldRow
                  label="Checkout title"
                  htmlFor={`${id}-title`}
                  hint="What buyers see in the payment method list. Leave it empty for the default."
                  fill
                >
                  <TextField
                    id={`${id}-title`}
                    fill
                    maxLength={60}
                    value={wording.title}
                    placeholder={defaultLabel?.title ?? label}
                    disabled={busy || disabled}
                    onChange={(title) => setWording((current) => ({ ...current, title }))}
                  />
                </FieldRow>
                <FieldRow
                  label="Checkout description"
                  htmlFor={`${id}-description`}
                  hint="One line under the title, for example the cards or wallets it takes."
                  fill
                >
                  <TextField
                    id={`${id}-description`}
                    fill
                    maxLength={140}
                    value={wording.description}
                    placeholder={defaultLabel?.description ?? ""}
                    disabled={busy || disabled}
                    onChange={(description) => setWording((current) => ({ ...current, description }))}
                  />
                </FieldRow>
              </FieldRows>
            </>
          ) : null}

          {error ? (
            <p className="integration-field-problem" role="alert">
              {error}
            </p>
          ) : null}

          {/* At the bottom: one Save for the keys and the checkout wording. */}
          <div className="integration-card-actions">
            {status.connected ? (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                <Unplug aria-hidden={true} />
                Remove
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" disabled={busy || disabled} onClick={() => void submit()}>
              {busy ? "Saving" : status.connected ? "Save changes" : `Connect ${label}`}
            </Button>
          </div>
        </div>
      ) : null}

      {confirmRemove ? (
        <ConfirmDialog
          title={`Remove ${label}?`}
          message={
            <>
              <p>Its saved keys and webhook are deleted, and checkout stops offering {label}.</p>
              <p>You cannot remove it while members still have subscriptions renewing through it.</p>
            </>
          }
          confirmLabel={`Remove ${label}`}
          cancelLabel={`Keep ${label}`}
          icon={<Unplug aria-hidden={true} />}
          busy={busy}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            onDisconnect();
          }}
        />
      ) : null}
    </article>
  );
};

function shorten(message: string): string {
  return message.length <= 45 ? message : `${message.slice(0, 42).trimEnd()}...`;
}
