/**
 * The member runtime routes.
 *
 * Called by `<MemberAuth>` and `<MemberGate>` on a creator's published site.
 * Every path here matches what those components already call, because they are
 * deployed inside generated files on real sites and are the most expensive
 * thing in the system to change. Backend PRD section 6.1 has the reconciliation
 * table.
 *
 * Each handler is thin on purpose: validate, call a service, set a cookie,
 * answer. The decisions live in `services/`, where they can be read without
 * Express in the way.
 */

import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { ok, okEmpty, route, unauthorized } from "../middleware/errors.js";
import { requireSite } from "../middleware/site.js";
import { guardCredentialCheck, guardEmailSend } from "../middleware/rateLimit.js";
import { clearSessionCookie, sessionLifetimeSeconds, setSessionCookie } from "../lib/cookies.js";
import {
  registerMember,
  requestPasswordReset,
  resetPassword,
  signInWithPassword,
} from "../services/memberAuthService.js";
import {
  issueSession,
  loadSession,
  loadTierLadder,
  revokeAllSessionsForMember,
  revokeSession,
  touchSession,
} from "../services/sessionService.js";
import {
  forgotPasswordSchema,
  loginPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validation/schemas.js";

export const memberRouter = Router();

/**
 * Shape a member for the wire.
 *
 * One place, so no endpoint can accidentally serialize a column the client
 * must not see. `passwordHash` is the obvious one; `failedLoginCount` and
 * `lockedUntil` matter too, because either would say whether an address is
 * registered.
 *
 * `currentPeriodEnd` and `gracePeriodEndsAt` are zero until the subscriptions
 * table exists (backend PRD phase B3). `isEntitled` reads them only on the
 * `past_due` and `canceled` branches, so a zero can only deny access, never
 * grant it, which is the right direction to be wrong in.
 */
function memberPayload(member: {
  id: string;
  siteId: string;
  email: string;
  name: string | null;
  activeTier: string;
  status: string;
}) {
  return {
    memberId: member.id,
    email: member.email,
    name: member.name,
    activeTier: member.activeTier,
    status: member.status,
    currentPeriodEnd: 0,
    gracePeriodEndsAt: 0,
    siteId: member.siteId,
  };
}

// ============================================================================
// GET /api/member/session
// ============================================================================
// What `<MemberGate>` calls on every page load. A 401 is not an error here: it
// is the ordinary answer for a visitor who is not signed in, and the component
// renders its locked state. Returning anything else would make the gate show a
// failure message to someone who simply has not signed in.

memberRouter.get(
  "/session",
  route(async (req, res) => {
    const site = requireSite(req);
    const token = req.cookies?.[env.session.cookieName] as string | undefined;

    const session = await loadSession(token, site.id);

    if (!session) {
      // The tier ladder goes out even when nobody is signed in. The gate needs
      // it to interpret its own `requiredTier`, and withholding it would force
      // the component back onto its hardcoded default, which is conflict C5.
      res.status(401).json({ tiers: await loadTierLadder(site.id) });
      return;
    }

    void touchSession(session.sessionId);

    ok(res, { member: session.member, tiers: session.tiers });
  })
);

// ============================================================================
// POST /api/member/register
// ============================================================================

memberRouter.post(
  "/register",
  route(async (req, res) => {
    const site = requireSite(req);
    const input = registerSchema.parse(req.body);

    // Rate limited as an email-sending action even though it sends none yet:
    // creating accounts in bulk is the abuse to stop, and a verification email
    // is a near-term addition.
    guardEmailSend(req, "register", input.email);

    const member = await registerMember({
      siteId: site.id,
      email: input.email,
      password: input.password,
      name: input.name,
    });

    const ttl = sessionLifetimeSeconds(false);
    const session = await issueSession(member.id, site.id, ttl, {
      userAgent: req.header("user-agent"),
      ipAddress: req.ip,
    });

    setSessionCookie(res, session.token, { maxAgeSeconds: ttl });

    ok(res, { member: memberPayload(member), tiers: await loadTierLadder(site.id) });
  })
);

// ============================================================================
// POST /api/member/login-password
// ============================================================================

memberRouter.post(
  "/login-password",
  route(async (req, res) => {
    const site = requireSite(req);
    const input = loginPasswordSchema.parse(req.body);

    // Per IP only. The per-address defence is the database lockout, and adding
    // an in-memory per-address limit here would let an attacker lock a member
    // out of their own account with five guesses. See `rateLimit.ts`.
    guardCredentialCheck(req, "login");

    const member = await signInWithPassword({
      siteId: site.id,
      email: input.email,
      password: input.password,
    });

    const ttl = sessionLifetimeSeconds(input.rememberMe);
    const session = await issueSession(member.id, site.id, ttl, {
      userAgent: req.header("user-agent"),
      ipAddress: req.ip,
    });

    setSessionCookie(res, session.token, { maxAgeSeconds: ttl });

    ok(res, { member: memberPayload(member), tiers: await loadTierLadder(site.id) });
  })
);

// ============================================================================
// POST /api/member/forgot-password
// ============================================================================
// Always 200. FP-02 section 3.4 rule 3: an unregistered address and a
// registered one must be indistinguishable, so there is no branch here to get
// wrong. The service returns void precisely so a future edit cannot start
// reporting which case it was.

memberRouter.post(
  "/forgot-password",
  route(async (req, res) => {
    const site = requireSite(req);
    const input = forgotPasswordSchema.parse(req.body);

    guardEmailSend(req, "forgot", input.email);

    await requestPasswordReset({
      siteId: site.id,
      siteName: site.siteName,
      email: input.email,
    });

    okEmpty(res);
  })
);

// ============================================================================
// POST /api/member/reset-password
// ============================================================================

memberRouter.post(
  "/reset-password",
  route(async (req, res) => {
    const site = requireSite(req);
    const input = resetPasswordSchema.parse(req.body);

    guardCredentialCheck(req, "reset");

    const result = await resetPassword({
      siteId: site.id,
      token: input.token,
      newPassword: input.newPassword,
    });

    // Sign them in on the device that completed the reset. Every other session
    // was revoked inside the service, which is what makes this a recovery.
    const ttl = sessionLifetimeSeconds(false);
    const session = await issueSession(result.memberId, site.id, ttl, {
      userAgent: req.header("user-agent"),
      ipAddress: req.ip,
    });

    setSessionCookie(res, session.token, { maxAgeSeconds: ttl });

    const member = await prisma.member.findUnique({
      where: { id: result.memberId },
      select: {
        id: true,
        siteId: true,
        email: true,
        name: true,
        activeTier: true,
        status: true,
      },
    });

    if (!member) throw unauthorized("invalid_token");

    ok(res, { member: memberPayload(member), tiers: await loadTierLadder(site.id) });
  })
);

// ============================================================================
// POST /api/member/logout
// ============================================================================
// 200 whether or not a session was found. "You are signed out" is true either
// way, and a 401 here would make a double-click look like a failure.

memberRouter.post(
  "/logout",
  route(async (req, res) => {
    requireSite(req);
    const token = req.cookies?.[env.session.cookieName] as string | undefined;

    if (token) await revokeSession(token);

    clearSessionCookie(res);
    okEmpty(res);
  })
);

// ============================================================================
// POST /api/member/logout-everywhere
// ============================================================================
// Not in any plan, and two lines given the machinery exists. A member who
// suspects someone else is signed in as them has no other way to act on it,
// and the alternative is telling them to change their password to achieve a
// side effect.

memberRouter.post(
  "/logout-everywhere",
  route(async (req, res) => {
    const site = requireSite(req);
    const token = req.cookies?.[env.session.cookieName] as string | undefined;

    const session = await loadSession(token, site.id);
    if (!session) throw unauthorized();

    const revoked = await revokeAllSessionsForMember(session.member.memberId);

    clearSessionCookie(res);
    ok(res, { sessionsRevoked: revoked });
  })
);
