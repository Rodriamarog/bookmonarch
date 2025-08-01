'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAuthContext } from '@/contexts/AuthContext'
import { useStripe } from '@/hooks/useStripe'
import { Crown, CreditCard } from 'lucide-react'

interface SubscriptionButtonProps {
  onSignInClick?: () => void
}

export function SubscriptionButton({ onSignInClick }: SubscriptionButtonProps) {
  const { user, profile } = useAuthContext()
  const { loading, createCheckoutSession, openBillingPortal } = useStripe()
  const [error, setError] = useState('')

  const handleSubscribe = async () => {
    if (!user) {
      if (onSignInClick) {
        onSignInClick()
        return
      }
      setError('Please sign in to subscribe')
      return
    }

    try {
      setError('')
      await createCheckoutSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start subscription')
    }
  }

  const handleManageBilling = async () => {
    try {
      setError('')
      await openBillingPortal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    }
  }

  if (!user) {
    return (
      <Button
        onClick={handleSubscribe}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <Crown className="h-4 w-4" />
        {loading ? 'Loading...' : 'Sign In to Subscribe'}
      </Button>
    )
  }

  const isPro = profile?.subscription_status === 'pro'

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
          {error}
        </div>
      )}
      
      {isPro ? (
        <Button
          variant="secondary"
          onClick={handleManageBilling}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <CreditCard className="h-4 w-4" />
          {loading ? 'Loading...' : 'Manage Billing'}
        </Button>
      ) : (
        <Button
          onClick={handleSubscribe}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Crown className="h-4 w-4" />
          {loading ? 'Loading...' : 'Upgrade to Pro - $20/month'}
        </Button>
      )}
      
      <div className="text-xs text-gray-500 text-center">
        {isPro ? (
          'Pro Plan: Generate up to 10 books per day'
        ) : (
          'Free Plan: 1 book per account • Upgrade for unlimited daily generation'
        )}
      </div>
    </div>
  )
}