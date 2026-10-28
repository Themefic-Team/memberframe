import React, { useCallback, useEffect, useState } from "react";
import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Banner, Button, ConfirmDialog, EmptyState, Field, IconButton, Sheet, TextField, useToast } from "../ui";
import { useConnection } from "../../hooks/useConnection";
import { fetchOriginStatus, replaceAllowedOrigins, type OriginSighting } from "../../services/siteSettingsService";
import { domainLabel, isWorking, seenLabel, toOrigin } from "../../utils/siteDomains";

/**
 * The domains the site is published on, typed by the creator.
 *
 * Until 2026-10-28 the panel read these from Framer's publish info and added
 * them by itself. The Marketplace review asked plugins not to send project
 * data, so the creator types them here instead (docs/development-docs/
 * 35-marketplace-review-report.md). The list is the site's origin allowlist:
 * sign up, sign in, payments, and locked content answer only on these domains.
 *
 * Is a typed domain really this site? Two checks, neither reading Framer:
 *   - on add, the server checks the name is a published, public website
 *     (`lib/domainCheck.ts`), which catches a typo;
 *   - once a page there loads a MemberFrame component, our server sees this
 *     site's key arrive from that domain (`lib/originSightings.ts`). The card
 *     then shows Working. A domain seen but not listed, such as a custom
 *     domain, is offered under "Seen on your site", and only the creator adds it.
 *
 * Built like the Settings lists (2026-10-28, the user's request): a card per
 * domain with a status dot, an empty state, and an Add button that opens a
 * sheet. It sits on Profile under Personal Info, so the heading keeps that
 * page's style. Removing a domain asks first (the delete confirm rule).
 */
