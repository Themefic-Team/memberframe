import React, { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, CreditCard, Eye, EyeOff, Globe, Key, Plug, X } from "lucide-react";
import { Banner, Button, FieldRow, FieldRows, IconButton, TextField, Toggle } from "../ui";
import { cn } from "../../utils/cn";
import { API_BASE_URL } from "../../config/backend";
import { checkKey, keyProblemMessage } from "./gatewayKeys";
import {
  draftFor,
  integrationStatus,
  isGatewayIntegration,
  publicValues,
  validateDraft,
  type FieldProblem,
  type IntegrationDefinition,
  type IntegrationDraft,
  type StoredIntegration,
} from "./integrationRegistry";

export interface IntegrationCardProps {
  definition: IntegrationDefinition;
  stored: StoredIntegration;
  /** False while there is nowhere encrypted to put a secret. See the registry. */
  secretsSupported: boolean;
  saving: boolean;
  onSave: (values: Record<string, string>) => void;
  /** Instant apply, per the toggle's own contract. */
  onToggleEnabled: (enabled: boolean) => void;
}

function getIntegrationIcon(id: string) {
  switch (id) {
    case "google_oauth":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 11v3.2h5.3c-.2 1.4-1.6 4.1-5.3 4.1-3.2 0-5.8-2.6-5.8-5.9S8.8 6.5 12 6.5c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6 0-1-.1-1.3H12z"
          />
        </svg>
      );
    case "github_oauth":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10 10 0 0012 2z"
          />
        </svg>
      );
    case "apple_oauth":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M16.3 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.9.9-3.7.9-.8 0-2-.8-3.2-.8-1.7 0-3.4 1.4-3.4 4 0 1.6.6 3.3 1.4 4.4.7 1 1.4 1.9 2.4 1.9.9 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-.9 2.4-1.9.5-.8.8-1.5 1-1.9-1.9-.7-2.1-2.5-2.1-3.3zM14.3 6c.6-.7 1-1.6.9-2.6-.9.1-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 2-.5 2.5-1.2z"
          />
        </svg>
      );
    case "discord_oauth":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M19.3 5.6A16 16 0 0015.2 4.3l-.3.7a12 12 0 00-5.8 0l-.3-.7a16 16 0 00-4.1 1.3C2.2 9.3 1.5 12.9 1.9 16.4a16 16 0 004.8 2.4l.6-1a10 10 0 01-1.6-.8l.4-.3a11.4 11.4 0 009.8 0l.4.3c-.5.3-1 .6-1.6.8l.6 1a16 16 0 004.8-2.4c.5-4-.6-7.6-2.8-10.8zM8.7 14.3c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9zm6.6 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9z"
          />
        </svg>
      );
    case "stripe":
    case "lemonsqueezy":
    case "razorpay":
      return <CreditCard aria-hidden={true} />;
    default:
      return <Plug aria-hidden={true} />;
  }
}

/**
 * An integration item rendered as a collapsible accordion card,
 * matching the Tier creation structure (Screenshot 2).
 */
