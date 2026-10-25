import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { EmptyState, Segmented, useToast } from "../ui";
import { MembersTable } from "../manage/MembersTable";
import { TierEditor } from "../manage/TierEditor";
import { PaymentsPanel } from "../manage/PaymentsPanel";
import type { MemberAction } from "../manage/MemberFlyout";
import { NO_MEMBER_FILTERS, type MemberFilters } from "../manage/memberFilters";
import { FREE_TIER_RANK, type TierFormDraft } from "../manage/tierValidation";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { failureMessage, type ApiFailure } from "../../services/apiClient";
import {
  createTier,
  deleteTier,
  fetchMembers,
  fetchTiers,
  deleteMember,
  patchMember,
  sendMagicLink,
  revokeMember,
  restoreMember,
  updateTier,
  type TierDraft,
} from "../../services/siteService";
import type { MemberPage, SiteMemberRecord, SiteTierRecord } from "../../types/site";
import { parseMinor } from "../../utils/money";
import { currencyExponent, type CurrencyCode } from "../../utils/currencies";
import { fetchPayments } from "../../services/paymentsService";
import { useConnection } from "../../hooks/useConnection";
import { readDefinitions } from "../../utils/customFields";
import { rememberSiteTiers } from "../../types/member";
import { resolvedTierKey } from "../manage/tierValidation";

type Segment = "members" | "tiers" | "payments";

/**
 * Payments sits beside Tiers, FP-16 section 9.4: a tier's prices only sell
 * once a gateway is connected, so the two are one job and one tab. Protected
 * Download files are uploaded on the canvas and set up there
 * (32-canvas-downloads.md), so there is no Files segment.
 */
const SEGMENTS = [
  { value: "members", label: "Members" },
  { value: "tiers", label: "Tiers" },
  { value: "payments", label: "Payments" },
] as const satisfies ReadonlyArray<{ value: Segment; label: string }>;

/**
 * The Manage tab. PRD tasks 2.2 and 2.3, feature F02, layout in section 7.3.
 *
 * Members and Tiers share a segmented control rather than two tabs. That is
 * resolved conflict 3 in PRD section 17: the shell standard permits four tabs,
 * the two surfaces share a data domain and the same backend calls, and five
 * tabs is cramped at 360px.
 *
 * This component owns the data and the toasts. The two child surfaces are prop
 * driven and own neither, so both are reachable in every state by passing
 * props, and the logic inside them is pure and unit tested.
 *
 * ## The site id is real now
 *
 * It used to be a named placeholder, because conflict C10 meant no task built
 * creator sign-in and every call resolved `unauthorized` whatever was sent.
 * The Connect view (Account icon) builds it, so this reads the connected site and the member
 * list it renders is the one visitors have actually registered into.
 *
 * An unconnected panel renders an empty state rather than an error. A creator
 * who has not connected has done nothing wrong, and a failure banner would send
 * them looking for a problem that is not there.
 */
