/**
 * The Express app.
 *
 * Separate from `server.ts` so a test can import the app without binding a
 * port. `server.ts` is the only file that calls `listen`.
 */

import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { checkDatabase } from "./config/db.js";
import { errorHandler, notFoundHandler, ok, route } from "./middleware/errors.js";
import { preflight, resolveSite } from "./middleware/site.js";
import { memberRouter } from "./routes/member.js";

export function createApp(): Express {
  const app = express();

  // No `X-Powered-By: Express`. It names the framework and version to anyone
  // shopping for a target, and buys nothing.
  app.disable("x-powered-by");

  // Trust the proxy only in production, where there is one. Trusting it in
  // development would let any client set its own `X-Forwarded-For` and walk
  // straight past the per-IP rate limit by sending a new value each time.
  if (env.isProduction) app.set("trust proxy", 1);

  // A small body limit. Nothing here accepts more than a few hundred bytes,
  // and the default of 100kb is a free denial-of-service budget.
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  // Preflight before anything that needs a site, because an OPTIONS request
  // carries neither a cookie nor the custom header.
  app.use(preflight);

  // ------------------------------------------------------------------------
  // Health, with no site key required
  // ------------------------------------------------------------------------
  // Two endpoints rather than one. `/health` answers "is the process up" and
  // is what a load balancer should poll. `/health/db` touches MySQL and is
  // what a human checks, and it is kept out of the balancer's path so a
  // database blip does not take every instance out of rotation.

  app.get("/health", (_req, res) => {
    ok(res, { status: "ok", environment: env.nodeEnv });
  });

  app.get(
    "/health/db",
    route(async (_req, res) => {
      const status = await checkDatabase();

      res.status(status.connected ? 200 : 503).json({
        connected: status.connected,
        // Only outside production. A version string is reconnaissance.
        ...(env.isProduction
          ? {}
          : { version: status.version, database: status.database, warnings: status.warnings }),
        ...(status.error && !env.isProduction ? { error: status.error } : {}),
      });
    })
  );

  // ------------------------------------------------------------------------
  // Member runtime
  // ------------------------------------------------------------------------
  // `resolveSite` guards the whole subtree, so no handler below can run
  // without a resolved tenant and a checked origin. Mounting it per route
  // would be one `router.use` away from a route that forgot.

  app.use("/api/member", resolveSite, memberRouter);

  // ------------------------------------------------------------------------
  // Not built yet, and honest about it
  // ------------------------------------------------------------------------
  // `<MemberAuth>` ships with the code path enabled by default, so it will
  // call these. A bare 404 would surface in the component as `unavailable`,
  // which reads as "the service is broken" rather than "this is not built".
  // 501 still maps to `unavailable` on the client, and says which it is to
  // anyone reading the network panel.

  for (const path of ["/api/member/send-otp", "/api/member/verify-otp"]) {
    app.post(path, (_req, res) => {
      res.status(501).json({
        reason: "not_implemented",
        detail: "The OTP flow is not built yet. Use the password path, or see backend PRD phase B2.",
      });
    });
  }

  app.all("/api/checkout/*", (_req, res) => {
    res.status(501).json({
      reason: "not_implemented",
      detail: "Payments are backend PRD phase B3.",
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
