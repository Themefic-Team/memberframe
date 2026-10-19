import React from "react";
import { Info } from "lucide-react";
import { useLicense } from "../../hooks/useLicense";

/**
 * "After purchasing, the watermark will be removed automatically." F19: a
 * clone of the BEAF plugin's WatermarkNotice, shown while the trial runs.
 */
export const WatermarkNotice: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  const { view } = useLicense();
  if (view?.state !== "trial") return null;

  return (
    <div
      className={`beaf-watermark-notice is-trial ${onUpgrade ? "is-clickable" : ""}`}
      onClick={onUpgrade}
      title={onUpgrade ? "Click to view upgrade plans" : undefined}
    >
      <div className="beaf-watermark-notice-icon-col">
        <Info size={16} className="beaf-watermark-notice-icon" />
      </div>
      <div className="beaf-watermark-notice-text-col">
        <div className="beaf-watermark-notice-title">Notice</div>
        <div className="beaf-watermark-notice-desc">After purchasing, the watermark will be removed automatically</div>
      </div>
    </div>
  );
};
