import React from "react";
import { Check } from "lucide-react";

/** "Payment Completed". F19: a clone of the BEAF plugin's PaymentSuccessModal. */
export const PaymentSuccessModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="beaf-payment-modal success-modal">
      <div className="beaf-payment-box beaf-success-box">
        <div className="beaf-success-icon">
          <Check aria-hidden={true} />
        </div>
        <h3>Payment Completed</h3>
        <p>Your payment was successful. The watermark has been removed!</p>
        <small>Redirecting to your profile...</small>
      </div>
    </div>
  );
};
