import React from "react";
import { useConnection } from "../../hooks/useConnection";
import { ProfilePage } from "../billing/ProfilePage";
import { SubscriptionPage } from "../billing/SubscriptionPage";

export type AccountView = "profile" | "subscription";

export interface ConnectTabProps {
  view: AccountView;
  onChangeView: (view: AccountView) => void;
  /** Bumped by every Upgrade elsewhere in the panel, to open the plans. */
  showPlansRequest: number;
  onOpenAuth: (mode: "register" | "login") => void;
}

/**
 * Account, behind the account icon. F19, 19-pro-lock-and-trial.md 2.1.
 *
 * The BEAF plugin's Profile and Manage Subscription screens, copied so every
 * Framefic plugin bills the same way (components/billing). Signed out, Profile
 * offers Sign Up and Sign In, which open the account page in a browser tab.
 * The email-and-code Connect form is gone; the backend keeps its routes for
 * older panels.
 */
export const ConnectTab: React.FC<ConnectTabProps> = ({ view, onChangeView, showPlansRequest, onOpenAuth }) => {
  const { state } = useConnection();

  if (state.status === "connected" && view === "subscription") {
    return <SubscriptionPage onClose={() => onChangeView("profile")} showPlansRequest={showPlansRequest} />;
  }

  return (
    <ProfilePage
      onManageSubscription={() => onChangeView("subscription")}
      onSignUp={() => onOpenAuth("register")}
      onSignIn={() => onOpenAuth("login")}
    />
  );
};
