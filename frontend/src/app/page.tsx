"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { SignInModal } from "@/components/auth/SignInModal"
import { SubscriptionButton } from "@/components/subscription/SubscriptionButton"
import { useAuthContext } from "@/contexts/AuthContext"
import { Crown, BookOpen, Settings, User } from "lucide-react"

export default function BookMonarchDashboard() {
  const [bookTitle, setBookTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [genre, setGenre] = useState("")
  const [showSignInModal, setShowSignInModal] = useState(false)
  const { user, profile, loading, signOut } = useAuthContext()

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

        {/* Book Generation Form */}
        <div
          className="w-full max-w-2xl mx-auto p-8 rounded-2xl border-2 relative"
          style={{
            backgroundColor: "#FFEEDB",
            borderColor: "#1F2937",
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25),
                        0 0 0 1px rgba(255, 255, 255, 0.05),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
            background: `linear-gradient(135deg, #FFEEDB 0%, #FFE4C4 100%)`,
          }}
        >
          <div className="space-y-6">
            {/* Book Title */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#1F2937" }}>
                Book Title *
              </label>
              <input
                type="text"
                placeholder="e.g., The Ultimate Guide to Productivity"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                className="w-full text-base px-4 py-3 rounded-lg border-2 transition-all duration-200"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#4B5563",
                  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  boxShadow: `inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)`,
                }}
              />
            </div>

            {/* Author Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#1F2937" }}>
                Author Name *
              </label>
              <input
                type="text"
                placeholder="e.g., John Smith"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full text-base px-4 py-3 rounded-lg border-2 transition-all duration-200"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#4B5563",
                  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  boxShadow: `inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)`,
                }}
              />
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#1F2937" }}>
                Genre (Optional)
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full text-base px-4 py-3 rounded-lg border-2 transition-all duration-200"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#4B5563",
                  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  boxShadow: `inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)`,
                }}
              >
                <option value="">Select a genre (AI will choose if left blank)</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateBook}
              className="w-full px-6 py-4 rounded-lg font-medium text-lg border-none relative overflow-hidden transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
              style={{
                backgroundColor: "#D97706",
                color: "#FFFFFF",
                boxShadow: `0 4px 8px rgba(217, 119, 6, 0.3),
                           0 1px 3px rgba(0, 0, 0, 0.2),
                           inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                background: `linear-gradient(135deg, #D97706 0%, #B45309 100%)`,
              }}
            >
              <BookOpen className="inline-block w-5 h-5 mr-2" />
              Generate Book
            </button>

            {/* Subscription Info */}
            <div className="text-center">
              <SubscriptionButton />
            </div>
          </div>
        </div>

        {/* Recent Books Section (placeholder) */}
        {user && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
              Your Books
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <p style={{ color: "#4B5563" }}>
                Your generated books will appear here
              </p>
            </div>
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
