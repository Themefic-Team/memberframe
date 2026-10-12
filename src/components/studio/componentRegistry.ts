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
  | "member_dashboard"
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
  { id: "member_gate", name: "Member Gate", features: "F01, F22", task: "1.7", previewReady: true, deployable: true },
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
  { id: "member_dashboard", name: "Member Dashboard", features: "F06", task: "5.1", previewReady: false, deployable: false },
  { id: "metered_paywall", name: "Metered Paywall", features: "F07, F08", task: "3.4", previewReady: false, deployable: false },
  { id: "cms_gated_template", name: "CMS Gated Template", features: "F09", task: "5.3", previewReady: false, deployable: false },
  { id: "protected_download", name: "Protected Download", features: "F10", task: "5.5", previewReady: false, deployable: false },
  { id: "course_progress", name: "Course Progress", features: "F11", task: "4.1", previewReady: false, deployable: false },
  { id: "lesson_checklist", name: "Lesson Checklist", features: "F11", task: "4.1", previewReady: false, deployable: false },
  { id: "video_progress_listener", name: "Video Progress Listener", features: "F11", task: "4.1", previewReady: false, deployable: false },
  { id: "donation_slider", name: "Donation Slider", features: "F13", task: "7.3", previewReady: false, deployable: false },
  { id: "member_directory", name: "Member Directory", features: "F15", task: "7.2", previewReady: false, deployable: false },
  { id: "bookmark_button", name: "Bookmark Button", features: "F14", task: "7.1", previewReady: false, deployable: false },
  { id: "bookmarks_tray", name: "Bookmarks Tray", features: "F14", task: "7.1", previewReady: false, deployable: false },
  { id: "onboarding_modal", name: "Onboarding Modal", features: "F16", task: "6.3", previewReady: false, deployable: false },
  { id: "member_announcement_bar", name: "Announcement Bar", features: "F17", task: "7.4", previewReady: false, deployable: false },
];

export const DEFAULT_COMPONENT_ID: CanvasComponentId = "member_gate";

export function findComponent(id: CanvasComponentId): CanvasComponentEntry {
  const entry = CANVAS_COMPONENTS.find((component) => component.id === id);

  // The id type is a closed union over this very list, so a miss means the two
  // have drifted. Fail loudly rather than render a blank viewport.
  if (!entry) {
    throw new Error(`Unknown canvas component id: ${id}`);
  }

  return entry;
}
