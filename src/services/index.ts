export {
  CONFIG_START_MARKER,
  CONFIG_END_MARKER,
  CodeGenerationError,
  LOCK_STATE_SIGNATURE,
  MEMBER_AUTH_DESCRIPTOR,
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
  CanvasComponentDescriptor,
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
