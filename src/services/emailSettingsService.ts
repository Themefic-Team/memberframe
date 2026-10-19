/**
 * A site's own SMTP: the two requests the settings document cannot answer.
 * Development doc: 25-custom-smtp.md.
 */

import { apiClient, type ApiClient, type ApiResult } from "./apiClient";
import type { SmtpStatus } from "../utils/smtpSettings";

/** `GET /api/site/email/status`: on or off, complete or not, and the last send. */
export function fetchEmailStatus(siteId: string, client: ApiClient = apiClient): Promise<ApiResult<SmtpStatus>> {
  return client.get("/api/site/email/status", { siteId });
}

/** `POST /api/site/email/test`: one email through the site's own server, with no fallback. */
export function sendTestEmail(
  siteId: string,
  to: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ sent: boolean; error?: string }>> {
  return client.post("/api/site/email/test", { siteId, to });
}
