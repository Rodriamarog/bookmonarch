import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Log the event for debugging
    await supabase.from('billing_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data,
      processing_status: 'pending',
    })

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark event as processed
    await supabase
      .from('billing_events')
      .update({ processing_status: 'completed' })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    
    // Mark event as failed
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!
    
    try {
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      await supabase
        .from('billing_events')
        .update({ 
          processing_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('stripe_event_id', event.id)
    } catch (e) {
      // If we can't even parse the event, just log it
      console.error('Failed to log webhook error:', e)
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  // Get user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error('No user found for customer:', customerId)
    return
  }

  // Update subscription status
  const status = subscription.status === 'active' ? 'pro' : 'free'
  
  await supabase
    .from('profiles')
    .update({ subscription_status: status })
    .eq('id', profile.id)

  console.log(`Updated subscription status for user ${profile.id}: ${status}`)
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  // Get user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error('No user found for customer:', customerId)
    return
  }

  // Update subscription status to free
  await supabase
    .from('profiles')
    .update({ subscription_status: 'free' })
    .eq('id', profile.id)

  console.log(`Canceled subscription for user ${profile.id}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded for invoice:', invoice.id)
  // Additional logic for successful payments if needed
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed for invoice:', invoice.id)
  // Additional logic for failed payments if needed
  // Could send notification emails, etc.
}