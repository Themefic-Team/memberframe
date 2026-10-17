export {
  CONFIG_START_MARKER,
  CONFIG_END_MARKER,
  CodeGenerationError,
  LOCK_STATE_SIGNATURE,
  DISCONNECTED_DEPLOY_CONTEXT,
  MEMBER_DASHBOARD_DESCRIPTOR,
  MEMBER_DASHBOARD_FILE_NAME,
  generateMemberDashboardCode,
  normalizeDashboardConfig,
  MEMBER_PRICING_DESCRIPTOR,
  MEMBER_PRICING_FILE_NAME,
  generateMemberPricingCode,
  normalizePricingConfig,
  ONBOARDING_MODAL_DESCRIPTOR,
  ONBOARDING_MODAL_FILE_NAME,
  generateOnboardingModalCode,
  normalizeOnboardingConfig,
  METERED_PAYWALL_DESCRIPTOR,
  PROTECTED_DOWNLOAD_DESCRIPTOR,
  BOOKMARK_BUTTON_DESCRIPTOR,
  BOOKMARKS_TRAY_DESCRIPTOR,
  generateMeteredPaywallCode,
  generateProtectedDownloadCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  MEMBER_AUTH_DESCRIPTOR,
  AUTH_SCREEN_DEFAULTS,
  AUTH_SCREEN_DESCRIPTORS,
  generateAuthScreenCode,
  MEMBER_AUTH_FILE_NAME,
  MEMBER_GATE_DESCRIPTOR,
  MEMBER_GATE_FILE_NAME,
  buildConfigBlock,
  generateComponentCode,
  generateMemberAuthCode,
  generateMemberGateCode,
  isSafeCssColor,
  normalizeAuthConfig,
  normalizeGateConfig,
} from "./canvasComponentCodeGenerator";
export type {
  AuthScreenComponentId,
  CanvasComponentDescriptor,
  DeployContext,
  GeneratedCanvasFile,
} from "./canvasComponentCodeGenerator";

export {
  ApiClient,
  DEFAULT_TIMEOUT_MS,
  apiClient,
  buildQuery,
  failureMessage,
  parseRetryAfter,
} from "./apiClient";
export type { ApiClientDeps, ApiFailure, ApiResult, QueryValue } from "./apiClient";

export {
  createTier,
  fetchGatewayStatus,
  fetchMembers,
  fetchTiers,
  patchMember,
  saveGatewayConfig,
  sendMagicLink,
  updateTier,
  validateGatewayKey,
} from "./siteService";
export type {
  GatewayValidation,
  MemberPatch,
  MemberQuery,
  TierDraft,
} from "./siteService";

export {
  checkoutErrorMessage,
  createCheckoutSession,
  isAcceptableCheckoutUrl,
} from "./checkoutService";
export type { CheckoutOutcome, CheckoutRequest, CheckoutSession } from "./checkoutService";

export {
  SCAFFOLD_METHODS,
  membershipPages,
  normalizePagePath,
  scaffoldMembershipPages,
  scaffoldSummary,
} from "./pageScaffoldService";
export type {
  MembershipPageSpec,
  PageResult,
  ScaffoldComponent,
  ScaffoldDeps,
  ScaffoldFailure,
  ScaffoldOutcome,
  ScaffoldSuccess,
} from "./pageScaffoldService";

export { REPARENT_METHOD, WRITE_METHODS, deployCanvasComponent } from "./framerCanvasService";
export type {
  CanvasCodeFile,
  CanvasCodeFileExport,
  CanvasDeps,
  CanvasNode,
  DeployFailure,
  DeployFailureReason,
  DeployOptions,
  DeployOutcome,
  DeploySuccess,
} from "./framerCanvasService";

export {
  DEFAULT_FALLBACK_PAGES,
  formatWebPagePath,
  getFramerProjectPages,
} from "./framerPagesService";
export type { FramerProjectPage } from "./framerPagesService";
