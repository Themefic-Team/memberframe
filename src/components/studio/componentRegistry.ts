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
  /** Where it usually goes, shown as a badge: a page path or a place. */
  placement?: string;
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
      "Sign in, sign up, password reset, and email code in one form. Visitors switch between them in place.",
    placement: "Login page",
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
      "A sign in form. Links to your sign up and reset pages.",
    placement: "/login",
  },
  {
    id: "member_register",
    name: "Member Registration",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "A sign up form for new members. Links back to sign in.",
    placement: "/signup",
  },
  {
    id: "member_password_reset",
    name: "Password Reset",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Asks for an email, then sets a new password from the emailed link.",
    placement: "/reset-password",
  },
  {
    id: "member_otp_verify",
    name: "OTP Verification",
    features: "F05",
    task: "2.5",
    previewReady: false,
    deployable: true,
    previewNote:
      "Passwordless sign in with a six digit code sent by email.",
    placement: "Login page",
  },
 
  {
    id: "member_dashboard",
    name: "Member Dashboard",
    features: "F06",
    task: "5.1",
    previewReady: false,
    deployable: true,
    previewNote:
      "A member's account: profile, plan, billing, and sign out.",
    placement: "/dashboard",
  },
  {
    id: "member_pricing",
    name: "Member Pricing",
    features: "F03, FP-16",
    task: "FP-16",
    previewReady: false,
    deployable: true,
    previewNote:
      "Your tiers and prices from Manage, Tiers. Each button starts a checkout.",
    placement: "/pricing",
  },
  {
    id: "metered_paywall",
    name: "Soft Paywall",
    features: "F07, F08",
    task: "3.4",
    previewReady: false,
    deployable: true,
    previewNote:
      "Free articles each week or month, or a Read more teaser. On a CMS post, give the post body the PaywallArticle override.",
    placement: "Articles and posts",
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
      "A download button for a file in Manage, Files. Only the plan you choose can download it.",
    placement: "Any page",
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
      "Lets members save a page or a CMS item. On a CMS card, bind Item Slug.",
    placement: "Cards and pages",
  },
  {
    id: "bookmarks_tray",
    name: "Bookmarks Tray",
    features: "F14",
    task: "7.1",
    previewReady: false,
    deployable: true,
    previewNote:
      "A saved items button that opens a drawer of everything a member saved.",
    placement: "Navigation bar",
  },
  {
    id: "onboarding_modal",
    name: "Onboarding Modal",
    features: "F16",
    task: "6.3",
    previewReady: false,
    deployable: true,
    previewNote:
      "Asks the questions from Settings, Fields, only while a required answer is missing.",
    placement: "Dashboard",
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
