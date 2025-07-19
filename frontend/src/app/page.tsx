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
  const [bookType, setBookType] = useState("Non-fiction")
  const [writingStyle, setWritingStyle] = useState("")
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStage, setGenerationStage] = useState("")
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
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

  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!bookTitle.trim()) {
      errors.bookTitle = "Book title is required"
    }
    
    if (!authorName.trim()) {
      errors.authorName = "Author name is required"
    }
    
    if (!bookType) {
      errors.bookType = "Book type is required"
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleGenerateBook = async () => {
    if (!validateForm()) {
      return
    }
    
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStage("Initializing book generation...")
    
    try {
      // Call the generate-book API
      const response = await fetch('/api/generate-book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: bookTitle,
          author: authorName,
          bookType: bookType,
          writingStyle: writingStyle || undefined,
          userId: user?.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.limitReached) {
          alert(result.error)
          return
        }
        throw new Error(result.error || 'Failed to start book generation')
      }

      const { bookId, accessToken } = result
      
      // Start polling for progress
      await pollBookProgress(bookId, user?.id, accessToken)
      
    } catch (error) {
      console.error("Book generation failed:", error)
      setGenerationStage("Generation failed")
      alert(error instanceof Error ? error.message : "Book generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
      setGenerationStage("")
    }
  }

  const pollBookProgress = async (bookId: string, userId?: string, accessToken?: string) => {
    const maxPollingTime = 30 * 60 * 1000 // 30 minutes max
    const pollingInterval = 2000 // 2 seconds
    const startTime = Date.now()

    const poll = async () => {
      try {
        const params = new URLSearchParams()
        if (userId) params.append('userId', userId)
        if (accessToken) params.append('accessToken', accessToken)

        const response = await fetch(`/api/book-status/${bookId}?${params}`)
        const bookStatus = await response.json()

        if (!response.ok) {
          throw new Error(bookStatus.error || 'Failed to fetch book status')
        }

        // Update progress
        setGenerationProgress(bookStatus.progress || 0)
        setGenerationStage(bookStatus.currentStage || 'Processing...')

        // Check if generation is complete
        if (bookStatus.status === 'completed') {
          setGenerationStage("Book generation complete!")
          setNotification('🎉 Your book has been generated successfully! Check your library to download it.')
          return
        }

        // Check if generation failed
        if (bookStatus.status === 'failed') {
          throw new Error(bookStatus.errorMessage || 'Book generation failed')
        }

        // Check if we should continue polling
        if (Date.now() - startTime < maxPollingTime && 
            (bookStatus.status === 'generating' || bookStatus.status === 'outline_complete')) {
          setTimeout(poll, pollingInterval)
        } else if (bookStatus.status === 'outline_complete') {
          setGenerationStage("Book outline complete! Full chapter generation will be available soon.")
          setNotification('📝 Book outline generated successfully! Full chapter generation coming in the next update.')
        } else {
          throw new Error('Book generation timed out')
        }

      } catch (error) {
        console.error('Polling error:', error)
        setGenerationStage("Generation failed")
        throw error
      }
    }

    await poll()
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
                onChange={(e) => {
                  setBookTitle(e.target.value)
                  if (validationErrors.bookTitle) {
                    setValidationErrors(prev => ({ ...prev, bookTitle: "" }))
                  }
                }}
                inputSize="lg"
                className={validationErrors.bookTitle ? "border-red-500" : ""}
              />
              {validationErrors.bookTitle && (
                <p className="text-sm mt-1 text-red-600">{validationErrors.bookTitle}</p>
              )}
            </div>

            {/* Author Name */}
            <div>
              <Label required>Author Name</Label>
              <Input
                type="text"
                placeholder="e.g., John Smith"
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value)
                  if (validationErrors.authorName) {
                    setValidationErrors(prev => ({ ...prev, authorName: "" }))
                  }
                }}
                inputSize="lg"
                className={validationErrors.authorName ? "border-red-500" : ""}
              />
              {validationErrors.authorName && (
                <p className="text-sm mt-1 text-red-600">{validationErrors.authorName}</p>
              )}
            </div>

            {/* Book Type */}
            <div>
              <Label required>Book Type</Label>
              <Select
                value={bookType}
                onChange={(e) => {
                  setBookType(e.target.value)
                  if (validationErrors.bookType) {
                    setValidationErrors(prev => ({ ...prev, bookType: "" }))
                  }
                }}
                selectSize="lg"
                className={validationErrors.bookType ? "border-red-500" : ""}
              >
                <option value="Non-fiction">Non-fiction</option>
                <option value="Fiction" disabled>Fiction (Coming Soon)</option>
                <option value="Cookbook" disabled>Cookbook (Coming Soon)</option>
                <option value="Biography" disabled>Biography (Coming Soon)</option>
                <option value="Self-Help" disabled>Self-Help (Coming Soon)</option>
              </Select>
              {validationErrors.bookType && (
                <p className="text-sm mt-1 text-red-600">{validationErrors.bookType}</p>
              )}
            </div>

            {/* Writing Style */}
            <div>
              <Label>Writing Style (Optional)</Label>
              <Input
                type="text"
                placeholder="e.g., Conversational and practical, Academic and detailed, Simple and beginner-friendly"
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                inputSize="lg"
              />
              <p className="text-sm mt-2" style={{ color: "#4B5563" }}>
                Describe the tone and approach you'd like for your book. Leave blank for AI to decide.
              </p>
            </div>

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "#111827" }}>
                    {generationStage}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${generationProgress}%`,
                      backgroundColor: "#FF6B6B"
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#4B5563" }}>
                    {Math.round(generationProgress)}% complete
                  </p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerateBook}
              className="w-full"
              size="lg"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="inline-block w-5 h-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <BookOpen className="inline-block w-5 h-5 mr-2" />
                  Generate Book
                </>
              )}
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
