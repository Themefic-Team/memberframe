import React, { useState } from "react";
import { Lock, Unlock, UserCheck, ShieldAlert, Eye } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import "./PreviewStudio.css";

export type SimulatedRole = "guest" | "free" | "pro" | "canceled";

export const PreviewStudio: React.FC = () => {
  const [role, setRole] = useState<SimulatedRole>("guest");

  return (
    <div className="preview-studio">
      <div className="preview-studio__header">
        <h2 className="preview-studio__title">Live Preview Studio</h2>
        <p className="preview-studio__description">
          Simulate how gated canvas elements appear to different visitor roles in real time.
        </p>
      </div>

      <div className="preview-studio__role-selector">
        <button
          className={`preview-studio__role-btn ${
            role === "guest" ? "preview-studio__role-btn--active" : ""
          }`}
          onClick={() => setRole("guest")}
        >
          <Lock size={14} />
          <span>Guest</span>
        </button>
        <button
          className={`preview-studio__role-btn ${
            role === "free" ? "preview-studio__role-btn--active" : ""
          }`}
          onClick={() => setRole("free")}
        >
          <UserCheck size={14} />
          <span>Free Tier</span>
        </button>
        <button
          className={`preview-studio__role-btn ${
            role === "pro" ? "preview-studio__role-btn--active" : ""
          }`}
          onClick={() => setRole("pro")}
        >
          <Unlock size={14} />
          <span>Pro Tier</span>
        </button>
        <button
          className={`preview-studio__role-btn ${
            role === "canceled" ? "preview-studio__role-btn--active" : ""
          }`}
          onClick={() => setRole("canceled")}
        >
          <ShieldAlert size={14} />
          <span>Canceled</span>
        </button>
      </div>

      <div className="preview-studio__stage">
        <div className="preview-studio__stage-header">
          <div className="preview-studio__stage-label">
            <Eye size={12} />
            <span>Canvas Viewport Simulation</span>
          </div>
          <Badge
            variant={
              role === "pro"
                ? "success"
                : role === "free"
                ? "brand"
                : role === "canceled"
                ? "danger"
                : "warning"
            }
          >
            {role.toUpperCase()}
          </Badge>
        </div>

        <div className="preview-studio__viewport">
          <div
            className={`preview-studio__mock-content ${
              role === "guest" || role === "canceled"
                ? "preview-studio__mock-blurred"
                : ""
            }`}
          >
            <h3 className="preview-studio__mock-heading">
              Exclusive Member Video Masterclass
            </h3>
            <p className="preview-studio__mock-body">
              This premium lesson covers advanced Framer CMS architecture, custom animations,
              and headless webhook endpoints for subscription membership platforms.
            </p>
          </div>

          {(role === "guest" || role === "canceled") && (
            <div className="preview-studio__overlay">
              <div className="preview-studio__overlay-icon">
                <Lock size={18} />
              </div>
              <span className="preview-studio__overlay-title">
                {role === "guest" ? "Members Only Content" : "Subscription Inactive"}
              </span>
              <p className="preview-studio__overlay-desc">
                {role === "guest"
                  ? "Unlock this tutorial and 45+ components by subscribing."
                  : "Please renew your subscription to access this content."}
              </p>
              <Button variant="primary" size="sm">
                {role === "guest" ? "Join Pro Tier" : "Renew Membership"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
