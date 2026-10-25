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
  METERED_PAYWALL_DESCRIPTOR,
  PROTECTED_DOWNLOAD_DESCRIPTOR,
  BOOKMARK_BUTTON_DESCRIPTOR,
  BOOKMARKS_TRAY_DESCRIPTOR,
  generateMeteredPaywallCode,
  METERED_PAYWALL_FILE_NAME,
  generateProtectedDownloadCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  MEMBER_AUTH_DESCRIPTOR,
  AUTH_SCREEN_DEFAULTS,
  AUTH_SCREEN_DESCRIPTORS,
  generateAuthScreenCode,
  MEMBER_AUTH_FILE_NAME,
  buildConfigBlock,
  generateComponentCode,
  generateMemberAuthCode,
  isSafeCssColor,
  normalizeAuthConfig,
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
  deleteMember,
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
  BREAKPOINT_RETRY_DELAYS_MS,
  SCAFFOLD_COMPONENT_SPACING,
  SCAFFOLD_COMPONENT_SPACING_BELOW_HEADER,
  applyPageChrome,
  findPageChrome,
  heightWithMargin,
  pickPageChrome,
  SCAFFOLD_METHODS,
  findPageContentParent,
  membershipPages,
  normalizePagePath,
  scaffoldMembershipPages,
  scaffoldSummary,
} from "./pageScaffoldService";
export type {
  BreakpointDeps,
  MembershipPageSpec,
  PageChildNode,
  PageChrome,
  PageChromeDeps,
  ChromeNode,
  ChromeBreakpoint,
  PageContentParent,
  PageResult,
  ScaffoldComponent,
  ScaffoldDeps,
  ScaffoldFailure,
  ScaffoldOutcome,
  ScaffoldSuccess,
} from "./pageScaffoldService";

export { REPARENT_METHOD, WRITE_METHODS, deployCanvasComponent, writeCodeFile } from "./framerCanvasService";
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
  WriteCodeFileOutcome,
} from "./framerCanvasService";

export {
  DEFAULT_FALLBACK_PAGES,
  formatWebPagePath,
  getFramerProjectPages,
  isCmsItemPath,
  pageOptionLabel,
  sortPagesByPath,
} from "./framerPagesService";
export type { FramerProjectPage } from "./framerPagesService";


export {
  MAX_SECTION_LOCKS,
  LEGACY_SECTION_LOCKS_FILE_NAME,
  SECTION_LOCKS_FILE_NAME,
  SECTION_LOCK_NAME_PATTERN,
  newSectionLock,
  normalizeSectionLockName,
  parseWhoSees,
  sectionLockNameProblem,
  sectionLockOverrideNames,
  sectionLockSlug,
  sectionLocksCode,
  sectionLocksFilesToWrite,
  whoSeesOptions,
  whoSeesValue,
} from "./sectionLocks";
export type { SectionLockTier, WhoSeesOption } from "./sectionLocks";

export { ARTICLE_TAG_FILE_NAME, GATED_BODY_CLASS, LINKED_ARTICLE_CLASS, articleTagCode } from "./articleTag";
