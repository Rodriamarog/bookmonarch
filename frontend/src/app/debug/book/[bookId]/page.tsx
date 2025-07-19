"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui"

interface BookData {
  id: string
  title: string
  author: string
  genre: string
  writingStyle?: string
  status: string
  progress: number
  plotSummary?: string
  chapterTitles?: string[]
  currentStage: string
  createdAt: string
}

export default function BookDebugPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBookData = async () => {
      try {
        // You'll need to replace this with the actual user ID
        const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
        
        const response = await fetch(`/api/book-status/${bookId}?userId=${userId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch book data')
        }

        setBookData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (bookId) {
      fetchBookData()
    }
  }, [bookId])

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading book data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p>{error}</p>
          </Card>
        </div>
      </div>
    )
  }

  if (!bookData) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center">No book data found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="p-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>
            {bookData.title}
          </h1>
          <p className="text-lg mb-4" style={{ color: "#4B5563" }}>
            by {bookData.author}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Genre:</strong> {bookData.genre}
            </div>
            <div>
              <strong>Status:</strong> {bookData.status}
            </div>
            <div>
              <strong>Progress:</strong> {bookData.progress}%
            </div>
            <div>
              <strong>Writing Style:</strong> {bookData.writingStyle || 'Default'}
            </div>
          </div>
          <div className="mt-4">
            <strong>Current Stage:</strong> {bookData.currentStage}
          </div>
        </Card>

        {/* Plot Summary */}
        {bookData.plotSummary && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
              Plot Summary
            </h2>
            <div className="prose max-w-none">
              <p style={{ color: "#374151", lineHeight: "1.6" }}>
                {bookData.plotSummary}
              </p>
            </div>
          </Card>
        )}

        {/* Chapter Titles */}
        {bookData.chapterTitles && bookData.chapterTitles.length > 0 && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
              Chapter Titles ({bookData.chapterTitles.length} chapters)
            </h2>
            <div className="grid gap-3">
              {bookData.chapterTitles.map((title, index) => (
                <div 
                  key={index}
                  className="flex items-center p-3 rounded-lg border"
                  style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3"
                    style={{ backgroundColor: "#FF6B6B", color: "white" }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ color: "#111827" }}>
                    {title}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Debug Info */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
            Debug Information
          </h2>
          <div className="space-y-2 text-sm font-mono">
            <div><strong>Book ID:</strong> {bookData.id}</div>
            <div><strong>Created:</strong> {new Date(bookData.createdAt).toLocaleString()}</div>
            <div><strong>Total Chapters:</strong> 15</div>
          </div>
        </Card>
      </div>
    </div>
  )
}