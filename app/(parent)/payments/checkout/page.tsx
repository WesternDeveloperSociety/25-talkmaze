'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { CheckoutProvider,PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout';
import styles from './checkout.module.css';

// 1. Initialize Stripe
// Make sure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in your .env.local file
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
stripePromise.then((stripe) => console.log("Stripe object: " + JSON.stringify(stripe)));

console.log("Stripe Promise: " + stripePromise);
// --- THE FORM COMPONENT (Handles the actual inputs) ---
function CheckoutForm({ amountDisplay, planName }: { amountDisplay: string, planName: string }) {
  /*
  const stripe = useStripe();
  const elements = useElements();
  */
  const checkout = useCheckout();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting")
    if (!checkout) return;

    if(checkout.type != 'success'){
      setErrorMessage("checkout still loading")
      setLoading(true);
      return;
    }
    setLoading(true);
    
    // This triggers the payment with Stripe
    const result = await checkout.checkout.confirm({
      //email: email,
      //returnUrl:  `/success`
    })
    
    if (result.type == 'error') {
      setErrorMessage(result.error.message || "An unexpected error occurred.");
      console.log("Error with stripe confirmation")
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
        {/* LEFT COLUMN (Read Only Summary) */}
        <div className={styles.leftColumn}>
            <button onClick={() => router.back()} className={styles.backButton}>
                <span style={{ marginRight: '8px', fontSize: '18px' }}>‹</span> Return to package options
            </button>

            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Overview</h1>

            <div className={styles.overviewCard}>
                <h2 className={styles.overviewTitle}>TalkMaze Package Renewal:</h2>
                <div className={styles.innerWhiteCard}>
                    <div className={styles.planText}>{planName} | {amountDisplay} (CA)</div>
                    <span style={{ cursor: 'pointer', fontSize: '18px' }}>🗑️</span>
                </div>
                <div className={styles.detailsLink}>See more details</div>
            </div>

            <div className={styles.billingHistory}>
                <span>Billing History <span style={{ fontWeight: 'normal', color: '#666', fontSize: '12px' }}>expand</span></span>
            </div>
        </div>

        {/* RIGHT COLUMN (The Payment Form) */}
        <div className={styles.rightColumn}>
            <h3 className={styles.sectionTitle}>Contact Information</h3>
            
            <div className={styles.inputRow}>
                <select className={styles.inputField} style={{ width: '40%' }}>
                    <option>1+ United States</option>
                    <option>1+ Canada</option>
                </select>
                <input type="text" placeholder="Phone Number *" className={styles.inputField} />
            </div>

            <div className={styles.inputGroup}>
                <input 
                  type="email" 
                  placeholder="Email Address *" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className={styles.inputField} 
                  required 
                />
            </div>

            <div className={styles.inputRow}>
                <input 
                  type="text" 
                  placeholder="First Name *" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  className={styles.inputField} 
                  required 
                />
                <input 
                  type="text" 
                  placeholder="Last Name *" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  className={styles.inputField} 
                  required 
                />
            </div>

            <hr className={styles.divider} />

            <h3 className={styles.sectionTitle}>Payment</h3>

            {/* --- THIS IS THE NEW STRIPE COMPONENT --- */}
            {/* It replaces the manual Card Number, Expiry, CVC inputs */}
            <div className={styles.inputGroup} style={{marginBottom: '20px'}}>
                <PaymentElement 
                  onReady = {() =>  console.log("Payment ready")}
                  onLoadError={(e) => console.log("Error loading payment",e)}
                />
            </div>

            {/* Error Message Display */}
            {errorMessage && <div style={{color: '#ff6b6b', marginBottom: '15px', fontWeight: 'bold'}}>{errorMessage}</div>}

            <button onClick={handleSubmit} disabled={checkout.type != 'success' || loading} className={styles.purchaseButton}>
                {loading ? 'Processing...' : `Purchase (${amountDisplay})`}
            </button>
        </div>
    </div>
  );
}

// --- THE WRAPPER (Sets up the security connection) ---
function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const [clientSecret, setClientSecret] = useState('');

  const planName = searchParams.get('name') || 'Unknown Plan';
  const amountCents = searchParams.get('amount');
  const price_id = searchParams.get('price_id')
  const amountDisplay = amountCents ? `$${(parseInt(amountCents) / 100).toFixed(0)}` : '0';

  useEffect(() => {
    if (amountCents) {
      // Talk to your new API to get the "Secret Key" for this specific transaction

      
      async function getClient(){

        try{
          const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price_id: price_id, amount: amountCents, name: planName}),
          })

          if(!res.ok){
            throw new Error("Error getting stripe client");
          }

          const data = await res.json();
          
         
          setClientSecret(data.secret);
          

        }catch(err){
          console.log("Error in checkout page: " + err)
        }
         
      }


      getClient();
     
        
    }
  }, [amountCents]);

  // While waiting for the API, show a loading state
  if (!clientSecret || !amountCents) {
    return (
        <div className={styles.container}>
            <div style={{color:'white', fontSize: '20px'}}>Loading secure payment...</div>
        </div>
    );
  }

  
  // Once we have the secret, load the form inside Stripe's "Elements" provider
  return (
    <div className={styles.container}>
      <CheckoutProvider 
        stripe={stripePromise} 
        options={{ 
            clientSecret, 
        }}
      >
        <CheckoutForm amountDisplay={amountDisplay} planName={planName} />
      </CheckoutProvider>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutPageContent />
    </Suspense>
  );
}