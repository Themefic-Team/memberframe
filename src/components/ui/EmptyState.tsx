import React from "react";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Exactly one next step, per PRD section 7.5. An empty state with no way out is a dead end. */
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="framefic-empty-state">
    <span className="empty-state-icon-tile">{icon}</span>
    <p className="empty-state-title">{title}</p>
    <p className="empty-state-desc">{description}</p>
    {action ? <div className="empty-state-action">{action}</div> : null}
  </div>
);
