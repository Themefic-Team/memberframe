import React, { useEffect, useState } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface DonationSliderProps {
  minAmount?: number;
  maxAmount?: number;
  defaultAmount?: number;
  step?: number;
  currency?: "USD" | "EUR" | "GBP" | "INR";
  title?: string;
  description?: string;
  ctaText?: string;
}

const DONATION_SLIDER_CSS = `
.mf-donation-card {
  width: 100%;
  max-width: 420px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
  text-align: center;
}

.mf-donation-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.16);
  border: 1px solid rgba(248, 113, 113, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f87171;
  margin: 0 auto 12px auto;
}

.mf-donation-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #ffffff;
}

.mf-donation-desc {
  font-size: 12px;
  color: #95a3b2;
  margin: 0 0 20px 0;
}

.mf-donation-amount-display {
  font-size: 36px;
  font-weight: 800;
  color: #708aff;
  margin-bottom: 16px;
  letter-spacing: -0.5px;
}

.mf-donation-slider-input {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  outline: none;
  margin-bottom: 20px;
  cursor: pointer;
  box-sizing: border-box;
}

.mf-donation-presets {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.mf-donation-preset-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #edf0f7;
  cursor: pointer;
  transition: all 150ms ease;
}

.mf-donation-preset-btn--active {
  background: #5271ff;
  border-color: #5271ff;
  color: #ffffff;
}

.mf-donation-submit-btn {
  width: 100%;
  height: 42px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  transition: transform 150ms ease;
}

.mf-donation-submit-btn:hover {
  transform: translateY(-1px);
}
`;

function injectStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#f87171" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function DonationSlider({
  minAmount = 5,
  maxAmount = 100,
  defaultAmount = 15,
  step = 5,
  currency = "USD",
  title = "Support My Creative Work",
  description = "Choose any amount to support tutorials, templates, and ongoing updates.",
  ctaText = "Contribute",
}: DonationSliderProps): React.JSX.Element {
  const [amount, setAmount] = useState(defaultAmount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    injectStyles("mf-donation-slider-styles", DONATION_SLIDER_CSS);
  }, []);

  const currencySymbol =
    currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "INR" ? "₹" : "$";

  const presetAmounts = [minAmount, 15, 25, 50].filter(
    (a) => a >= minAmount && a <= maxAmount
  );

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert(`Initiating ${currencySymbol}${amount} checkout session via Stripe...`);
    }, 800);
  };

  return (
    <div className="mf-donation-card">
      <div className="mf-donation-icon-wrap">
        <HeartIcon />
      </div>

      <h3 className="mf-donation-title">{title}</h3>
      <p className="mf-donation-desc">{description}</p>

      <div className="mf-donation-amount-display">
        {currencySymbol}
        {amount}
      </div>

      <input
        type="range"
        min={minAmount}
        max={maxAmount}
        step={step}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mf-donation-slider-input"
      />

      <div className="mf-donation-presets">
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`mf-donation-preset-btn ${
              amount === preset ? "mf-donation-preset-btn--active" : ""
            }`}
            onClick={() => setAmount(preset)}
          >
            {currencySymbol}
            {preset}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="mf-donation-submit-btn"
        onClick={handlePay}
        disabled={loading}
      >
        <SparklesIcon />
        <span>
          {loading ? "Preparing..." : `${ctaText} ${currencySymbol}${amount}`}
        </span>
        <ArrowRightIcon />
      </button>
    </div>
  );
}

export { DonationSlider };

addPropertyControls(DonationSlider, {
  minAmount: {
    type: ControlType.Number,
    title: "Min Amount",
    min: 1,
    max: 50,
    defaultValue: 5,
  },
  maxAmount: {
    type: ControlType.Number,
    title: "Max Amount",
    min: 50,
    max: 1000,
    defaultValue: 100,
  },
  defaultAmount: {
    type: ControlType.Number,
    title: "Default Amount",
    min: 5,
    max: 100,
    defaultValue: 15,
  },
  step: {
    type: ControlType.Number,
    title: "Step Value",
    min: 1,
    max: 25,
    defaultValue: 5,
  },
  currency: {
    type: ControlType.Enum,
    title: "Currency",
    options: ["USD", "EUR", "GBP", "INR"],
    optionTitles: ["USD ($)", "EUR (€)", "GBP (£)", "INR (₹)"],
    defaultValue: "USD",
  },
  title: {
    type: ControlType.String,
    title: "Title",
    defaultValue: "Support My Creative Work",
  },
  description: {
    type: ControlType.String,
    title: "Subtitle",
    defaultValue:
      "Choose any amount to support tutorials, templates, and ongoing updates.",
  },
  ctaText: {
    type: ControlType.String,
    title: "Button Label",
    defaultValue: "Contribute",
  },
});
