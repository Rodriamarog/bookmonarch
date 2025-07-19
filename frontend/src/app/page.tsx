"use client"

import { useState, useEffect } from "react"
import { Button, Card, Input, Select, Label, AccentStar, AccentDiamond, AccentCircle } from "@/components/ui"
import { SignInModal } from "@/components/auth/SignInModal"
import { SubscriptionButton } from "@/components/subscription/SubscriptionButton"
import { RecentBooks } from "@/components/dashboard/RecentBooks"
import { useAuthContext } from "@/contexts/AuthContext"
import { Crown, BookOpen, Settings, User } from "lucide-react"

export default function BookMonarchDashboard() {
  const [bookTitle, setBookTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [genre, setGenre] = useState("")
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const { user, profile, loading, signOut } = useAuthContext()

  // Handle URL parameters for success/cancel notifications
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')

    if (success === 'true') {
      setNotification('🎉 Welcome to BookMonarch Pro! You can now generate up to 10 books per day.')
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (canceled === 'true') {
      setNotification('Payment was canceled. You can try again anytime!')
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Auto-hide notification after 5 seconds
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleSignOut = async () => {
    await signOut()
  }

  const handleGenerateBook = () => {
    if (!bookTitle.trim() || !authorName.trim()) {
      alert("Please enter both book title and author name")
      return
    }
    
    // TODO: Implement book generation logic
    console.log("Generating book:", { bookTitle, authorName, genre })
  }

  const genres = [
    "Fiction", "Non-Fiction", "Mystery", "Romance", "Sci-Fi", "Fantasy", 
    "Biography", "Self-Help", "Business", "History", "Health", "Travel"
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFBF5" }}>
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6" style={{ color: "#D97706" }} />
              <span className="text-xl font-bold" style={{ color: "#111827" }}>
                BookMonarch
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {loading ? (
                <div className="text-sm" style={{ color: "#111827" }}>Loading...</div>
              ) : user ? (
                <>
                  <div className="text-sm" style={{ color: "#4B5563" }}>
                    {profile?.subscription_status === 'free' ? (
                      <span>Free Plan • {profile?.books_generated_today || 0}/1 books today</span>
                    ) : (
                      <span>Pro Plan • {profile?.books_generated_today || 0}/10 books today</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" style={{ color: "#4B5563" }} />
                    <span className="text-sm" style={{ color: "#111827" }}>
                      {profile?.full_name || user.email}
                    </span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowSignInModal(true)}
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div 
            className="p-4 rounded-lg border-4 border-black shadow-lg"
            style={{
              backgroundColor: '#D1FAE5',
              boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)'
            }}
          >
            <p className="text-sm font-bold" style={{ color: '#111827' }}>
              {notification}
            </p>
            <button
              onClick={() => setNotification(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#111827" }}>
            Generate Your Book
          </h1>
          <p className="text-lg" style={{ color: "#4B5563" }}>
            Enter your book details and let AI create a full-length book for you
          </p>
        </div>

        {/* Decorative Elements */}
        <AccentStar size="sm" color="coral" className="absolute top-20 left-20 opacity-60" animated />
        <AccentDiamond size="md" color="mint" className="absolute top-32 right-32 opacity-60" animated />
        <AccentStar size="lg" color="red" className="absolute bottom-40 right-20 opacity-60" animated />
        <AccentCircle size="md" color="green" className="absolute bottom-20 left-40 opacity-60" animated />

        {/* Book Generation Form */}
        <Card variant="elevated" className="w-full max-w-2xl mx-auto relative">
          <div className="space-y-6">
            {/* Book Title */}
            <div>
              <Label required>Book Title</Label>
              <Input
                type="text"
                placeholder="e.g., The Ultimate Guide to Productivity"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                inputSize="lg"
              />
            </div>

            {/* Author Name */}
            <div>
              <Label required>Author Name</Label>
              <Input
                type="text"
                placeholder="e.g., John Smith"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                inputSize="lg"
              />
            </div>

            {/* Genre */}
            <div>
              <Label>Genre (Optional)</Label>
              <Select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                selectSize="lg"
              >
                <option value="">Select a genre (AI will choose if left blank)</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateBook}
              className="w-full"
              size="lg"
            >
              <BookOpen className="inline-block w-5 h-5 mr-2" />
              Generate Book
            </Button>

            {/* Subscription Info */}
            <div className="text-center">
              <SubscriptionButton />
            </div>
          </div>
        </Card>

        {/* Recent Books Section */}
        {user && (
          <div className="mt-12">
            <RecentBooks userId={user.id} />
          </div>
        )}
      </main>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  )
}
