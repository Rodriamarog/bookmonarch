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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', userId)
      .single()

    let customerId = profile?.stripe_customer_id

    // Always create a new customer for test mode or if customer doesn't exist
    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        name: profile?.full_name || undefined,
        metadata: {
          supabase_user_id: userId,
        },
      })

      customerId = customer.id

      // Update profile with Stripe customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    } else {
      // Verify the customer exists in current Stripe mode (test/live)
      try {
        await stripe.customers.retrieve(customerId)
      } catch (error) {
        // Customer doesn't exist in current mode, create a new one
        console.log('Customer not found in current Stripe mode, creating new one')
        const customer = await stripe.customers.create({
          name: profile?.full_name || undefined,
          metadata: {
            supabase_user_id: userId,
          },
        })

        customerId = customer.id

        // Update profile with new Stripe customer ID
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'BookMonarch Pro',
              description: 'Generate up to 10 books per day with AI',
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: 2000, // $20.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?canceled=true`,
      metadata: {
        user_id: userId,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}