import React from "react";
import {
  Bookmark,
  ClipboardList,
  CreditCard,
  Download,
  Hammer,
  KeyRound,
  KeySquare,
  LayoutDashboard,
  Library,
  LogIn,
  Newspaper,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "../../ui";
import type { CanvasComponentEntry, CanvasComponentId } from "../componentRegistry";

export interface PendingPreviewProps {
  entry: CanvasComponentEntry;
}

/** One icon per component, so the card says what it is before it is read. */
const ICONS: Partial<Record<CanvasComponentId, React.ReactNode>> = {
  member_auth: <KeyRound aria-hidden={true} />,
  member_login: <LogIn aria-hidden={true} />,
  member_register: <UserPlus aria-hidden={true} />,
  member_password_reset: <KeySquare aria-hidden={true} />,
  member_otp_verify: <ShieldCheck aria-hidden={true} />,
  member_dashboard: <LayoutDashboard aria-hidden={true} />,
  member_pricing: <CreditCard aria-hidden={true} />,
  metered_paywall: <Newspaper aria-hidden={true} />,
  protected_download: <Download aria-hidden={true} />,
  bookmark_button: <Bookmark aria-hidden={true} />,
  bookmarks_tray: <Library aria-hidden={true} />,
  onboarding_modal: <ClipboardList aria-hidden={true} />,
};

/**
 * The selected component, described for a creator: what it does, and where it
 * usually goes. A component not built yet still names the task that builds it,
 * because an unexplained empty card reads as a bug.
 */
export const PendingPreview: React.FC<PendingPreviewProps> = ({ entry }) => (
  <div className="studio-pending">
    <span className="studio-pending-icon">{ICONS[entry.id] ?? <Hammer aria-hidden={true} />}</span>
    <p className="studio-pending-title">{entry.name}</p>
    <p className="studio-pending-body">
      {entry.previewNote ?? `Not built yet. It arrives with task ${entry.task}.`}
    </p>
    {entry.placement ? <Badge tone="neutral">{entry.placement}</Badge> : null}
  </div>
);