export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  definition,
  stored,
  secretsSupported,
  saving,
  onSave,
  onToggleEnabled,
}) => {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const defaultRedirectUrl = useMemo(() => {
    return `${API_BASE_URL}/api/member/oauth/${definition.id.replace("_oauth", "")}/callback`;
  }, [definition.id]);

  /**
   * The Redirect URL is derived, never stored state the creator edits.
   *
   * It is the API's own callback, so it follows `VITE_API_BASE_URL`. Reading
   * the stored copy instead froze it at whatever address the API had on the
   * first save, and a dev tunnel such as ngrok changes address on every
   * restart: the field is read only, so the creator had no way to correct it
   * and the provider was sent to a dead callback.
   */
  const hasRedirect = definition.fields.some((field) => field.key === "redirect_url");
  const storedRedirect = stored.values["redirect_url"];
  const redirectStale =
    hasRedirect && typeof storedRedirect === "string" && storedRedirect !== "" && storedRedirect !== defaultRedirectUrl;

  const createInitialDraft = useCallback((): IntegrationDraft => {
    const base = draftFor(definition, stored);
    for (const field of definition.fields) {
      if (field.key === "redirect_url") {
        base[field.key] = defaultRedirectUrl;
      } else if (stored.values[field.key]) {
        base[field.key] = stored.values[field.key];
      }
    }
    return base;
  }, [defaultRedirectUrl, definition, stored]);

  const [draft, setDraft] = useState<IntegrationDraft>(createInitialDraft);
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  /** Which secret fields are currently shown in the clear. Never persisted. */
  const [revealed, setRevealed] = useState<ReadonlyArray<string>>([]);

  const status = integrationStatus(definition, stored);
  const configured = status === "connected" || status === "partial" || Object.keys(stored.values).length > 0;

  const handleToggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setDraft(createInitialDraft());
        setProblems([]);
        setRevealed([]);
      }
      return next;
    });
  }, [createInitialDraft]);

  const handleSave = useCallback(() => {
    const found = validateDraft(definition, draft, stored, secretsSupported);
    setProblems(found);

    if (found.length > 0) return;

    const valuesToSave: Record<string, string> = {
      ...publicValues(definition, draft),
    };

    for (const field of definition.fields) {
      const val = field.key === "redirect_url" ? defaultRedirectUrl : (draft[field.key] ?? "").trim();
      if (val !== "" && (!field.secret || definition.category === "auth")) {
        valuesToSave[field.key] = val;
      }
    }

    // One write, not two. `onSave` already stores `enabled: true` whenever
    // there are values. A separate enable call here fired a second request
    // with the same settings version: one of the two was refused as out of
    // date, and when the enable won it wrote the OLD empty values, so a
    // creator's Save was lost behind a success toast.
    onSave(valuesToSave);
    setRevealed([]);
    setOpen(false);
  }, [defaultRedirectUrl, definition, draft, onSave, secretsSupported, stored]);

  const toggleReveal = useCallback((key: string) => {
    setRevealed((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }, []);

  const problemFor = (key: string): string | null =>
    problems.find((problem) => problem.key === key)?.message ?? null;

  return (
    <article className={cn("integration-card", open && "is-open", configured && "is-configured")}>
      {/* Accordion header bar */}
      <div
        className="integration-card-bar"
        role="button"
        tabIndex={0}
        onClick={handleToggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggleOpen();
          }
        }}
      >
        <div className="integration-card-bar-left">
          <span className="integration-card-icon">
            {configured ? <Check aria-hidden={true} /> : getIntegrationIcon(definition.id)}
          </span>
          <span className="integration-card-title">{definition.name}</span>
          {redirectStale ? (
            <span className="badge badge-warning">Update needed</span>
          ) : configured ? (
            <span className="badge badge-success">Connected</span>
          ) : (
            <span className="badge badge-neutral">Not connected</span>
          )}
        </div>

        <div className="integration-card-bar-right" onClick={(e) => e.stopPropagation()}>
          <Toggle
            id={`integration-${definition.id}-status`}
            checked={stored.enabled}
            disabled={saving}
            label={`Enable ${definition.name}`}
            onChange={(enabled) => {
              onToggleEnabled(enabled);
              if (enabled && !open) {
                setOpen(true);
              }
            }}
          />
          <span className={cn("integration-chevron", open && "is-open")}>
            <ChevronDown aria-hidden={true} />
          </span>
        </div>
      </div>

      {/* Expanded Tier-style Edit Form (Screenshot 2) */}
      {open && (
        <div className="integration-tier-form" role="group" aria-label={`${definition.name} details`}>
          <div className="tier-form-head">
            <span className="tier-form-title">Edit {definition.name}</span>
            <IconButton label="Close" variant="ghost" onClick={() => setOpen(false)}>
              <X aria-hidden={true} />
            </IconButton>
          </div>

          {redirectStale ? (
            <Banner
              tone="warning"
              title="Redirect URL changed"
              message={`The API address changed. Save to update it, and add ${defaultRedirectUrl} to the authorized redirect URIs in your ${definition.name} app.`}
            />
          ) : null}

          <FieldRows>
            {definition.fields.map((field) => {
              const locked = field.secret && !secretsSupported && isGatewayIntegration(definition);
              const isRedirect = field.key === "redirect_url";
              const rawValue = draft[field.key] ?? "";
              const value = isRedirect ? defaultRedirectUrl : rawValue;
              const isReadOnly = Boolean(field.readOnly) || isRedirect;
              const isDisabled =
                locked ||
                saving ||
                isRedirect ||
                Boolean(field.disabled) ||
                Boolean(field.readOnly);
              const isRevealed = revealed.includes(field.key);

              const shape =
                field.keyRole !== undefined && isGatewayIntegration(definition) && value !== ""
                  ? keyProblemMessage(checkKey(value, definition.id, field.keyRole))
                  : null;

              const problem = problemFor(field.key) ?? shape;
              const inputType = field.secret ? (isRevealed ? "text" : "password") : field.type;

              const placeholder = locked
                ? "Not available yet"
                : field.secret && stored.secretsPresent.includes(field.key)
                  ? "Saved. Type to replace it."
                  : field.placeholder;

              return (
                <React.Fragment key={field.key}>
                  <FieldRow
                    label={field.label}
                    htmlFor={`integration-${definition.id}-${field.key}`}
                    error={problem ?? undefined}
                    hint={field.help}
                    fill
                  >
                    <div className="integration-input">
                      <TextField
                        id={`integration-${definition.id}-${field.key}`}
                        type={inputType}
                        fill
                        value={value}
                        disabled={isDisabled}
                        readOnly={isReadOnly}
                        invalid={problem !== null}
                        placeholder={placeholder}
                        onChange={(next) =>
                          setDraft((current) => ({ ...current, [field.key]: next }))
                        }
                      />

                      {field.copyable || isRedirect ? (
                        <IconButton
                          label={copiedKey === field.key ? "Copied" : `Copy ${field.label}`}
                          disabled={saving}
                          onClick={() => {
                            void navigator.clipboard.writeText(value);
                            setCopiedKey(field.key);
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                        >
                          {copiedKey === field.key ? <Check aria-hidden={true} /> : <Copy aria-hidden={true} />}
                        </IconButton>
                      ) : null}

                      {field.secret ? (
                        <IconButton
                          label={isRevealed ? `Hide ${field.label}` : `Show ${field.label}`}
                          disabled={locked || saving || value === ""}
                          onClick={() => toggleReveal(field.key)}
                        >
                          {isRevealed ? <EyeOff aria-hidden={true} /> : <Eye aria-hidden={true} />}
                        </IconButton>
                      ) : null}
                    </div>
                  </FieldRow>

                </React.Fragment>
              );
            })}
          </FieldRows>

          <div className="tier-form-cta">
            <Button
              variant="primary"
              size="md"
              className="fill"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
};