export const SiteDomainsPanel: React.FC = () => {
  const { connection, applyConnection } = useConnection();
  const showToast = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [seen, setSeen] = useState<OriginSighting[]>([]);
  /** Why the status could not be read, or null. A failed read must not look like "Waiting". */
  const [statusProblem, setStatusProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const origins = connection?.allowedOrigins ?? [];
  const connected = connection !== null;
  const siteId = connection?.siteId ?? null;

  const refreshStatus = useCallback(async () => {
    if (!siteId) return;
    setChecking(true);
    const result = await fetchOriginStatus(siteId);
    setChecking(false);
    if (result.kind === "ok") {
      setSeen(result.data.seen);
      setStatusProblem(null);
      return;
    }
    // 404: a server from before domain status (2026-10-28). Anything else: a
    // failed request. Either way the cards cannot say Working or Waiting.
    setStatusProblem(
      result.kind === "unavailable" && result.status === 404
        ? "Your MemberFrame server does not report domain status yet. Deploy the latest backend, then check again."
        : "Could not check your domains just now. Check again in a moment."
    );
  }, [siteId]);

  // On open, and whenever the creator comes back from their live site.
  useEffect(() => {
    void refreshStatus();
    const onFocus = () => void refreshStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshStatus]);

  /** Replace the list on the server, then the panel's copy. Null when saved, else the reason. */
  const save = async (next: string[], success: string): Promise<string | null> => {
    if (!connection) return "Sign in first.";
    setSaving(true);
    const result = await replaceAllowedOrigins(connection.siteId, next);
    setSaving(false);
    if (result.kind !== "ok") {
      // The server says what was wrong with a domain (a typo, nothing published).
      return result.kind === "unavailable" && result.message ? result.message : "Could not save. Try again.";
    }
    await applyConnection({ ...connection, allowedOrigins: result.data.allowedOrigins });
    showToast({ tone: "success", message: success });
    void refreshStatus();
    return null;
  };

  const addOrigin = async (origin: string): Promise<string | null> => {
    if (origins.includes(origin)) return "That domain is already on the list.";
    return save([...origins, origin], "Domain added");
  };

  const openSheet = () => {
    setDraft("");
    setError(null);
    setAdding(true);
  };

  const submit = async () => {
    const origin = toOrigin(draft);
    if (!origin) {
      setError("Type a domain, like name.framer.app or acme.com.");
      return;
    }
    setError(null);
    const problem = await addOrigin(origin);
    if (problem) setError(problem);
    else setAdding(false);
  };

  const sightingFor = (origin: string) => seen.find((entry) => entry.origin === origin);
  const suggestions = seen.filter((entry) => !entry.allowed);

  /** What a domain card says under the host. */
  const statusLine = (origin: string): { working: boolean; text: string } => {
    if (statusProblem) return { working: false, text: "Status unknown" };
    const sighting = sightingFor(origin);
    if (!sighting) return { working: false, text: "Waiting for the first visit" };
    return { working: isWorking(sighting.lastSeenAt), text: seenLabel(sighting.lastSeenAt) };
  };

  return (
    <section className="ffmf-profile-section site-domains-section">
      <div className="site-domains-head">
        <h4 className="ffmf-profile-section-title">Site Domains</h4>
        {origins.length > 0 ? (
          <IconButton label={checking ? "Checking" : "Check again"} disabled={checking} onClick={() => void refreshStatus()}>
            <RefreshCw aria-hidden={true} />
          </IconButton>
        ) : null}
      </div>
      <p className="section-subtitle">
        Members can sign up, sign in, pay, and open locked content only on these domains. Your site key works nowhere else.
      </p>

      {statusProblem ? <Banner tone="info" title="Domain status unavailable" message={statusProblem} /> : null}

      {origins.length === 0 ? (
        <EmptyState
          icon={<Globe aria-hidden={true} />}
          title="No Domains Yet"
          description="Until you add your site's domain, visitors on your published site see a lock instead of sign in and checkout."
          action={
            <Button variant="secondary" onClick={openSheet} disabled={!connected || saving}>
              <Plus aria-hidden={true} />
              Add domain
            </Button>
          }
        />
      ) : (
        <>
          <div className="page-rules-list">
            {origins.map((origin) => {
              const status = statusLine(origin);
              return (
                <div key={origin} className="page-rule-card site-domain-card">
                  <div className="page-rule-card-header">
                    <div className="page-rule-info">
                      <span
                        className="page-rule-status-dot"
                        data-enabled={status.working}
                        title={status.working ? "Working" : "Not seen yet"}
                      />
                      <span className="webhook-card-name">
                        <span className="page-rule-title">{domainLabel(origin)}</span>
                        <span className="webhook-card-host">
                          {status.working ? `Working. ${status.text}` : status.text}
                        </span>
                      </span>
                    </div>
                    <div className="page-rule-header-actions">
                      <IconButton
                        label={`Remove ${domainLabel(origin)}`}
                        disabled={saving || !connected}
                        onClick={() => setRemoving(origin)}
                      >
                        <Trash2 aria-hidden={true} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="page-locks-btn-row">
            <Button variant="secondary" onClick={openSheet} disabled={!connected || saving}>
              <Plus aria-hidden={true} />
              <span>Add domain</span>
            </Button>
          </div>
        </>
      )}

      {suggestions.length > 0 ? (
        <div className="site-domains-suggest">
          <p className="site-domains-suggest-title">Seen on your site</p>
          <p className="section-subtitle">
            MemberFrame ran on these addresses with your site key. Add the ones that are yours, such as a custom domain.
          </p>
          <div className="page-rules-list">
            {suggestions.map((entry) => (
              <div key={entry.origin} className="page-rule-card site-domain-card">
                <div className="page-rule-card-header">
                  <div className="page-rule-info">
                    <span className="page-rule-status-dot" data-enabled={false} title="Not on the list" />
                    <span className="webhook-card-name">
                      <span className="page-rule-title">{domainLabel(entry.origin)}</span>
                      <span className="webhook-card-host">{seenLabel(entry.lastSeenAt)}</span>
                    </span>
                  </div>
                  <div className="page-rule-header-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving || !connected}
                      onClick={() => {
                        void addOrigin(entry.origin).then((problem) => {
                          if (problem) showToast({ tone: "error", message: "Could not add the domain" });
                        });
                      }}
                    >
                      <Plus aria-hidden={true} />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {adding ? (
        <Sheet
          title="Add a domain"
          description="Where your site is published. MemberFrame works only on listed domains."
          icon={<Globe aria-hidden={true} />}
          onClose={saving ? undefined : () => setAdding(false)}
          footer={
            <Button variant="primary" size="md" loading={saving} disabled={draft.trim() === ""} onClick={() => void submit()}>
              {saving ? "Checking" : "Add domain"}
            </Button>
          }
        >
          <Field
            label="Domain"
            htmlFor="site-domain-add"
            hint="Copy it from Framer: the address under Publish, like name.framer.app. Using a custom domain such as acme.com? Add it as well."
            error={error}
          >
            <TextField
              id="site-domain-add"
              value={draft}
              placeholder="name.framer.app"
              invalid={Boolean(error)}
              disabled={saving}
              fill
              autoFocus
              onChange={(value) => {
                setDraft(value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </Field>
          <p className="section-subtitle">We check that a website is published at this address before saving it.</p>
        </Sheet>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={`Remove ${domainLabel(removing)}?`}
          message={
            <p>
              Visitors on {domainLabel(removing)} can no longer sign up, sign in, pay, or open locked content until you add
              it again. The site updates at once.
            </p>
          }
          confirmLabel="Remove domain"
          cancelLabel="Keep domain"
          busy={saving}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const target = removing;
            void save(
              origins.filter((origin) => origin !== target),
              "Domain removed"
            ).then((problem) => {
              if (problem) showToast({ tone: "error", message: "Could not remove the domain" });
              setRemoving(null);
            });
          }}
        />
      ) : null}
    </section>
  );
};
