// File: app/payments/CurrentSubscription.tsx
//NOTE WILL BE FIXED WHEN SUBSCRIPTION DATA BECOMES AVAILABLE
import React from 'react';
import { createClient } from '@/utils/supabase/client';
import styles from './payments.module.css'; 

// --- Data Interface (Hypothetical User Subscription Data) ---
interface SubscriptionStatus {
    packageName: string;
    description: string;
    sessionsLeft: number;
    daysToCancel: number;
}

// --- Data Fetching Function (Assuming a Supabase table named 'Subscriptions') ---
async function getCurrentSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const supabase = createClient();
    
    // NOTE: You would typically filter this by the currently logged-in user's ID
    const { data, error } = await supabase
        .from('Subscriptions') 
        .select('*')
        .limit(1) 
        .single(); // Assuming only one active sub per user

    if (error) {
        //console.error('Error fetching subscription status:', error);
        return null;
    }
    return data as SubscriptionStatus;
}


// --- Component Definition (Async Server Component) ---
export default async function CurrentSubscription() {
    // 1. Fetch the user's live subscription status
    const status = await getCurrentSubscriptionStatus();

    // Handle case where no active subscription is found
    if (!status) {
        return <div className={styles.currentSubCard}>No active subscription found.</div>;
    }

    return (
        <div className={styles.currentSubCard}>
            <div className={styles.subPackageDetails}>
                <h3>{status.packageName}</h3> 
                <p>{status.description}</p>
            </div>

            <div className={styles.subStatusBox}>
                <p className={styles.subStatusText}>
                    You have **{status.daysToCancel}** days after purchase to cancel your package
                </p>
                
                <div className={styles.sessionStatusContainer}>
                    {/* Progress Circle (Styling from payments.module.css is needed here) */}
                    <div className={styles.sessionProgressCircle}>
                        <div className={styles.sessionProgressInner}></div>
                    </div>
                    <p className={styles.sessionCount}>
                        **{status.sessionsLeft}** Sessions Left in Payment Package
                    </p>
                </div>

                {/* NOTE: If the 'Cancel plan' button is interactive, this part might need to be a client component */}
                <button className={styles.cancelPlanButton}>
                    Cancel plan
                </button>
            </div>
        </div>
    );
}