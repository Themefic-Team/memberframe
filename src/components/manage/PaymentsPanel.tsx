import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, CreditCard, Eye, EyeOff, Save, Unplug } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  FieldRow,
  FieldRows,
  IconButton,
  InfoTip,
  SearchSelect,
  Segmented,
  Select,
  TextField,
  useToast,
} from "../ui";
import { cn } from "../../utils/cn";
import {
  GATEWAY_FIELDS,
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
  connectGateway,
  disconnectGateway,
  fetchPayments,
  paymentsFailure,
  savePaymentSettings,
  type GatewayStatus,
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
  const [pendingLive, setPendingLive] = useState(false);
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
        setLoadError(null);
      } else {
        setLoadError(paymentsFailure(result));
      }
    });
    return () => {
      active = false;
    };
  }, [apply, siteId]);

  const changeMode = useCallback(
    async (mode: PaymentMode) => {
      if (!overview || mode === overview.settings.mode) return;

      // Going live ends every test purchase, so it asks first.
      if (mode === "live" && !pendingLive) {
        setPendingLive(true);
        return;
      }

      setPendingLive(false);
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
    [apply, overview, pendingLive, showToast, siteId]
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
      if (!overview) return null;
      setBusyGateway(gateway);
      const result = await connectGateway(siteId, gateway, overview.settings.mode, values);
      setBusyGateway(null);

      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} connected` });
        return result.data.notice ?? null;
      }
      throw new Error(paymentsFailure(result));
    },
    [apply, overview, showToast, siteId]
  );

  const disconnect = useCallback(
    async (gateway: PaymentGateway) => {
      if (!overview) return;
      setBusyGateway(gateway);
      const result = await disconnectGateway(siteId, gateway, overview.settings.mode);
      setBusyGateway(null);

      if (result.kind === "ok") {
        apply(result.data);
        showToast({ tone: "success", message: `${PAYMENT_GATEWAY_LABELS[gateway]} removed` });
        return;
      }
      showToast({ tone: "error", message: shorten(paymentsFailure(result)) });
    },
    [apply, overview, showToast, siteId]
  );

  if (loadError) {
    return <Banner tone="warning" title="Payments could not load" message={loadError} />;
  }

  if (!overview || !draft) {
    return <p className="settings-help">Loading payments.</p>;
  }

  const mode = overview.settings.mode;
  const gateways = overview.gateways.filter((entry) => entry.mode === mode);
  const connected = gateways.filter((entry) => entry.connected);

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
              value={pendingLive ? "live" : mode}
              onChange={(next) => void changeMode(next)}
            />
          </div>
        </div>

        {pendingLive ? (
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
            label="Default gateway"
            htmlFor="payments-default-gateway"
            hint="Fallback when location routing is disabled or unavailable."
          >
            <Select
              id="payments-default-gateway"
              value={draft.defaultGateway}
              options={[
                { value: "", label: "First connected" },
                ...PAYMENT_GATEWAYS.map((gateway) => ({ value: gateway, label: PAYMENT_GATEWAY_LABELS[gateway] })),
              ]}
              onChange={(value) => setDraft({ ...draft, defaultGateway: value as PaymentGateway | "" })}
            />
          </FieldRow>

          <FieldRow
            label="Route by buyer location"
            htmlFor="payments-geo"
            hint="Routes visitors to the best gateway based on country."
          >
            <Checkbox
              id="payments-geo"
              checked={draft.autoDetectGeolocation}
              onChange={(checked) => setDraft({ ...draft, autoDetectGeolocation: checked })}
            />
          </FieldRow>

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
}

const GatewayCard: React.FC<GatewayCardProps> = ({ status, busy, disabled, onConnect, onDisconnect }) => {
  const fields = GATEWAY_FIELDS[status.gateway];
  const label = PAYMENT_GATEWAY_LABELS[status.gateway];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<ReadonlyArray<string>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  }, [fields, status.options, status.publicId]);

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
    try {
      const message = await onConnect(values);
      setNotice(message);
      setValues({});
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
        <div className="integration-card-bar-right">
          {status.connected ? (
            <Badge tone="success">Connected</Badge>
          ) : (
            <Badge tone="neutral">Not connected</Badge>
          )}
          <span className={cn("integration-chevron", open && "is-open")}>
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

          {error ? (
            <p className="integration-field-problem" role="alert">
              {error}
            </p>
          ) : null}

          <div className="integration-card-actions">
            {status.connected ? (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (!confirmRemove) {
                    setConfirmRemove(true);
                    return;
                  }
                  setConfirmRemove(false);
                  onDisconnect();
                }}
              >
                <Unplug aria-hidden={true} />
                {confirmRemove ? "Confirm remove" : "Remove"}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" disabled={busy || disabled} onClick={() => void submit()}>
              {busy ? "Checking keys" : status.connected ? "Update keys" : `Connect ${label}`}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
};

function shorten(message: string): string {
  return message.length <= 45 ? message : `${message.slice(0, 42).trimEnd()}...`;
}
