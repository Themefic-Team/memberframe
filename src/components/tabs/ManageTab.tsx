import React, { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { EmptyState, Segmented, useToast } from "../ui";
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
import { useConnection } from "../../hooks/useConnection";

type Segment = "members" | "tiers";

const SEGMENTS = [
  { value: "members", label: "Members" },
  { value: "tiers", label: "Tiers" },
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
 * The Connect tab builds it, so this reads the connected site and the member
 * list it renders is the one visitors have actually registered into.
 *
 * An unconnected panel renders an empty state rather than an error. A creator
 * who has not connected has done nothing wrong, and a failure banner would send
 * them looking for a problem that is not there.
 */
export const ManageTab: React.FC = () => {
  const { connection } = useConnection();
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

      const { message } = failureMessage(result);
      showToast({ tone: "error", message: shorten(message) });
    },
    [reload, showToast, siteId]
  );

  const handleSaveTier = useCallback(
    async (draft: TierFormDraft) => {
      setSavingTier(true);

      if (!siteId) return;

      const wire = toTierDraft(draft);
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
        return;
      }

      const { message } = failureMessage(result);
      showToast({ tone: "error", message: shorten(message) });
    },
    [reload, showToast, siteId]
  );

  if (!siteId) {
    return (
      <div className="tab-panel-body">
        <EmptyState
          icon={<Link2 aria-hidden={true} />}
          title="Connect this project first"
          description="Members and tiers are stored against a connected Framer project. Open the Connect tab to link one."
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
function runMemberAction(member: SiteMemberRecord, action: MemberAction, siteId: string) {
  switch (action.kind) {
    case "change_tier":
      return patchMember(member.id, { siteId, tier: action.tier });
    case "grant_vip":
      return patchMember(member.id, { siteId, tier: "vip" });
    case "revoke":
      return patchMember(member.id, { siteId, status: "canceled" });
    case "magic_link":
      return sendMagicLink(member.id, siteId);
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
