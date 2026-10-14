import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Link2, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Banner, Button, EmptyState, FieldRow, FieldRows, TextField, useToast } from "../ui";
import { useConnection } from "../../hooks/useConnection";
import { failureMessage } from "../../services/apiClient";
import { startConnect, toConnection, verifyConnect } from "../../services/connectService";
import { addAllowedOrigins } from "../../services/siteSettingsService";
import { shortProjectId } from "../../services/framerProjectService";
import {
  CONNECT_CODE_LENGTH,
  codeComplete,
  connectFailureMessage,
  describeOrigin,
  emailProblem,
  emailProblemMessage,
  looksLikeOrigin,
  normalizeCode,
} from "../connect/connectValidation";

/**
 * The Connect tab. The first thing a creator uses, and the thing every other
 * tab depends on.
 *
 * ## What it actually does
 *
 * It hands the backend the three facts it needs to create a tenant: the Framer
 * project id, the creator's email address, and the project name. The first and
 * third come from `framer.getProjectInfo()`; the second cannot, because
 * `framer.getCurrentUser()` exposes no address at all (blocker B7). So the
 * creator types it, and a six-digit code turns a typed claim into a proven one.
 *
 * Without that code, anyone who learned a Framer project id could type any
 * address and receive a token that reads every member of that site.
 *
 * ## One `.primary-cta`, which moves
 *
 * PRD section 7.3 allows exactly one per view, and this tab has three views:
 * the email form, the code form, and the connected summary. Each has its own
 * single primary action, and they are mutually exclusive branches rather than
 * sections of one screen, so the rule holds.
 */
