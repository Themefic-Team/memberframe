import React, { useState } from "react";
import { Search, UserPlus, MoreHorizontal, X, Check } from "lucide-react";
import "./MembersTab.css";

export interface Member {
  id: string;
  email: string;
  name: string;
  tier: string;
  status: "active" | "past_due" | "canceled";
  joinedDate: string;
}

const DEFAULT_MEMBERS: Member[] = [
  {
    id: "mem_1",
    email: "sarah@designagency.io",
    name: "Sarah Miller",
    tier: "Silver Tier",
    status: "active",
    joinedDate: "Oct 04, 2026",
  },
  {
    id: "mem_2",
    email: "alex@creatorhub.co",
    name: "Alex Vance",
    tier: "Gold VIP",
    status: "active",
    joinedDate: "Oct 01, 2026",
  },
  {
    id: "mem_3",
    email: "michael@framersite.dev",
    name: "Michael Chen",
    tier: "Free Member",
    status: "active",
    joinedDate: "Sep 28, 2026",
  },
  {
    id: "mem_4",
    email: "priya@studioflow.in",
    name: "Priya Sharma",
    tier: "Silver Tier",
    status: "past_due",
    joinedDate: "Sep 15, 2026",
  },
];

export const MembersTab: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem("memberframe_members");
    return saved ? JSON.parse(saved) : DEFAULT_MEMBERS;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState("Silver Tier");

  const saveMembers = (newMembers: Member[]) => {
    setMembers(newMembers);
    localStorage.setItem("memberframe_members", JSON.stringify(newMembers));
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "all") return matchesSearch;
    return matchesSearch && member.status === activeFilter;
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const newMem: Member = {
      id: `mem_${Date.now()}`,
      email: newEmail.trim(),
      name: newName.trim() || newEmail.split("@")[0],
      tier: newTier,
      status: "active",
      joinedDate: "Today",
    };

    saveMembers([newMem, ...members]);
    setIsAddModalOpen(false);
    setNewEmail("");
    setNewName("");
  };

  const handleUpdateStatus = (
    memberId: string,
    newStatus: "active" | "past_due" | "canceled"
  ) => {
    saveMembers(
      members.map((m) => (m.id === memberId ? { ...m, status: newStatus } : m))
    );
    setSelectedMember(null);
  };

  const handleUpgradeTier = (memberId: string, targetTier: string) => {
    saveMembers(
      members.map((m) => (m.id === memberId ? { ...m, tier: targetTier } : m))
    );
    setSelectedMember(null);
  };

  return (
    <div className="members-tab-container">
      {/* Header Row */}
      <div className="tab-header-row">
        <div className="tab-title-group">
          <h2 className="tab-main-title">Subscriber Roster</h2>
          <p className="tab-subtitle">
            Manage site members and subscription status.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus size={13} stroke="currentColor" />
          <span>Add Member</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="members-controls">
        <div className="search-input-wrap">
          <div className="search-icon-tile">
            <Search size={14} stroke="currentColor" />
          </div>
          <input
            type="text"
            className="input-text search-input"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills-row">
          <button
            type="button"
            className={`filter-pill ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All ({members.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === "active" ? "active" : ""}`}
            onClick={() => setActiveFilter("active")}
          >
            Active ({members.filter((m) => m.status === "active").length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === "past_due" ? "active" : ""}`}
            onClick={() => setActiveFilter("past_due")}
          >
            Past Due ({members.filter((m) => m.status === "past_due").length})
          </button>
          <button
            type="button"
            className={`filter-pill ${activeFilter === "canceled" ? "active" : ""}`}
            onClick={() => setActiveFilter("canceled")}
          >
            Canceled ({members.filter((m) => m.status === "canceled").length})
          </button>
        </div>
      </div>

      {/* Member Rows */}
      <div className="members-list">
        {filteredMembers.length === 0 ? (
          <div className="empty-state-card">
            <h3 className="empty-state-title">No members found</h3>
            <p className="empty-state-desc">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div key={member.id} className="member-row">
              <div className="member-info">
                <div className="member-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="member-meta">
                  <span className="member-email" title={member.email}>
                    {member.name}
                  </span>
                  <span className="member-subtext">{member.email}</span>
                </div>
              </div>

              <div className="member-badges-wrap">
                <span
                  className={`badge ${
                    member.status === "active"
                      ? "badge-success"
                      : member.status === "past_due"
                      ? "badge-warning"
                      : "badge-neutral"
                  }`}
                >
                  {member.status === "active"
                    ? "Active"
                    : member.status === "past_due"
                    ? "Past Due"
                    : "Canceled"}
                </span>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedMember(member)}
                  aria-label="Member options"
                >
                  <MoreHorizontal size={14} stroke="currentColor" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Member Action Flyout / Modal */}
      {selectedMember && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="modal-title">{selectedMember.name}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedMember(null)}
                aria-label="Close"
              >
                <X size={14} stroke="currentColor" />
              </button>
            </div>

            <div className="modal-body">
              <div className="field-row">
                <span className="field-row-label">Current Tier</span>
                <span className="badge badge-brand">{selectedMember.tier}</span>
              </div>
              <div className="field-row">
                <span className="field-row-label">Joined On</span>
                <span className="field-row-label">
                  {selectedMember.joinedDate}
                </span>
              </div>

              <div className="field-rows">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    handleUpgradeTier(selectedMember.id, "Gold VIP")
                  }
                >
                  <Check size={12} stroke="currentColor" />
                  <span>Grant Gold VIP Access</span>
                </button>

                {selectedMember.status === "active" ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      handleUpdateStatus(selectedMember.id, "canceled")
                    }
                  >
                    <span>Cancel Subscription</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      handleUpdateStatus(selectedMember.id, "active")
                    }
                  >
                    <span>Reactivate Subscription</span>
                  </button>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedMember(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="modal-title">Add Manual Subscriber</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close"
              >
                <X size={14} stroke="currentColor" />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="field-row">
                  <label htmlFor="mem-name" className="field-row-label">
                    Full Name
                  </label>
                  <div className="field-row-control">
                    <input
                      id="mem-name"
                      type="text"
                      className="input-text"
                      placeholder="e.g. Alex Vance"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="mem-email" className="field-row-label">
                    Email Address
                  </label>
                  <div className="field-row-control">
                    <input
                      id="mem-email"
                      type="email"
                      className="input-text"
                      placeholder="alex@domain.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="mem-tier" className="field-row-label">
                    Assign Tier
                  </label>
                  <div className="field-row-control">
                    <select
                      id="mem-tier"
                      className="input-select"
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value)}
                    >
                      <option value="Free Member">Free Member</option>
                      <option value="Silver Tier">Silver Tier</option>
                      <option value="Gold VIP">Gold VIP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-cta btn-sm">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
