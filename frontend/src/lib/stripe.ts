import { loadStripe } from '@stripe/stripe-js'

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

export const STRIPE_PRODUCT_ID = process.env.NEXT_PUBLIC_STRIPE_PRODUCT_ID!

// Stripe configuration
export const STRIPE_CONFIG = {
  productId: STRIPE_PRODUCT_ID,
  successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/?canceled=true`,
}