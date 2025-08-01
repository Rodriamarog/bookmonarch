'use client'

import { NavigationMenu } from '@/components/ui'
import { RecentBooks } from '@/components/dashboard/RecentBooks'
import { SignInModal } from '@/components/auth/SignInModal'
import { useAuthContext } from '@/contexts/AuthContext'
import { useState } from 'react'
import { BookOpen } from 'lucide-react'

export default function BooksPage() {
  const [showSignInModal, setShowSignInModal] = useState(false)
  const { user, loading } = useAuthContext()

  // Show sign in prompt for non-authenticated users
  if (!loading && !user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#FFFBF5" }}>
        <NavigationMenu />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-6" style={{ color: "#D97706" }} />
            <h1 className="text-3xl font-bold mb-4" style={{ color: "#111827" }}>
              Your Book Library
            </h1>
            <p className="text-lg mb-8" style={{ color: "#4B5563" }}>
              Sign in to view and manage your generated books
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="inline-flex items-center justify-center px-6 py-3 border-4 border-black bg-orange-500 text-white font-bold rounded-lg hover:brightness-110 hover:opacity-90 transition-all duration-200"
              style={{
                boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
                backgroundColor: '#D97706'
              }}
            >
              Sign In to View Books
            </button>
          </div>
        </main>

        <SignInModal 
          isOpen={showSignInModal} 
          onClose={() => setShowSignInModal(false)} 
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFBF5" }}>
      <NavigationMenu />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>
            Your Book Library
          </h1>
          <p className="text-lg" style={{ color: "#4B5563" }}>
            Manage and download your generated books
          </p>
        </div>

        {user && (
          <RecentBooks userId={user.id} />
        )}
      </main>
    </div>
  )
}