export const ManageTab: React.FC = () => {
  const { connection, settings } = useConnection();

  // FP-09. The definitions say which values a member's flyout shows and how
  // each is labelled; the values themselves arrive on each member record.
  const profileFields = useMemo(() => readDefinitions(settings?.customFields), [settings]);
  const siteId = connection?.siteId ?? null;

  const [segment, setSegment] = useState<Segment>("members");
  const [filters, setFilters] = useState<MemberFilters>(NO_MEMBER_FILTERS);
  const [page, setPageNumber] = useState(1);

  const [memberPage, setMemberPage] = useState<MemberPage | null>(null);
  const [memberFailure, setMemberFailure] = useState<ApiFailure | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const [tiers, setTiers] = useState<ReadonlyArray<SiteTierRecord>>([]);
  const [tierFailure, setTierFailure] = useState<ApiFailure | null>(null);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [savingTier, setSavingTier] = useState(false);
  /** The site currency from Payments: every tier is priced in it (23-dynamic-tiers.md). */
  const [siteCurrency, setSiteCurrency] = useState<CurrencyCode>("USD");

  const [reloadToken, setReloadToken] = useState(0);
  const showToast = useToast();

  /**
   * F02's first acceptance criterion: search is debounced at 300ms. The query
   * is debounced and the two dropdown filters are not, because a select changes
   * once per decision where typing changes once per character.
   */
  const debouncedQuery = useDebouncedValue(filters.query);

  useEffect(() => {
    if (!siteId) {
      setMemberPage(null);
      setMemberFailure(null);
      setMembersLoading(false);
      return;
    }

    let active = true;
    setMembersLoading(true);

    void fetchMembers({
      siteId,
      page,
      search: debouncedQuery.trim() === "" ? undefined : debouncedQuery.trim(),
      tier: filters.tier === "all" ? undefined : filters.tier,
      status: filters.status === "all" ? undefined : filters.status,
    }).then((result) => {
      if (!active) return;

      if (result.kind === "ok") {
        setMemberPage(result.data);
        setMemberFailure(null);
      } else {
        setMemberPage(null);
        setMemberFailure(result);
      }

      setMembersLoading(false);
    });

    return () => {
      active = false;
    };
  }, [debouncedQuery, filters.tier, filters.status, page, reloadToken, siteId]);

  useEffect(() => {
    if (!siteId) {
      setTiers([]);
      setTierFailure(null);
      setTiersLoading(false);
      return;
    }

    let active = true;
    setTiersLoading(true);

    void fetchTiers(siteId).then((result) => {
      if (!active) return;

      if (result.kind === "ok") {
        setTiers(result.data.tiers);
        // Every picker and label in the panel names the site's real tiers.
        rememberSiteTiers(result.data.tiers);
        setTierFailure(null);
      } else {
        setTiers([]);
        setTierFailure(result);
      }

      setTiersLoading(false);
    });

    return () => {
      active = false;
    };
  }, [reloadToken, siteId]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    void fetchPayments(siteId).then((result) => {
      if (active && result.kind === "ok" && result.data.settings.defaultCurrency) {
        setSiteCurrency(result.data.settings.defaultCurrency);
      }
    });
    return () => {
      active = false;
    };
  }, [reloadToken, siteId, segment]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const handleFiltersChange = useCallback((next: MemberFilters) => {
    setFilters(next);
    // A filter change invalidates the page number: page 3 of an unfiltered list
    // is usually past the end of a filtered one, which renders as empty.
    setPageNumber(1);
  }, []);

  const handleMemberAction = useCallback(
    async (member: SiteMemberRecord, action: MemberAction) => {
      if (!siteId) return;

      setBusyMemberId(member.id);

      const result = await runMemberAction(member, action, siteId);

      setBusyMemberId(null);

      if (result.kind === "ok") {
        // Every string here is under the kit's 45 character toast limit, which
        // F02 also requires of a confirmation.
        showToast({ tone: "success", message: toastForAction(action) });
        reload();
        return;
      }

      // A message the server wrote for the creator (doc 26: "Publish the site,
      // or add its domain.") beats the generic copy for its status.
      const message = result.kind === "unavailable" && result.message ? result.message : failureMessage(result).message;
      showToast({ tone: "error", message: shorten(message) });
    },
    [reload, showToast, siteId]
  );

  /** True when saved, so the editor can close the card; false keeps it open. */
  const handleSaveTier = useCallback(
    async (draft: TierFormDraft): Promise<boolean> => {
      if (!siteId) return false;
      setSavingTier(true);

      const wire = toTierDraft(draft, tiers, siteCurrency);
      const result =
        draft.id === null
          ? await createTier(siteId, wire)
          : await updateTier(draft.id, { ...wire, siteId });

      setSavingTier(false);

      if (result.kind === "ok") {
        showToast({
          tone: "success",
          message: draft.id === null ? "Tier created" : "Tier saved",
        });
        reload();
        return true;
      }

      const reason = result.kind === "unavailable" ? result.reason : undefined;
      const message = (reason && TIER_SAVE_REASONS[reason]) || failureMessage(result).message;
      showToast({ tone: "error", message: shorten(message) });
      return false;
    },
    [reload, showToast, siteCurrency, siteId, tiers]
  );

  const handleDeleteTier = useCallback(
    async (tier: SiteTierRecord): Promise<boolean> => {
      if (!siteId) return false;
      setSavingTier(true);
      const result = await deleteTier(tier.id, siteId);
      setSavingTier(false);

      if (result.kind === "ok") {
        showToast({ tone: "success", message: "Tier deleted" });
        reload();
        return true;
      }

      const reason = result.kind === "unavailable" ? result.reason : undefined;
      const message = (reason && TIER_SAVE_REASONS[reason]) || failureMessage(result).message;
      showToast({ tone: "error", message: shorten(message) });
      return false;
    },
    [reload, showToast, siteId]
  );

  if (!siteId) {
    return (
      <div className="tab-panel-body">
        <EmptyState
          icon={<Link2 aria-hidden={true} />}
          title="Connect this project first"
          description="Members and tiers are stored against a connected Framer project. Open Account, top right, to link one."
        />
      </div>
    );
  }

  return (
    <div className="tab-panel-body">
      <Segmented
        label="Manage view"
        options={SEGMENTS}
        value={segment}
        onChange={setSegment}
      />

      {segment === "members" ? (
        <MembersTable
          page={memberPage}
          loading={membersLoading}
          failure={memberFailure ? failureMessage(memberFailure) : null}
          busyMemberId={busyMemberId}
          onRetry={reload}
          onChangePage={setPageNumber}
          onFiltersChange={handleFiltersChange}
          onMemberAction={(member, action) => void handleMemberAction(member, action)}
          onCreateFirstTier={() => setSegment("tiers")}
          profileFields={profileFields}
          siteId={siteId ?? undefined}
        />
      ) : segment === "payments" ? (
        <PaymentsPanel siteId={siteId} />
      ) : (
        <TierEditor
          tiers={tiers}
          currency={siteCurrency}
          loading={tiersLoading}
          saving={savingTier}
          failure={tierFailure ? failureMessage(tierFailure) : null}
          onRetry={reload}
          onSave={handleSaveTier}
          onDelete={handleDeleteTier}
        />
      )}
    </div>
  );
};

