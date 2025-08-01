'use client'

import { NavigationMenu } from '@/components/ui'
import { useAuthContext } from '@/contexts/AuthContext'
import { Settings, Crown } from 'lucide-react'

export default function SettingsPage() {
  const { user, loading } = useAuthContext()

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFBF5" }}>
      <NavigationMenu />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <Settings className="h-16 w-16 mx-auto mb-6" style={{ color: "#D97706" }} />
          <h1 className="text-3xl font-bold mb-4" style={{ color: "#111827" }}>
            Settings
          </h1>
          <p className="text-lg mb-8" style={{ color: "#4B5563" }}>
            User settings and preferences are coming soon!
          </p>
          
          <div className="max-w-md mx-auto p-6 rounded-lg border-4 border-black bg-orange-50">
            <Crown className="h-8 w-8 mx-auto mb-4" style={{ color: "#D97706" }} />
            <h3 className="font-bold mb-2" style={{ color: "#111827" }}>
              Coming Soon
            </h3>
            <p className="text-sm" style={{ color: "#4B5563" }}>
              We&apos;re working on adding user preferences, account management, and more customization options.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}