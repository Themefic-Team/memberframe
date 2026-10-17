/**
 * The component picker registry. PRD section 9.2, the authoritative inventory.
 *
 * All 15 insertable components are listed from day one, even though 14 of them
 * do not exist yet. Two reasons. A picker that lists only what is built
 * misrepresents the product to the creator, and it would need editing 14 more
 * times as the phases land. Each unbuilt entry names the task that will fill
 * it, so the placeholder explains itself instead of looking broken.
 *
 * `TeamManagement.tsx` is absent on purpose. PRD section 9.2 row 16 marks it
 * "No, embedded in MemberDashboard", so it is not insertable and has no picker
 * entry. That is why this list is 15 and the inventory is 16.
 */

export type CanvasComponentId =
  | "member_gate"
  | "member_auth"
  | "member_login"
  | "member_register"
  | "member_password_reset"
  | "member_otp_verify"
  | "member_dashboard"
  | "member_pricing"
  | "metered_paywall"
  | "cms_gated_template"
  | "protected_download"
  | "course_progress"
  | "lesson_checklist"
  | "video_progress_listener"
  | "donation_slider"
  | "member_directory"
  | "bookmark_button"
  | "bookmarks_tray"
  | "onboarding_modal"
  | "member_announcement_bar";

export interface CanvasComponentEntry {
  id: CanvasComponentId;
  /** Display Name column from PRD section 9.2. Shown in the picker. */
  name: string;
  /** Feature IDs, for traceability back to PRD section 8. */
  features: string;
  /**
   * The PRD task that authors this component. Shown verbatim in the
   * placeholder preview, so "empty" always comes with a reason.
   */
  task: string;
  /** Does a preview exist? False renders `PendingPreview`. */
  previewReady: boolean;
  /**
   * Can the generator produce this component and the deploy path insert it?
   *
   * Separate from `previewReady` because the two were built by different
   * tasks. Task 2.5 authored `<MemberAuth>`, so it is deployable, while its
   * panel preview and customizer are not scheduled anywhere in the plan.
   * Collapsing the two flags would force a choice between refusing to insert a
   * component that exists and claiming a preview that does not.
   */
  deployable: boolean;
  /**
   * Overrides the placeholder copy when "not built yet" is the wrong story.
   *
   * `<MemberAuth>` is built. Telling a creator its preview "arrives with task
   * 2.5" after task 2.5 shipped would be false.
   */
  previewNote?: string;
}

export const CANVAS_COMPONENTS: ReadonlyArray<CanvasComponentEntry> = [
   {
    id: "member_auth",
    name: "Member Auth",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Built and ready to insert. Configure it in the Framer properties panel: a panel preview is not scheduled yet.",
  },
  /*
    The four dedicated screens. Same engine as Member Auth, deployed as
    separate files with one flow each, so each page of a site gets the one
    form it needs. Member Auth stays for creators who want all flows in one
    box or a modal.
  */
  {
    id: "member_login",
    name: "Member Login",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Sign in only, for your login page. Links to your sign up, reset, and code pages when you set them in the properties panel.",
  },
  {
    id: "member_register",
    name: "Member Registration",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Sign up only, for your registration page. Links back to your login page.",
  },
  {
    id: "member_password_reset",
    name: "Password Reset",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "For your reset page. Asks for an email, and shows the new password form when a visitor opens the emailed link.",
  },
  {
    id: "member_otp_verify",
    name: "OTP Verification",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Passwordless sign in: emails a six digit code and verifies it. Links back to your login page.",
  },
  // { id: "member_gate", name: "Member Gate", features: "F01, F22", task: "1.7", previewReady: true, deployable: true },
 
  {
    id: "member_dashboard",
    name: "Member Dashboard",
    features: "F06",
    task: "5.1",
    previewReady: false,
    deployable: true,
    previewNote:
      "Built and ready to insert. It shows a member their email, tier, and status, and carries the sign out button. Billing and invoices arrive with payments.",
  },
  {
    id: "member_pricing",
    name: "Member Pricing",
    features: "F03, FP-16",
    task: "FP-16",
    previewReady: false,
    deployable: true,
    previewNote:
      "Built and ready to insert. It shows your tiers and their prices from Manage, Tiers, and each button starts a checkout on the gateway that suits the buyer. Put it on your pricing page.",
  },
  {
    id: "metered_paywall",
    name: "Soft Paywall",
    features: "F07, F08",
    task: "3.4",
    previewReady: false,
    deployable: true,
    previewNote:
      "Wraps an article. Readers get a set number of free articles each week or month, or the Read More teaser shows the opening paragraphs and frosts the rest. Members on the plan you choose read everything. Search engines still see the whole article.",
  },
  // { id: "cms_gated_template", name: "CMS Gated Template", features: "F09", task: "5.3", previewReady: false, deployable: false },
  {
    id: "protected_download",
    name: "Protected Download",
    features: "F10",
    task: "5.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Upgrade to Download. Upload a file in Manage, Files, choose the plan it needs, and paste its Asset ID here. Members on that plan get a download link that works for 60 seconds; everyone else is asked to sign in or upgrade.",
  },
  // { id: "course_progress", name: "Course Progress", features: "F11", task: "4.1", previewReady: false, deployable: false },
  // { id: "lesson_checklist", name: "Lesson Checklist", features: "F11", task: "4.1", previewReady: false, deployable: false },
  // { id: "video_progress_listener", name: "Video Progress Listener", features: "F11", task: "4.1", previewReady: false, deployable: false },
  // { id: "donation_slider", name: "Donation Slider", features: "F13", task: "7.3", previewReady: false, deployable: false },
  // { id: "member_directory", name: "Member Directory", features: "F15", task: "7.2", previewReady: false, deployable: false },
  {
    id: "bookmark_button",
    name: "Bookmark Button",
    features: "F14",
    task: "7.1",
    previewReady: false,
    deployable: true,
    previewNote:
      "Lets members save a page or a CMS item. Put it on a card and bind Item Slug to the CMS slug, or on a page to save that page. Signed out visitors are asked to sign in, and the item saves itself once they do.",
  },
  {
    id: "bookmarks_tray",
    name: "Bookmarks Tray",
    features: "F14",
    task: "7.1",
    previewReady: false,
    deployable: true,
    previewNote:
      "A saved items button for your navigation bar, with a count badge. It opens a drawer listing everything the member saved, with search and one click removal.",
  },
  {
    id: "onboarding_modal",
    name: "Onboarding Modal",
    features: "F16",
    task: "6.3",
    previewReady: false,
    deployable: true,
    previewNote:
      "Built and ready to insert. It asks the questions you define in Settings, Fields, and opens only for members with a required answer missing.",
  },
  // { id: "member_announcement_bar", name: "Announcement Bar", features: "F17", task: "7.4", previewReady: false, deployable: false },
];

export const DEFAULT_COMPONENT_ID: CanvasComponentId = "member_auth";

export function findComponent(id: CanvasComponentId): CanvasComponentEntry {
  const entry = CANVAS_COMPONENTS.find((component) => component.id === id);

  // The id type is a closed union over this very list, so a miss means the two
  // have drifted. Fail loudly rather than render a blank viewport.
  if (!entry) {
    throw new Error(`Unknown canvas component id: ${id}`);
  }

  return entry;
}