/**
 * One endpoint per kind of change.
 *
 * Tier changes use PRD section 10.3's `PATCH /api/site/members/:id`. Revoke,
 * restore, and the magic link have their own routes (doc 26), because revoke
 * also cancels the member's subscription at the payment provider. Delete
 * removes the member and has its own route.
 */
function runMemberAction(member: SiteMemberRecord, action: MemberAction, siteId: string) {
  switch (action.kind) {
    case "change_tier":
      return patchMember(member.id, { siteId, tier: action.tier });
    case "revoke":
      return revokeMember(member.id, siteId);
    case "restore":
      return restoreMember(member.id, siteId);
    case "delete":
      return deleteMember(member.id, siteId);
    case "magic_link":
      return sendMagicLink(member.id, siteId);
  }
}

/** Confirmation copy, all of it inside the 45 character toast limit. */
function toastForAction(action: MemberAction): string {
  switch (action.kind) {
    case "change_tier":
      return "Tier updated";
    case "revoke":
      return "Access revoked";
    case "restore":
      return "Access restored";
    case "delete":
      return "Member deleted";
    case "magic_link":
      return "Magic link sent";
  }
}

/**
 * Keep a toast inside the kit's limit.
 *
 * `failureMessage` writes a full sentence for a banner, which is the right
 * length there and too long here. Truncating is better than a second set of
 * strings that can drift from the first, and the banner path still shows the
 * whole sentence.
 */
function shorten(message: string, limit = 45): string {
  if (message.length <= limit) return message;
  return `${message.slice(0, limit - 1).trimEnd()}.`;
}

/**
 * Form strings to wire values.
 *
 * Prices go through `parseMinor`, which never touches a float: PRD section 11.2
 * stores money as integer minor units because "floating point currency produces
 * rounding errors". A blank price is null, meaning the tier is not sold on that
 * interval, which is different from zero.
 */
function toTierDraft(draft: TierFormDraft, tiers: ReadonlyArray<SiteTierRecord>, currency: CurrencyCode): TierDraft {
  const price = (value: string): number | null => {
    const parsed = parseMinor(value, currencyExponent(currency));
    return parsed.ok && parsed.minor > 0 ? parsed.minor : null;
  };
  // The Free tier is rank 0 and has no prices; the server holds the same rule.
  const free = draft.kind === "free";

  return {
    key: resolvedTierKey(draft, tiers),
    name: draft.name.trim(),
    monthlyPriceMinor: free ? null : price(draft.monthlyPrice),
    annualPriceMinor: free ? null : price(draft.annualPrice),
    lifetimePriceMinor: free ? null : price(draft.lifetimePrice),
    rank: free ? FREE_TIER_RANK : Number.parseInt(draft.rank, 10),
    isActive: draft.isActive,
    features: draft.features.map((feature) => ({ text: feature.text.trim(), included: feature.included })),
  };
}

/** The server's tier refusals, in words a creator can act on. */
const TIER_SAVE_REASONS: Record<string, string> = {
  tier_key_taken: "Another tier has this ID. Change the name.",
  tier_rank_taken: "Another tier has this level.",
  free_tier_exists: "This site already has its Free tier.",
  free_tier_is_fixed: "The Free tier stays free.",
  free_tier_has_no_prices: "The Free tier has no prices.",
  paid_tier_needs_a_price: "Set at least one price.",
  tier_in_use: "Members are on this tier. Hide it instead.",
  tier_not_found: "That tier is already gone.",
};
