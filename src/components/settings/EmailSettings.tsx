import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Mail, Save, Send } from "lucide-react";
import { Badge, Banner, Button, Field, Fields, Select, Sheet, TextField, Toggle } from "../ui";
import { cn } from "../../utils/cn";
import { fetchEmailStatus, sendTestEmail } from "../../services/emailSettingsService";
import {
  SECURITY_OPTIONS,
  lastSendFailure,
  smtpBadge,
  smtpDraftFrom,
  smtpDraftProblems,
  smtpValues,
  suggestedPort,
  type SmtpDraft,
  type SmtpSecurity,
  type SmtpStatus,
} from "../../utils/smtpSettings";
import type { StoredIntegration } from "./integrationRegistry";

export interface EmailSettingsProps {
  siteId: string | null;
  /** The saved `custom_smtp` entry, absent until the first save. */
  stored: StoredIntegration | undefined;
  saving: boolean;
  /** Saves the whole entry. Resolves true when the server accepted it. */
  onSave: (enabled: boolean, values: Record<string, string>) => Promise<boolean>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Settings, Config, Email: the site's own SMTP server. Development doc:
 * 25-custom-smtp.md.
 *
 * Off, every member email goes out from MemberFrame's sender, as it always
 * has. On, it goes through the creator's server, and falls back to
 * MemberFrame's sender if that fails, so a member is never locked out.
 *
 * The integration card, like Settings, Integration, so a credential looks the
 * same wherever it is entered: the same card, the same badges. Clicking it
 * opens the form in the kit's Sheet (design-system.md section 8), with Save
 * pinned in the footer. The sheet stays open after a save, because the test
 * email, the natural next step, appears once sending is on.
 */
export const EmailSettings: React.FC<EmailSettingsProps> = ({ siteId, stored, saving, onSave }) => {
  const enabled = stored?.enabled === true;
  const passwordStored = stored?.secretsPresent.includes("password") === true;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SmtpDraft>(() => smtpDraftFrom(stored));
  const [problems, setProblems] = useState<Partial<Record<keyof SmtpDraft, string>>>({});
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ sent: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let live = true;
    void fetchEmailStatus(siteId).then((result) => {
      if (live && result.kind === "ok") setStatus(result.data);
    });
    return () => {
      live = false;
    };
  }, [siteId, refresh, stored]);

  /** Open the sheet with the saved values; closing discards unsaved edits. */
  const openSheet = useCallback(() => {
    setDraft(smtpDraftFrom(stored));
    setProblems({});
    setTestResult(null);
    setOpen(true);
  }, [stored]);

  const update = <Key extends keyof SmtpDraft>(key: Key, value: SmtpDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setProblems((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const changeSecurity = (security: SmtpSecurity) => {
    // Follow the usual port while the creator has not chosen one of their own.
    const followsDefault = draft.port === suggestedPort(draft.security) || draft.port === "";
    setDraft((current) => ({ ...current, security, port: followsDefault ? suggestedPort(security) : current.port }));
  };

  const handleSave = async () => {
    const found = smtpDraftProblems(draft, passwordStored);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    // Saving the form turns custom sending on: filling it in is asking for it.
    if (await onSave(true, smtpValues(draft))) {
      setDraft((current) => ({ ...current, password: "" }));
      setRefresh((count) => count + 1);
    }
  };

  const handleToggle = (next: boolean) => {
    const complete = Object.keys(smtpDraftProblems(smtpDraftFrom(stored), passwordStored)).length === 0;
    if (next && !complete) {
      // Nothing usable is saved yet: open the form rather than send a save the server would refuse.
      if (!open) openSheet();
      return;
    }
    // The stored values go back unchanged; the password stays on the server.
    void onSave(next, { ...(stored?.values ?? {}) });
  };

  const handleTest = async () => {
    if (!siteId) return;
    setTesting(true);
    setTestResult(null);
    const result = await sendTestEmail(siteId, testTo.trim());
    setTesting(false);
    setRefresh((count) => count + 1);

    if (result.kind === "ok") {
      setTestResult(
        result.data.sent
          ? { sent: true, message: `Sent to ${testTo.trim()}. Check the inbox and the spam folder.` }
          : { sent: false, message: result.data.error ?? "The email was not sent." }
      );
    } else if (result.kind === "rate_limited") {
      setTestResult({ sent: false, message: "Too many test emails. Wait a few minutes and try again." });
    } else {
      setTestResult({ sent: false, message: "Could not reach MemberFrame. Check your connection and try again." });
    }
  };

  const badge = smtpBadge(enabled, status);
  const failure = lastSendFailure(status);
  const busy = saving || siteId === null;

  return (
    <article className={cn("integration-card", enabled && "is-configured")}>
      <div
        className="integration-card-bar"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label="Edit Custom SMTP"
        onClick={openSheet}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSheet();
          }
        }}
      >
        <div className="integration-card-bar-left">
          <span className="integration-card-icon">{enabled ? <Check aria-hidden={true} /> : <Mail aria-hidden={true} />}</span>
          <span className="integration-card-title">Custom SMTP</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <div className="integration-card-bar-right" onClick={(event) => event.stopPropagation()}>
          <Toggle id="email-smtp-status" checked={enabled} disabled={busy} label="Send member emails through my SMTP server" onChange={handleToggle} />
          <span className="integration-chevron">
            <ChevronRight aria-hidden={true} />
          </span>
        </div>
      </div>

      {open ? (
        <Sheet
          title="Custom SMTP"
          badge={<Badge tone={badge.tone}>{badge.label}</Badge>}
          onClose={() => setOpen(false)}
          footer={
            <Button variant="primary" size="md" loading={saving} disabled={siteId === null} onClick={() => void handleSave()}>
              <Save aria-hidden={true} />
              {enabled ? "Save SMTP settings" : "Save and turn on"}
            </Button>
          }
        >

          {testResult ? (
            <Banner tone={testResult.sent ? "success" : "warning"} title={testResult.sent ? "Test email sent" : "Test email failed"} message={testResult.message} />
          ) : failure ? (
            <Banner tone="warning" title="Last email failed" message={failure} />
          ) : null}

          <Fields>
            <Field label="Host" htmlFor="smtp-host" error={problems.host} hint="Your provider's SMTP server, for example smtp.gmail.com or smtp.sendgrid.net.">
              <TextField id="smtp-host" fill value={draft.host} onChange={(value) => update("host", value)} placeholder="smtp.example.com" disabled={busy} invalid={Boolean(problems.host)} autoComplete="off" />
            </Field>
            <Field label="Security" htmlFor="smtp-security" hint="STARTTLS suits most providers. SSL/TLS is the older port 465. None is not encrypted.">
              <Select id="smtp-security" fill value={draft.security} options={SECURITY_OPTIONS} onChange={changeSecurity} disabled={busy} />
            </Field>
            <Field label="Port" htmlFor="smtp-port" error={problems.port} hint="Set for you by Security. Change it only if your provider says so.">
              <TextField id="smtp-port" fill value={draft.port} onChange={(value) => update("port", value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" disabled={busy} invalid={Boolean(problems.port)} />
            </Field>
            <Field label="Username" htmlFor="smtp-username" error={problems.username} hint="Often your full email address, or a word like apikey. Leave empty if your server needs no sign in.">
              <TextField id="smtp-username" fill value={draft.username} onChange={(value) => update("username", value)} disabled={busy} autoComplete="off" />
            </Field>
            <Field label="Password" htmlFor="smtp-password" error={problems.password} hint="Stored encrypted and never shown again. Many providers want an app password or API key.">
              <TextField
                id="smtp-password"
                fill
                type="password"
                value={draft.password}
                onChange={(value) => update("password", value)}
                placeholder={passwordStored ? "Saved. Type to replace" : ""}
                disabled={busy}
                invalid={Boolean(problems.password)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="From name" htmlFor="smtp-from-name" error={problems.fromName} hint="The sender name members see, usually your site's name.">
              <TextField id="smtp-from-name" fill value={draft.fromName} onChange={(value) => update("fromName", value)} placeholder="Your site" disabled={busy} />
            </Field>
            <Field label="From address" htmlFor="smtp-from-address" error={problems.fromAddress} hint="An address your SMTP server is allowed to send from.">
              <TextField id="smtp-from-address" type="email" fill value={draft.fromAddress} onChange={(value) => update("fromAddress", value)} placeholder="hello@yoursite.com" disabled={busy} invalid={Boolean(problems.fromAddress)} />
            </Field>
            <Field label="Reply-to" htmlFor="smtp-reply-to" error={problems.replyTo} hint="Optional. Where members' replies go, if not the From address.">
              <TextField id="smtp-reply-to" type="email" fill value={draft.replyTo} onChange={(value) => update("replyTo", value)} placeholder="Optional" disabled={busy} invalid={Boolean(problems.replyTo)} />
            </Field>
          </Fields>

          {enabled ? (
            <>
              <Fields>
                <Field label="Test address" htmlFor="smtp-test-to" hint="Sends one email through your server only, with no fallback, so you see its real result.">
                  <TextField id="smtp-test-to" type="email" fill value={testTo} onChange={setTestTo} placeholder="you@example.com" disabled={testing} />
                </Field>
              </Fields>
              <Button variant="secondary" size="md" full loading={testing} disabled={!EMAIL.test(testTo.trim())} onClick={() => void handleTest()}>
                <Send aria-hidden={true} />
                Send test email
              </Button>
            </>
          ) : null}
        </Sheet>
      ) : null}
    </article>
  );
};
