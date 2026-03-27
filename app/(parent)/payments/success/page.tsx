import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import SuccessClient from './SuccessClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId || typeof sessionId !== 'string') {
    // No session ID? Redirect to checkout.
    console.error('No session_id found in URL. Params:', searchParams);
    redirect('/payments/checkout');
  }

  try {
    // 1. Retrieve the Checkout Session from Stripe
    console.log(`Retrieving session: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Session retrieved:', { id: session.id, payment_status: session.payment_status, status: session.status });

    // 2. Check if the payment was actually successful
    if (session.payment_status !== 'paid') {
      console.error('Session payment status is not paid:', session.payment_status);
      // Optional: Redirect to a "payment failed" page or back to checkout with an error
      redirect('/payments/checkout?error=payment_failed');
    }

    //if successful we will create the lessonspace, this is just for
    //testing, in reality this should be done in stripe webhook


    // 3. (TODO) Update User in Supabase
    // This is where you will add the logic to update the user's subscription status.
    // Ensure you have the user's ID or email from the session metadata or customer details.
    /*
    const customerEmail = session.customer_details?.email;
    if (customerEmail) {
        // await supabase...
        console.log(`Payment confirmed for ${customerEmail}. Updating database...`);
    }
    */
    
    // Log for debugging (remove in production if sensitive)
    console.log(`Payment success verified for session: ${sessionId}`);

  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    // On error (e.g., invalid session ID), redirect to checkout or error page
    redirect('/payments/checkout?error=invalid_session');
  }

  // 4. Render the Success Page
  return <SuccessClient />;
}
