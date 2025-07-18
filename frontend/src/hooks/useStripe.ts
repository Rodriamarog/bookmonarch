import { useState } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import { stripePromise } from '@/lib/stripe'

export function useStripe() {
  const [loading, setLoading] = useState(false)
  const { user } = useAuthContext()

  const createCheckoutSession = async () => {
    if (!user) {
      throw new Error('User must be authenticated')
    }

    setLoading(true)
    try {
      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { sessionId } = await response.json()

      // Redirect to Stripe Checkout
      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('Stripe failed to load')
      }

      const { error } = await stripe.redirectToCheckout({ sessionId })
      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const openBillingPortal = async () => {
    if (!user) {
      throw new Error('User must be authenticated')
    }

    setLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to create billing portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error opening billing portal:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    createCheckoutSession,
    openBillingPortal,
  }
}