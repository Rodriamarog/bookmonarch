"use client"

import { useState, useEffect } from "react"
import { Button, Card, Input, Select, Label, AccentStar, AccentDiamond, AccentCircle, NavigationMenu } from "@/components/ui"
import { SignInModal } from "@/components/auth/SignInModal"
import { SubscriptionButton } from "@/components/subscription/SubscriptionButton"
import { BookPreview } from "@/components/dashboard/BookPreview"
import { useAuthContext } from "@/contexts/AuthContext"
import { BookOpen } from "lucide-react"
import { bookGenerationService } from "@/lib/api/book-generation"
import { useErrorHandler } from "@/lib/error-handling"

export default function BookMonarchDashboard() {
  const [bookTitle, setBookTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [bookType, setBookType] = useState("Non-fiction")
  const [coverDesignStyle, setCoverDesignStyle] = useState("")
  const [writingStyle, setWritingStyle] = useState("")
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStage, setGenerationStage] = useState("")
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const [currentBookId, setCurrentBookId] = useState<string | null>(null)
  const [currentBookStatus, setCurrentBookStatus] = useState<string>("")
  const [bookFileUrls, setBookFileUrls] = useState<{
    pdf_url?: string
    epub_url?: string
    metadata_url?: string
  }>({})
  const { user, profile, loading } = useAuthContext()
  
  // Initialize error handler for this component
  const { handleError } = useErrorHandler({
    component: 'BookMonarchDashboard',
    userId: user?.id
  })

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
    setCurrentBookStatus("pending")
    setBookFileUrls({})
    
    console.log('🚀 Starting book generation...')
    
    try {
      // Create request using the service
      const request = bookGenerationService.createRequest(bookTitle, authorName);
      console.log('📝 Request data:', request)
      
      // Use the service for generation with progress tracking
      const result = await bookGenerationService.generateBookWithProgress(request, {
        pollInterval: 2000, // 2 seconds
        timeout: 30 * 60 * 1000, // 30 minutes
        onProgress: (status) => {
          console.log('📈 Progress update:', status.progress, 'Stage:', status.current_step)
          setGenerationProgress(status.progress)
          setGenerationStage(status.current_step || 'Processing...')
          setCurrentBookId(status.book_id)
          setCurrentBookStatus(status.status)
          
          // Update file URLs if available
          if (status.files) {
            setBookFileUrls({
              pdf_url: status.files.pdf_url,
              epub_url: status.files.epub_url,
              metadata_url: status.files.metadata_url
            })
          }
          
          // Handle completion within progress callback
          if (status.status === 'completed') {
            setGenerationStage("Book generation complete!")
            setNotification('🎉 Your book has been generated successfully!')
          }
        }
      });
      
      console.log('✅ Book generation completed:', result)
      
    } catch (error) {
      const errorResult = handleError(error);
      
      // Special handling for generation limit exceeded
      if (errorResult.code === 'GENERATION_LIMIT_EXCEEDED') {
        alert(errorResult.userMessage);
        return;
      }
      
      setGenerationStage("Generation failed");
      setCurrentBookStatus("failed");
      alert(errorResult.userMessage);
    } finally {
      setIsGenerating(false)
    }
  }

  // Note: Polling is now handled by the BookGenerationService
  // The pollBookProgress function has been removed and replaced with the
  // service-based approach that includes sophisticated polling with abort controllers

  const coverDesignStyles = [
    { value: "", label: "Let AI choose" },
    { value: "modern", label: "Modern" },
    { value: "minimalist", label: "Minimalist" },
    { value: "vintage", label: "Vintage" },
    { value: "pop-art", label: "Pop Art" },
    { value: "anime", label: "Anime" },
    { value: "illustration", label: "Illustration" },
    { value: "abstract", label: "Abstract" },
    { value: "corporate", label: "Corporate" },
    { value: "hand-drawn", label: "Hand-drawn" },
    { value: "photographic", label: "Photographic" }
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFBF5" }}>
      <NavigationMenu />

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "#111827" }}>
            Generate Your Book
          </h1>
          <p className="text-base md:text-lg" style={{ color: "#4B5563" }}>
            Enter your book details and watch AI create a full-length book for you
          </p>
        </div>

        {/* Decorative Elements - Hidden on mobile for better experience */}
        <AccentStar size="sm" color="coral" className="hidden lg:block absolute top-20 left-20 opacity-60" animated />
        <AccentDiamond size="md" color="mint" className="hidden lg:block absolute top-32 right-32 opacity-60" animated />
        <AccentStar size="lg" color="red" className="hidden lg:block absolute bottom-40 right-20 opacity-60" animated />
        <AccentCircle size="md" color="green" className="hidden lg:block absolute bottom-20 left-40 opacity-60" animated />

        {/* Side-by-Side Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* Left Panel - Book Generation Form */}
          <Card variant="elevated" className="h-fit">
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

              {/* Cover Design Style */}
              <div>
                <Label>Cover Design Style (Optional)</Label>
                <Select
                  value={coverDesignStyle}
                  onChange={(e) => setCoverDesignStyle(e.target.value)}
                  selectSize="lg"
                >
                  {coverDesignStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </Select>
                <p className="text-sm mt-2" style={{ color: "#4B5563" }}>
                  Choose a design style for your book cover. This feature is coming soon!
                </p>
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
                  Describe the tone and approach you&apos;d like for your book. Leave blank for AI to decide.
                </p>
              </div>

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

          {/* Right Panel - Book Preview */}
          <BookPreview
            bookId={currentBookId || ''}
            title={bookTitle}
            author={authorName}
            status={currentBookStatus}
            progress={generationProgress}
            currentStep={generationStage}
            pdfUrl={bookFileUrls.pdf_url}
            epubUrl={bookFileUrls.epub_url}
            metadataUrl={bookFileUrls.metadata_url}
            onRefresh={() => {
              setIsGenerating(false)
              setGenerationProgress(0)
              setGenerationStage('')
              setCurrentBookStatus('')
              setCurrentBookId(null)
              setBookFileUrls({})
            }}
          />
        </div>
      </main>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  )
}
