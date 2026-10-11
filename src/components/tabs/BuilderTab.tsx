import React, { useState } from "react";
import {
  Eye,
  Plus,
  Lock,
  Unlock,
  Check,
  Settings2,
  Copy,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { framerCanvasService, InsertionResult } from "../../services/framerCanvasService";
import "./BuilderTab.css";

type SimState = "logged_out" | "free" | "silver" | "vip";

export const BuilderTab: React.FC = () => {
  const [simState, setSimState] = useState<SimState>("logged_out");
  const [insertingComponent, setInsertingComponent] = useState<string | null>(null);
  const [insertedComponent, setInsertedComponent] = useState<string | null>(null);
  const [copiedComponent, setCopiedComponent] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InsertionResult | null>(null);
  const [showDebugGuide, setShowDebugGuide] = useState(false);

  // In-Plugin MemberGate Customizer State
  const [gateTitle, setGateTitle] = useState("Members Only Content");
  const [gateDesc, setGateDesc] = useState(
    "Subscribe to unlock this premium content and member perks."
  );
  const [gateCta, setGateCta] = useState("Sign In to Unlock");
  const [gateBlur, setGateBlur] = useState(8);
  const [showConfig, setShowConfig] = useState(false);

  const handleInsert = async (name: string) => {
    setInsertingComponent(name);
    setLastResult(null);

    const result = await framerCanvasService.insertComponent(name);
    setInsertingComponent(null);
    setInsertedComponent(name);
    setLastResult(result);

    setTimeout(() => {
      setInsertedComponent(null);
    }, 3000);
  };

  const handleCopyCode = async (name: string) => {
    const success = await framerCanvasService.copyComponentSource(name);
    if (success) {
      setCopiedComponent(name);
      setTimeout(() => {
        setCopiedComponent(null);
      }, 2000);
    }
  };

  const componentsList = [
    {
      name: "MemberAuth",
      displayName: "<MemberAuth />",
      desc: "Modal or inline login and 6-digit OTP registration form.",
    },
    {
      name: "MemberDashboard",
      displayName: "<MemberDashboard />",
      desc: "Self-serve customer portal for billing, invoices, and profile.",
    },
    {
      name: "MeteredPaywall",
      displayName: "<MeteredPaywall />",
      desc: "Soft paywall with monthly reading quota and counter pill.",
    },
    {
      name: "CMSGatedTemplate",
      displayName: "<CMSGatedTemplate />",
      desc: "Dynamic Framer CMS item gating with fade-out excerpt.",
    },
    {
      name: "ProtectedDownload",
      displayName: "<ProtectedDownload />",
      desc: "Expiring asset vault for downloadable templates and files.",
    },
    {
      name: "CourseProgress",
      displayName: "<CourseProgress />",
      desc: "Creator LMS lesson checklist, progress bar, and certificate.",
    },
    {
      name: "DonationSlider",
      displayName: "<DonationSlider />",
      desc: "Pay-what-you-want contribution slider with preset amounts.",
    },
  ];

  return (
    <div className="builder-tab-container">
      {/* Live Insertion Status Banner */}
      {lastResult && (
        <div
          className={`status-alert-banner ${
            lastResult.success ? "" : "status-alert-banner--error"
          }`}
        >
          <div className="status-alert-icon">
            {lastResult.success ? (
              <CheckCircle2 size={16} stroke="currentColor" />
            ) : (
              <AlertCircle size={16} stroke="currentColor" />
            )}
          </div>
          <div className="status-alert-content">
            <h4 className="status-alert-title">
              {lastResult.success ? "Component Created" : "Insertion Notice"}
            </h4>
            <p className="status-alert-text">{lastResult.message}</p>
          </div>
        </div>
      )}

      {/* Interactive Simulator Box */}
      <div className="preview-simulator-box">
        <div className="simulator-header">
          <div className="simulator-title-group">
            <Eye size={13} stroke="currentColor" />
            <h3 className="simulator-title">Live Gate Simulator</h3>
          </div>

          <div className="field-row-control">
            <select
              className="input-select"
              value={simState}
              onChange={(e) => setSimState(e.target.value as SimState)}
              aria-label="Simulate member state"
            >
              <option value="logged_out">Visitor (Logged Out)</option>
              <option value="free">Free Member</option>
              <option value="silver">Silver Tier</option>
              <option value="vip">Gold VIP</option>
            </select>
          </div>
        </div>

        {/* Viewport Stage */}
        <div className="simulator-stage">
          {simState === "logged_out" || simState === "free" ? (
            <div className="simulator-card">
              <div className="sim-lock-icon">
                <Lock size={14} stroke="currentColor" />
              </div>
              <h4 className="sim-lock-title">{gateTitle}</h4>
              <p className="sim-lock-desc">{gateDesc}</p>
              <button type="button" className="primary-cta btn-sm">
                <span>{gateCta}</span>
              </button>
            </div>
          ) : (
            <div className="sim-unlocked-state">
              <Unlock size={24} stroke="currentColor" />
              <span className="sim-unlocked-title">Access Granted</span>
              <span className="sim-unlocked-desc">
                Your {simState === "silver" ? "Silver Tier" : "Gold VIP"} badge
                unlocked this frame.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* MemberGate Customizer Drawer */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-wrap">
            <Settings2 size={13} stroke="currentColor" />
            <h3 className="settings-card-title">MemberGate Defaults</h3>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <span>{showConfig ? "Hide" : "Customize"}</span>
          </button>
        </div>

        {showConfig && (
          <div className="field-rows">
            <div className="field-row">
              <label htmlFor="cfg-lock-title" className="field-row-label">
                Lock Title
              </label>
              <div className="field-row-control fill">
                <input
                  id="cfg-lock-title"
                  type="text"
                  className="input-text"
                  value={gateTitle}
                  onChange={(e) => setGateTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="cfg-lock-desc" className="field-row-label">
                Description
              </label>
              <div className="field-row-control fill">
                <input
                  id="cfg-lock-desc"
                  type="text"
                  className="input-text"
                  value={gateDesc}
                  onChange={(e) => setGateDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="cfg-lock-cta" className="field-row-label">
                Button Text
              </label>
              <div className="field-row-control fill">
                <input
                  id="cfg-lock-cta"
                  type="text"
                  className="input-text"
                  value={gateCta}
                  onChange={(e) => setGateCta(e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="cfg-lock-blur" className="field-row-label">
                Blur Radius ({gateBlur}px)
              </label>
              <div className="field-row-control">
                <input
                  id="cfg-lock-blur"
                  type="range"
                  min={2}
                  max={24}
                  value={gateBlur}
                  onChange={(e) => setGateBlur(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="component-actions">
          <button
            type="button"
            className="primary-cta btn-sm"
            disabled={insertingComponent === "MemberGate"}
            onClick={() => handleInsert("MemberGate")}
          >
            {insertedComponent === "MemberGate" ? (
              <>
                <Check size={13} stroke="currentColor" />
                <span>Added to Assets &gt; Code</span>
              </>
            ) : insertingComponent === "MemberGate" ? (
              <span>Creating...</span>
            ) : (
              <>
                <Plus size={13} stroke="currentColor" />
                <span>Insert MemberGate Component</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            title="Copy component code"
            onClick={() => handleCopyCode("MemberGate")}
          >
            {copiedComponent === "MemberGate" ? (
              <Check size={12} stroke="currentColor" />
            ) : (
              <Copy size={12} stroke="currentColor" />
            )}
          </button>
        </div>
      </div>

      {/* Debug & Usage Guide Accordion */}
      <div className="debug-guide-card">
        <div
          className="debug-guide-header"
          onClick={() => setShowDebugGuide(!showDebugGuide)}
        >
          <div className="debug-guide-title-wrap">
            <HelpCircle size={13} stroke="currentColor" />
            <h4 className="debug-guide-title">
              How insertion works &amp; Debugging
            </h4>
          </div>
          {showDebugGuide ? (
            <ChevronUp size={13} stroke="currentColor" />
          ) : (
            <ChevronDown size={13} stroke="currentColor" />
          )}
        </div>

        {showDebugGuide && (
          <div className="debug-guide-steps">
            <div className="debug-step-item">
              <span className="debug-step-number">1</span>
              <span>
                Clicking <strong>Insert</strong> calls Framer&apos;s Code File API to
                create a standalone <code>.tsx</code> file.
              </span>
            </div>
            <div className="debug-step-item">
              <span className="debug-step-number">2</span>
              <span>
                Look in Framer&apos;s left sidebar under <strong>Assets &gt; Code</strong>.
                Your component will appear in the list (e.g. <code>MemberAuth.tsx</code>).
              </span>
            </div>
            <div className="debug-step-item">
              <span className="debug-step-number">3</span>
              <span>
                Drag the component from <strong>Assets &gt; Code</strong> directly onto
                any page frame on your canvas.
              </span>
            </div>
            <div className="debug-step-item">
              <span className="debug-step-number">4</span>
              <span>
                To debug: Open Developer Tools (<strong>F12</strong> or Right-Click &gt;
                Inspect &gt; Console). Look for <code>[MemberFrame]</code> logs.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Canvas Components Roster */}
      <div className="field-rows">
        <h2 className="section-heading">Additional Canvas Components</h2>

        <div className="components-roster">
          {componentsList.map((item) => {
            const isInserting = insertingComponent === item.name;
            const isInserted = insertedComponent === item.name;
            const isCopied = copiedComponent === item.name;

            return (
              <div key={item.name} className="component-tile">
                <div className="component-tile-info">
                  <span className="component-tile-name">{item.displayName}</span>
                  <span className="component-tile-desc">{item.desc}</span>
                </div>

                <div className="component-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isInserting}
                    onClick={() => handleInsert(item.name)}
                  >
                    {isInserted ? (
                      <>
                        <Check size={12} stroke="currentColor" />
                        <span>Added</span>
                      </>
                    ) : isInserting ? (
                      <span>Adding...</span>
                    ) : (
                      <>
                        <Plus size={12} stroke="currentColor" />
                        <span>Insert</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    title={`Copy ${item.displayName} code`}
                    onClick={() => handleCopyCode(item.name)}
                  >
                    {isCopied ? (
                      <Check size={12} stroke="currentColor" />
                    ) : (
                      <Copy size={12} stroke="currentColor" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
