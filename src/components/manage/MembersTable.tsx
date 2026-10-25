import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { Banner, Button, EmptyState, IconButton, Select, TextField } from "../ui";
import { cn } from "../../utils/cn";
import { MemberRow } from "./MemberRow";
import { MemberFlyout, type MemberAction } from "./MemberFlyout";
import {
  NO_MEMBER_FILTERS,
  STATUS_FILTERS,
  filterMembers,
  hasActiveFilters,
  memberCountLabel,
  pageCount,
  tierFilters,
  type MemberFilters,
  type StatusFilter,
  type TierFilter,
} from "./memberFilters";
import { MEMBER_PAGE_SIZE, type MemberPage, type SiteMemberRecord } from "../../types/site";
import { siteTiers } from "../../types/member";
import type { CustomFieldDefinition } from "../../utils/customFields";

export interface MembersTableProps {
  /** Null while loading, so the placeholder and the empty state stay distinct. */
  page: MemberPage | null;
  loading: boolean;
  /** A title and a sentence from `failureMessage`, or null. */
  failure: { title: string; message: string } | null;
  busyMemberId: string | null;
  onRetry: () => void;
  onChangePage: (page: number) => void;
  onFiltersChange: (filters: MemberFilters) => void;
  onMemberAction: (member: SiteMemberRecord, action: MemberAction) => void;
  /** Switches the Manage tab to Tiers. The empty state's one action. */
  onCreateFirstTier: () => void;
  /** FP-09. The site's profile field definitions, shown in each flyout. */
  profileFields?: ReadonlyArray<CustomFieldDefinition>;
  /** For each flyout's purchases list. */
  siteId?: string;
}

/**
 * The members table. PRD task 2.2, feature F02.
 *
 * Driven entirely by props. The backend does not exist (blocker B1) and no task
 * builds creator authentication (conflict C10), so `page` is null and `failure`
 * is set in practice today. Every one of the four states below is reachable by
 * passing props, so the API arriving is a wiring change rather than a UI change.
 *
 * Search is filtered twice on purpose. The real filter is server side, because
 * PRD section 10.3 paginates at 25 and the panel never holds the whole list.
 * `filterMembers` narrows the page already in hand so the rows respond to a
 * keystroke immediately, and the server's answer then replaces them.
 */
export const MembersTable: React.FC<MembersTableProps> = ({
  page,
  loading,
  failure,
  busyMemberId,
  onRetry,
  onChangePage,
  onFiltersChange,
  onMemberAction,
  onCreateFirstTier,
  profileFields = [],
  siteId,
}) => {
  const [filters, setFilters] = useState<MemberFilters>(NO_MEMBER_FILTERS);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  const patchFilters = (next: Partial<MemberFilters>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    onFiltersChange(merged);
  };

  const members = page?.members ?? [];
  const shown = useMemo(() => filterMembers(members, filters), [members, filters]);
  const totalPages = pageCount(page?.totalCount ?? 0, page?.pageSize ?? MEMBER_PAGE_SIZE);
  const currentPage = page?.page ?? 1;

  return (
    <div className="members-panel">
      <div className="members-toolbar">
        <div className="framefic-input-wrap fill has-leading-icon">
          <span className="framefic-input-icon">
            <Search aria-hidden={true} />
          </span>
          <TextField
            type="search"
            value={filters.query}
            placeholder="Search name or email"
            aria-label="Search members"
            onChange={(query) => patchFilters({ query })}
            fill
          />
        </div>

        <Select
          label="Filter by tier"
          value={filters.tier}
          options={tierFilters(siteTiers())}
          onChange={(tier) => patchFilters({ tier: tier as TierFilter })}
          compact
        />

        <Select
          label="Filter by status"
          value={filters.status}
          options={STATUS_FILTERS}
          onChange={(status) => patchFilters({ status: status as StatusFilter })}
          compact
        />
      </div>

      {failure ? (
        <Banner
          tone="danger"
          title={failure.title}
          message={failure.message}
          action={{ label: "Try again", onClick: onRetry }}
        />
      ) : null}

      {loading ? (
        /*
          Row-shaped placeholders, not a spinner. Three rows of the right height
          means the toolbar above does not jump when the real rows arrive.
        */
        <div className="members-list" aria-busy={true} aria-label="Loading members">
          {[0, 1, 2].map((index) => (
            <div key={index} className="member-row-skeleton" />
          ))}
        </div>
      ) : null}

      {!loading && !failure && shown.length === 0 ? (
        hasActiveFilters(filters) ? (
          <EmptyState
            icon={<Search aria-hidden={true} />}
            title="No Matching Members"
            description="No member matches those filters. Clear them to see everyone."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(NO_MEMBER_FILTERS);
                  onFiltersChange(NO_MEMBER_FILTERS);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          /*
            F02: "Empty member list renders .empty-state, never a blank area",
            and its one action is "Create your first tier". That is the right
            next step rather than a member action: a site with no tiers cannot
            have members, so there is nothing to invite them to yet.
          */
          <EmptyState
            icon={<Users aria-hidden={true} />}
            title="No Members Yet"
            description="Create a tier, then gate a frame. Members appear here as they join."
            action={
              <Button variant="secondary" onClick={onCreateFirstTier}>
                Create your first tier
              </Button>
            }
          />
        )
      ) : null}

      {!loading && shown.length > 0 ? (
        <>
          <p className="members-count">{memberCountLabel(shown.length, page?.totalCount ?? 0, filters)}</p>

          <div className="members-list">
            {shown.map((member) => (
              <React.Fragment key={member.id}>
                <MemberRow
                  member={member}
                  selected={openMemberId === member.id}
                  onSelect={(selected) =>
                    setOpenMemberId((current) => (current === selected.id ? null : selected.id))
                  }
                />
                {openMemberId === member.id ? (
                  <MemberFlyout
                    member={member}
                    busy={busyMemberId === member.id}
                    onAction={(action) => onMemberAction(member, action)}
                    onClose={() => setOpenMemberId(null)}
                    profileFields={profileFields}
                    siteId={siteId}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="members-pager">
              <IconButton
                label="Previous page"
                variant="secondary"
                disabled={currentPage <= 1}
                onClick={() => onChangePage(currentPage - 1)}
              >
                <ChevronLeft aria-hidden={true} />
              </IconButton>
              <span className="members-pager-label">
                {`Page ${currentPage} of ${totalPages}`}
              </span>
              <IconButton
                label="Next page"
                variant="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => onChangePage(currentPage + 1)}
              >
                <ChevronRight aria-hidden={true} />
              </IconButton>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
