import React, { useState } from "react";
import { Plus, Crown, Tag, Trash2, X } from "lucide-react";
import "./TiersTab.css";

export interface MembershipTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  tag: string;
  description: string;
  isPopular?: boolean;
}

const DEFAULT_TIERS: MembershipTier[] = [
  {
    id: "tier_free",
    name: "Free Member",
    priceMonthly: 0,
    priceAnnual: 0,
    tag: "free",
    description: "Access to community discussions and public tutorials.",
  },
  {
    id: "tier_silver",
    name: "Silver Tier",
    priceMonthly: 10,
    priceAnnual: 99,
    tag: "silver",
    description: "Unlocks regular premium articles, downloads, and lesson tracks.",
    isPopular: true,
  },
  {
    id: "tier_gold",
    name: "Gold VIP",
    priceMonthly: 25,
    priceAnnual: 240,
    tag: "gold",
    description: "Full access to all video courses, private community, and source code.",
  },
];

export const TiersTab: React.FC = () => {
  const [tiers, setTiers] = useState<MembershipTier[]>(() => {
    const saved = localStorage.getItem("memberframe_tiers");
    return saved ? JSON.parse(saved) : DEFAULT_TIERS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("15");
  const [annualPrice, setAnnualPrice] = useState("140");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");

  const saveTiers = (newTiers: MembershipTier[]) => {
    setTiers(newTiers);
    localStorage.setItem("memberframe_tiers", JSON.stringify(newTiers));
  };

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTier: MembershipTier = {
      id: `tier_${Date.now()}`,
      name: name.trim(),
      priceMonthly: Number(monthlyPrice) || 0,
      priceAnnual: Number(annualPrice) || 0,
      tag: tag.trim() || name.toLowerCase().replace(/\s+/g, "_"),
      description: description.trim() || "Exclusive tier perks and access.",
    };

    saveTiers([...tiers, newTier]);
    setIsModalOpen(false);
    setName("");
    setMonthlyPrice("15");
    setAnnualPrice("140");
    setTag("");
    setDescription("");
  };

  const handleDeleteTier = (id: string) => {
    if (tiers.length <= 1) return;
    saveTiers(tiers.filter((t) => t.id !== id));
  };

  return (
    <div className="tiers-tab-container">
      {/* Header Row */}
      <div className="tab-header-row">
        <div className="tab-title-group">
          <h2 className="tab-main-title">Membership Tiers</h2>
          <p className="tab-subtitle">
            Configure subscription tiers and pricing.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={13} stroke="currentColor" />
          <span>Add Tier</span>
        </button>
      </div>

      {/* Tiers List */}
      <div className="tiers-list">
        {tiers.map((tier) => (
          <div key={tier.id} className="tier-card">
            <div className="tier-card-top">
              <div className="tier-name-wrap">
                <Crown size={14} stroke="currentColor" />
                <span className="tier-name">{tier.name}</span>
                {tier.isPopular && (
                  <span className="badge badge-brand">Popular</span>
                )}
              </div>

              <div className="tier-price-wrap">
                <span className="tier-price">${tier.priceMonthly}</span>
                <span className="tier-interval">/mo</span>
              </div>
            </div>

            <p className="tier-description">{tier.description}</p>

            <div className="tier-card-bottom">
              <div className="tier-tag">
                <Tag size={10} stroke="currentColor" />
                <span>access:{tier.tag}</span>
              </div>

              <div className="tier-actions">
                {tiers.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleDeleteTier(tier.id)}
                    aria-label={`Delete ${tier.name}`}
                    title="Delete tier"
                  >
                    <Trash2 size={13} stroke="currentColor" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Tier Modal */}
      {isModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="modal-title">Create Membership Tier</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={14} stroke="currentColor" />
              </button>
            </div>

            <form onSubmit={handleAddTier}>
              <div className="modal-body">
                <div className="field-row">
                  <label htmlFor="tier-name-input" className="field-row-label">
                    Tier Name
                  </label>
                  <div className="field-row-control">
                    <input
                      id="tier-name-input"
                      type="text"
                      className="input-text"
                      placeholder="e.g. Platinum VIP"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="monthly-price-input" className="field-row-label">
                    Monthly ($)
                  </label>
                  <div className="field-row-control">
                    <input
                      id="monthly-price-input"
                      type="number"
                      min="0"
                      className="input-text"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="annual-price-input" className="field-row-label">
                    Annual ($)
                  </label>
                  <div className="field-row-control">
                    <input
                      id="annual-price-input"
                      type="number"
                      min="0"
                      className="input-text"
                      value={annualPrice}
                      onChange={(e) => setAnnualPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="tag-input" className="field-row-label">
                    Access Tag
                  </label>
                  <div className="field-row-control">
                    <input
                      id="tag-input"
                      type="text"
                      className="input-text"
                      placeholder="e.g. platinum"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="desc-input" className="field-row-label">
                    Description
                  </label>
                  <div className="field-row-control">
                    <input
                      id="desc-input"
                      type="text"
                      className="input-text"
                      placeholder="Short perk summary"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-cta btn-sm">
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