export const ConnectTab: React.FC = () => {
  const { state, project, settings, completeConnect, applyConnection, disconnect, reload, failure } =
    useConnection();
  const showToast = useToast();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [newOrigin, setNewOrigin] = useState("");

  // Prefill from a previous connection, so reconnecting after a token expiry is
  // one field rather than two.
  useEffect(() => {
    if (state.status === "code_sent") setEmail(state.email);
  }, [state]);

  const emailIssue = useMemo(() => emailProblem(email), [email]);

  // ------------------------------------------------------------------------
  // Step one: ask for a code
  // ------------------------------------------------------------------------

  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  const handleSendCode = useCallback(async () => {
    if (!project || project.unavailable) return;

    const issue = emailProblem(email);
    if (issue) {
      setProblem(emailProblemMessage(issue));
      return;
    }

    setBusy(true);
    setProblem(null);

    const result = await startConnect({
      email: email.trim(),
      framerProjectId: project.projectId,
    });

    setBusy(false);

    if (result.kind === "ok") {
      setCodeSentTo(email.trim());
      setCode("");
      return;
    }

    if (result.kind === "unavailable" && result.status === 400) {
      setProblem(connectFailureMessage("resend_too_soon"));
      return;
    }

    setProblem(failureMessage(result).message);
  }, [email, project]);

  // ------------------------------------------------------------------------
  // Step two: verify it
  // ------------------------------------------------------------------------

  const handleVerify = useCallback(async () => {
    if (!project || project.unavailable || !codeSentTo) return;

    setBusy(true);
    setProblem(null);

    const result = await verifyConnect({
      email: codeSentTo,
      code: normalizeCode(code),
      framerProjectId: project.projectId,
      projectName: project.projectName,
      creatorName: project.creatorName,
      // The published origins, read from the SDK. This is what makes the
      // allowlist correct without the creator typing their own domain, and a
      // wrong allowlist is the difference between a membership that works in
      // production and one that fails there after working in preview.
      origins: project.publishedOrigins,
    });

    setBusy(false);

    if (result.kind === "ok") {
      await completeConnect(
        toConnection(result.data.site, result.data.creator),
        result.data.token,
        result.data.settings,
        result.data.settingsVersion
      );

      setCode("");
      setCodeSentTo(null);
      showToast({ tone: "success", message: "Project connected" });
      return;
    }

    if (result.kind === "unauthorized") {
      setProblem(connectFailureMessage("invalid_code"));
      return;
    }

    if (result.kind === "forbidden") {
      setProblem(connectFailureMessage("project_claimed_by_another_account"));
      return;
    }

    setProblem(failureMessage(result).message);
  }, [code, codeSentTo, completeConnect, project, showToast]);

  // ------------------------------------------------------------------------
  // Adding an origin by hand
  // ------------------------------------------------------------------------

  const handleAddOrigin = useCallback(async () => {
    if (state.status !== "connected") return;

    if (!looksLikeOrigin(newOrigin)) {
      setProblem("Enter the full address, including https://.");
      return;
    }

    setBusy(true);
    setProblem(null);

    const result = await addAllowedOrigins(state.connection.siteId, [newOrigin.trim()]);

    setBusy(false);

    if (result.kind === "ok") {
      await applyConnection({ ...state.connection, allowedOrigins: result.data.allowedOrigins });
      setNewOrigin("");
      showToast({ tone: "success", message: "Domain allowed" });
      return;
    }

    setProblem(failureMessage(result).message);
  }, [applyConnection, newOrigin, showToast, state]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    await disconnect();
    setBusy(false);
    showToast({ tone: "success", message: "Disconnected" });
  }, [disconnect, showToast]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  if (state.status === "loading") {
    return (
      <div className="tab-panel-body">
        <p className="connect-status">Checking this project.</p>
      </div>
    );
  }

  // The standalone browser dev preview, where the SDK is not reachable. Saying
  // so beats offering a form whose submit cannot work.
  if (project?.unavailable) {
    return (
      <div className="tab-panel-body">
        <EmptyState
          icon={<ShieldCheck aria-hidden={true} />}
          title="Open this in Framer"
          description="Connecting needs the Framer project, which is not available in a browser preview."
        />
      </div>
    );
  }

  if (state.status === "connected") {
    const { connection } = state;

    return (
      <div className="tab-panel-body">
        <section className="section-group">
          <h2 className="section-title">Connected</h2>

          <div className="connect-summary">
            <span className="connect-summary-icon">
              <ShieldCheck aria-hidden={true} />
            </span>
            <div className="connect-summary-body">
              <p className="connect-summary-name">{connection.siteName}</p>
              <p className="connect-summary-meta">{connection.creatorEmail}</p>
            </div>
          </div>

          <FieldRows>
            <FieldRow label="Framer project">
              <span className="connect-value">{shortProjectId(connection.framerProjectId)}</span>
            </FieldRow>
            <FieldRow label="Site key">
              {/*
                Shown in full and on purpose. It is baked into every generated
                canvas component and therefore readable in the page source of
                any published site, exactly like a Stripe publishable key.
                Masking it would imply a secrecy it does not have, and a creator
                debugging a request needs to compare it against a header.
              */}
              <span className="connect-value connect-value-key">{connection.siteKey}</span>
            </FieldRow>
            <FieldRow label="Members">
              <span className="connect-value">{settings ? "Managed in Manage" : "Unknown"}</span>
            </FieldRow>
          </FieldRows>
        </section>

        <section className="section-group">
          <h2 className="section-title">Allowed domains</h2>

          <p className="connect-help">
            Only these domains may use this site key. A published site that is
            not listed here is refused.
          </p>

          {connection.allowedOrigins.length === 0 ? (
            <Banner
              tone="warning"
              title="No domain allowed yet"
              message="Publish the site, then reconnect, or add the domain below."
            />
          ) : (
            <ul className="connect-origin-list">
              {connection.allowedOrigins.map((origin) => (
                <li key={origin} className="connect-origin">
                  <Globe aria-hidden={true} />
                  <span>{describeOrigin(origin)}</span>
                </li>
              ))}
            </ul>
          )}

          <FieldRows>
            <FieldRow label="Add a domain" htmlFor="connect-origin" fill>
              <TextField
                id="connect-origin"
                type="url"
                fill
                value={newOrigin}
                placeholder="https://yoursite.com"
                onChange={setNewOrigin}
              />
            </FieldRow>
          </FieldRows>

          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy || newOrigin.trim() === ""}
            onClick={() => void handleAddOrigin()}
          >
            <Plus aria-hidden={true} />
            Add domain
          </Button>
        </section>

        {problem ? <Banner tone="danger" title="Could not save" message={problem} /> : null}

        <section className="section-group">
          <h2 className="section-title">Connection</h2>
          <p className="connect-help">
            Disconnecting signs this panel out. Members, tiers, and settings are
            kept, and reconnecting restores access to them.
          </p>

          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy}
            onClick={() => void handleDisconnect()}
          >
            <Unplug aria-hidden={true} />
            Disconnect panel
          </Button>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Not connected: either the email form or the code form
  // ------------------------------------------------------------------------

  return (
    <div className="tab-panel-body">
      <section className="section-group">
        <h2 className="section-title">Connect this project</h2>

        <p className="connect-help">
          MemberFrame stores your members and settings against this Framer
          project. Confirm your email once to link them.
        </p>

        {failure ? (
          <Banner
            tone="warning"
            title={failureMessage(failure).title}
            message={failureMessage(failure).message}
            action={{ label: "Try again", onClick: reload }}
          />
        ) : null}

        <FieldRows>
          <FieldRow label="Project">
            <span className="connect-value">{project?.projectName || "Untitled"}</span>
          </FieldRow>
          <FieldRow label="Project id">
            <span className="connect-value">{shortProjectId(project?.projectId ?? "")}</span>
          </FieldRow>
        </FieldRows>
      </section>

      {codeSentTo === null ? (
        <section className="section-group">
          <FieldRows>
            <FieldRow label="Your email" htmlFor="connect-email" fill>
              <TextField
                id="connect-email"
                type="email"
                fill
                value={email}
                placeholder="you@studio.com"
                autoComplete="email"
                invalid={problem !== null && emailIssue !== null}
                onChange={(value) => {
                  setEmail(value);
                  setProblem(null);
                }}
              />
            </FieldRow>
          </FieldRows>

          {problem ? <p className="connect-problem">{problem}</p> : null}

          <p className="connect-help">
            Framer does not share your email with plugins, so we ask once and
            send a code to confirm it.
          </p>

          {/* This view's one and only `.primary-cta`. */}
          <Button
            variant="primary"
            size="md"
            className="fill"
            disabled={busy || email.trim() === ""}
            onClick={() => void handleSendCode()}
          >
            <Link2 aria-hidden={true} />
            {busy ? "Sending" : "Send code"}
          </Button>
        </section>
      ) : (
        <section className="section-group">
          <p className="connect-help">
            Enter the {CONNECT_CODE_LENGTH} digit code sent to {codeSentTo}.
          </p>

          <FieldRows>
            <FieldRow label="Code" htmlFor="connect-code" fill>
              <TextField
                id="connect-code"
                type="text"
                fill
                value={code}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                invalid={problem !== null}
                onChange={(value) => {
                  setCode(normalizeCode(value));
                  setProblem(null);
                }}
              />
            </FieldRow>
          </FieldRows>

          {problem ? <p className="connect-problem">{problem}</p> : null}

          {/* This view's one and only `.primary-cta`. */}
          <Button
            variant="primary"
            size="md"
            className="fill"
            disabled={busy || !codeComplete(code)}
            onClick={() => void handleVerify()}
          >
            <ShieldCheck aria-hidden={true} />
            {busy ? "Connecting" : "Connect project"}
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy}
            onClick={() => {
              setCodeSentTo(null);
              setProblem(null);
            }}
          >
            <RefreshCw aria-hidden={true} />
            Use another email
          </Button>
        </section>
      )}
    </div>
  );
};
