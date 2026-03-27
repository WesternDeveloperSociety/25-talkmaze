import React from "react";
import { createClient } from "@/utils/supabase/client";
import { RenewalCardsContainer } from "./RenewalCards";
import CurrentSubscription from "./CurrentSubscription";
import styles from "./payments.module.css";

// 1. ADD THIS: TypeScript needs to know what a Plan looks like in this file too
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

interface RenewalCardProps {
  renewalOptions: plans[];
}

export default async function PaymentPage() {
  // 2. FIX: Add 'await' here because createClient is asynchronous on the server

  // 3. FIX: Cast the result so the 'plans' variable isn't 'any'
  const { data: plans } = (await createClient().from("plans").select("*")) as {
    data: plans[] | null;
  };

  return (
    <div className={styles.paymentPageContainer}>
      <header className={styles.pageHeader}>
        <a href="/dashboard" className={styles.returnLink}>
          &lt; Return to Dashboard
        </a>
      </header>

      <main className={styles.mainContent}>
        <h2 className={styles.sectionTitle}>
          Current subscription in progress
        </h2>
        <CurrentSubscription />

        <h2 className={styles.sectionTitle}>
          TalkMaze Package Renewal Options
        </h2>
        <RenewalCardsContainer renewalOptions={plans || []} />
      </main>
    </div>
  );
}
