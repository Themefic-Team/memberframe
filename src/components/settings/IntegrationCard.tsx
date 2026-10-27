import React, { useCallback, useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Eye, EyeOff, Plug } from "lucide-react";
import { Badge, Banner, Button, Field, Fields, IconButton, Sheet, TextField, Toggle } from "../ui";
import { cn } from "../../utils/cn";
import { BrandLogo, isBrandLogoId } from "../providerMarks";
import { API_BASE_URL } from "../../config/backend";
import { SETUP_GUIDES, type SetupGuideId } from "../../config/branding";
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
  /**
   * Whether this card's sheet is open. Held by IntegrationPanel so only one is
   * open at a time: each sheet carries a primary Save, and a view has one.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getIntegrationIcon(id: string) {
  const brand = id.replace(/_oauth$/, "");
  return isBrandLogoId(brand) ? <BrandLogo brand={brand} /> : <Plug aria-hidden={true} />;
}

/** The setup guide for a provider's sheet, when it has one. */
function setupGuideFor(id: string): string | undefined {
  const key = id.replace(/_oauth$/, "") as SetupGuideId;
  return SETUP_GUIDES[key];
}

/**
 * One sign-in provider: a card with its status and the one-click enable
 * toggle. Clicking the card opens its settings in the kit's Sheet
 * (design-system.md section 8), never an accordion: the list stays put and
 * Save stays in view, pinned in the sheet's footer.
 */
export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  definition,
  stored,
  secretsSupported,
  saving,
  onSave,
  onToggleEnabled,
  open,
  onOpenChange,
}) => {
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
    const next = !open;
    if (next) {
      setDraft(createInitialDraft());
      setProblems([]);
      setRevealed([]);
    }
    onOpenChange(next);
  }, [createInitialDraft, onOpenChange, open]);

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
    onOpenChange(false);
  }, [defaultRedirectUrl, definition, draft, onOpenChange, onSave, secretsSupported, stored]);

  const toggleReveal = useCallback((key: string) => {
    setRevealed((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }, []);

  const problemFor = (key: string): string | null =>
    problems.find((problem) => problem.key === key)?.message ?? null;

  const statusBadge = redirectStale ? (
    <Badge tone="warning">Update needed</Badge>
  ) : configured ? (
    <Badge tone="success">Connected</Badge>
  ) : (
    <Badge tone="neutral">Not connected</Badge>
  );

  return (
    <article className={cn("integration-card", configured && "is-configured")}>
      <div
        className="integration-card-bar"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Edit ${definition.name}`}
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
            {getIntegrationIcon(definition.id)}
          </span>
          <span className="integration-card-title">{definition.name}</span>
          {statusBadge}
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
                setDraft(createInitialDraft());
                setProblems([]);
                setRevealed([]);
                onOpenChange(true);
              }
            }}
          />
          <span className="integration-chevron">
            <ChevronRight aria-hidden={true} />
          </span>
        </div>
      </div>

      {open && (
        <Sheet
          title={definition.name}
          badge={statusBadge}
          icon={getIntegrationIcon(definition.id)}
          guide={setupGuideFor(definition.id) ? { href: setupGuideFor(definition.id)! } : undefined}
          onClose={() => onOpenChange(false)}
          footer={
            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
              Save settings
            </Button>
          }
        >

          {redirectStale ? (
            <Banner
              tone="warning"
              title="Redirect URL changed"
              message={`The API address changed. Save to update it, and add ${defaultRedirectUrl} to the authorized redirect URIs in your ${definition.name} app.`}
            />
          ) : null}

          <Fields>
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
                  <Field
                    label={field.label}
                    htmlFor={`integration-${definition.id}-${field.key}`}
                    error={problem ?? undefined}
                    hint={field.help}
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
                  </Field>

                </React.Fragment>
              );
            })}
          </Fields>
        </Sheet>
      )}
    </article>
  );
};
