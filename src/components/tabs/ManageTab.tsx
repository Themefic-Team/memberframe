import React from "react";
import { Users } from "lucide-react";
import { EmptyState } from "../ui";

/**
 * Placeholder. The Members table and the Tiers editor land here in PRD tasks
 * 2.2 and 2.3, swapped by a segmented control rather than split into two tabs,
 * per the resolved decision in PRD section 7.3.
 */
export const ManageTab: React.FC = () => (
  <EmptyState
    icon={<Users aria-hidden={true} />}
    title="Manage"
    description="Members and tiers appear here once a gateway is connected."
  />
);
