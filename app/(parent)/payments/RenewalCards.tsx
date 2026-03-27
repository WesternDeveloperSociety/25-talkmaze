"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./payments.module.css";

//comes from supabase table
interface plans {
  id: number;
  name: string;
  description: string;
  renewal: string;
  currency: string;
  stripe_price_id: string;
  cents: number;
  classes: number;
  type: string;
}

export const RenewalCardsContainer: React.FC<{ renewalOptions: plans[] }> = ({
  renewalOptions,
}) => {

  const router = useRouter();
  // 1. New State: Track which plan is currently selected
  const [selectedPlan, setSelectedPlan] = useState<plans | null>(null);

  // 2. Logic: Just updates the state (does NOT navigate yet)
  const handleSelectPlan = (plan: plans) => {
    setSelectedPlan(plan);
  };

  // 3. Logic: This handles the final navigation
  const handleContinue = () => {
    if (!selectedPlan) {
      alert("Please select a plan first.");
      return;
    }
    router.push(
      `/payments/checkout?price_id=${selectedPlan.stripe_price_id}&name=${selectedPlan.name}&amount=${selectedPlan.cents}`,
    );
  };

  return (
    // We wrap everything in a generic div so we can include the button at the bottom
    <div>
      <div className={styles.renewalOptionsGrid}>
        {renewalOptions.map((plan) => {
          // Check if this specific card is the one selected
          const isSelected = selectedPlan?.id === plan.id;

          return (
            <div
              key={plan.id}
              className={styles.renewalCard}
              // Optional: Add a border style if selected
              style={isSelected ? { border: "2px solid #0056b3" } : {}}
            >
              <div className={styles.renewalHeader}>
                <h4 className={styles.renewalTitle}>{plan.name}</h4>
                <span className={styles.renewalSubtitle}>{plan.type}</span>
              </div>
              <div className={styles.renewalPriceGroup}>
                <span className={styles.renewalPrice}>
                  ${(plan.cents / 100).toFixed(2)}
                </span>
                <span className={styles.renewalDuration}>
                  {plan.classes} Classes
                </span>
              </div>
              <p className={styles.renewalDescription}>{plan.description}</p>

              <button
                className={styles.renewalSelectButton}
                onClick={() => handleSelectPlan(plan)}
                // Change style/text to show it's active
                style={
                  isSelected
                    ? { backgroundColor: "#004494", color: "white" }
                    : {}
                }
              >
                {isSelected ? "Selected" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. The Continue Button is now here, where it can access 'selectedPlan' */}
      <div
        className={styles.continuePaymentContainer}
        style={{ marginTop: "2rem", textAlign: "right" }}
      >
        <button
          className={styles.continuePaymentButton}
          onClick={handleContinue}
          // Optional: Disable button until a plan is picked
          disabled={!selectedPlan}
          style={{ opacity: !selectedPlan ? 0.5 : 1 }}
        >
          Continue to payment &gt;
        </button>
      </div>
    </div>
  );
};
