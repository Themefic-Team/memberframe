import React, { useCallback, useEffect, useState } from "react";
import { Segmented, useToast } from "../ui";
import { MembersTable } from "../manage/MembersTable";
import { TierEditor } from "../manage/TierEditor";
import type { MemberAction } from "../manage/MemberFlyout";
import { NO_MEMBER_FILTERS, type MemberFilters } from "../manage/memberFilters";
import type { TierFormDraft } from "../manage/tierValidation";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { failureMessage, type ApiFailure } from "../../services/apiClient";
import {
  createTier,
  fetchMembers,
  fetchTiers,
  patchMember,
  sendMagicLink,
  updateTier,
  type TierDraft,
} from "../../services/siteService";
import type { MemberPage, SiteMemberRecord, SiteTierRecord } from "../../types/site";
import { parseMinor } from "../../utils/money";

type Segment = "members" | "tiers";

const SEGMENTS = [
  { value: "members", label: "Members" },
  { value: "tiers", label: "Tiers" },
] as const satisfies ReadonlyArray<{ value: Segment; label: string }>;

/**
 * Fetches are keyed on this placeholder site id.
 *
 * `framer.getProjectInfo()` supplies the real one, and F02 says the creator is
 * "verified via `framer.getCurrentUser()` and `framer.getProjectInfo()`,
 * exchanged for a creator session token". No task in the plan builds that
 * exchange (conflict C10), so there is no token to pair a real site id with and
 * every call resolves `unauthorized` regardless of what is sent.
 *
 * Reading the project info here would therefore add an SDK call whose result
 * cannot be used, and would need a permission to do it. This is honest instead:
 * one named constant, in one place, for the task that builds creator sign-in to
 * replace.
 */
const PLACEHOLDER_SITE_ID = "unconfigured";

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
 */
export const ManageTab: React.FC = () => {
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

  const [reloadToken, setReloadToken] = useState(0);
  const showToast = useToast();

  /**
   * F02's first acceptance criterion: search is debounced at 300ms. The query
   * is debounced and the two dropdown filters are not, because a select changes
   * once per decision where typing changes once per character.
   */
  const debouncedQuery = useDebouncedValue(filters.query);

  useEffect(() => {
    let active = true;
    setMembersLoading(true);

    void fetchMembers({
      siteId: PLACEHOLDER_SITE_ID,
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
  }, [debouncedQuery, filters.tier, filters.status, page, reloadToken]);

  useEffect(() => {
    let active = true;
    setTiersLoading(true);

    void fetchTiers(PLACEHOLDER_SITE_ID).then((result) => {
      if (!active) return;

      if (result.kind === "ok") {
        setTiers(result.data.tiers);
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
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const handleFiltersChange = useCallback((next: MemberFilters) => {
    setFilters(next);
    // A filter change invalidates the page number: page 3 of an unfiltered list
    // is usually past the end of a filtered one, which renders as empty.
    setPageNumber(1);
  }, []);

  const handleMemberAction = useCallback(
    async (member: SiteMemberRecord, action: MemberAction) => {
      setBusyMemberId(member.id);

      const result = await runMemberAction(member, action);

      setBusyMemberId(null);

      if (result.kind === "ok") {
        // Every string here is under the kit's 45 character toast limit, which
        // F02 also requires of a confirmation.
        showToast({ tone: "success", message: toastForAction(action) });
        reload();
        return;
      }

      const { message } = failureMessage(result);
      showToast({ tone: "error", message: shorten(message) });
    },
    [reload, showToast]
  );

  const handleSaveTier = useCallback(
    async (draft: TierFormDraft) => {
      setSavingTier(true);

      const wire = toTierDraft(draft);
      const result =
        draft.id === null
          ? await createTier(PLACEHOLDER_SITE_ID, wire)
          : await updateTier(draft.id, wire);

      setSavingTier(false);

      if (result.kind === "ok") {
        showToast({
          tone: "success",
          message: draft.id === null ? "Tier created" : "Tier saved",
        });
        reload();
        return;
      }

      const { message } = failureMessage(result);
      showToast({ tone: "error", message: shorten(message) });
    },
    [reload, showToast]
  );

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
        />
      ) : (
        <TierEditor
          tiers={tiers}
          loading={tiersLoading}
          saving={savingTier}
          failure={tierFailure ? failureMessage(tierFailure) : null}
          onRetry={reload}
          onSave={(draft) => void handleSaveTier(draft)}
        />
      )}
    </div>
  );
};

/**
 * One endpoint for three of the four actions.
 *
 * PRD section 10.3 has `PATCH /api/site/members/:id` for "change tier, grant,
 * or revoke" and no separate grant or revoke route, so Grant VIP is a tier
 * change with a fixed argument and Revoke is a status change.
 */
function runMemberAction(member: SiteMemberRecord, action: MemberAction) {
  switch (action.kind) {
    case "change_tier":
      return patchMember(member.id, { tier: action.tier });
    case "grant_vip":
      return patchMember(member.id, { tier: "vip" });
    case "revoke":
      return patchMember(member.id, { status: "canceled" });
    case "magic_link":
      return sendMagicLink(member.id);
  }
}

/** Confirmation copy, all of it inside the 45 character toast limit. */
function toastForAction(action: MemberAction): string {
  switch (action.kind) {
    case "change_tier":
      return "Tier updated";
    case "grant_vip":
      return "VIP access granted";
    case "revoke":
      return "Access revoked";
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
function toTierDraft(draft: TierFormDraft): TierDraft {
  const price = (value: string): number | null => {
    const parsed = parseMinor(value);
    return parsed.ok ? parsed.minor : null;
  };

  return {
    key: draft.key,
    name: draft.name.trim(),
    monthlyPriceMinor: price(draft.monthlyPrice),
    annualPriceMinor: price(draft.annualPrice),
    lifetimePriceMinor: price(draft.lifetimePrice),
    currency: draft.currency,
    rank: Number.parseInt(draft.rank, 10),
    isActive: draft.isActive,
  };
}
