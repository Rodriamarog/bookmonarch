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
  chapterSummaries?: string[]
  contentUrl?: string
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

        {/* Chapter Outline */}
        {bookData.chapterTitles && bookData.chapterTitles.length > 0 && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
              Chapter Outline ({bookData.chapterTitles.length} chapters)
            </h2>
            <div className="grid gap-4">
              {bookData.chapterTitles.map((title, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1"
                      style={{ backgroundColor: "#FF6B6B", color: "white" }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold mb-2" style={{ color: "#111827" }}>
                        {title}
                      </h3>
                      {bookData.chapterSummaries && bookData.chapterSummaries[index] && (
                        <p className="text-sm" style={{ color: "#4B5563", lineHeight: "1.5" }}>
                          {bookData.chapterSummaries[index]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Complete Book or Chapter Content */}
        {bookData.contentUrl && (() => {
          try {
            const bookContent = JSON.parse(bookData.contentUrl)
            
            // Check if this is the new format with complete book
            if (bookContent.completeBook && bookContent.metadata) {
              return (
                <div className="space-y-6">
                  {/* Book Metadata */}
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
                      Book Statistics
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                        <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                          {bookContent.metadata.totalWords.toLocaleString()}
                        </div>
                        <div className="text-sm" style={{ color: "#4B5563" }}>Total Words</div>
                      </div>
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                        <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                          {bookContent.metadata.totalChapters}
                        </div>
                        <div className="text-sm" style={{ color: "#4B5563" }}>Chapters</div>
                      </div>
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                        <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                          {Math.round(bookContent.metadata.totalWords / bookContent.metadata.totalChapters).toLocaleString()}
                        </div>
                        <div className="text-sm" style={{ color: "#4B5563" }}>Avg Words/Chapter</div>
                      </div>
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                        <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                          {Math.round(bookContent.metadata.totalWords / 250)}
                        </div>
                        <div className="text-sm" style={{ color: "#4B5563" }}>Est. Pages</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm" style={{ color: "#6B7280" }}>
                      Generated on {new Date(bookContent.metadata.generatedAt).toLocaleString()}
                    </div>
                  </Card>

                  {/* Complete Book Preview */}
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
                      Complete Book Preview
                    </h2>
                    <div 
                      className="prose max-w-none text-sm p-6 rounded-lg border max-h-96 overflow-y-auto"
                      style={{ 
                        backgroundColor: "#FEFEFE", 
                        color: "#374151", 
                        lineHeight: "1.6",
                        fontFamily: "'Garamond', serif"
                      }}
                    >
                      <div 
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: bookContent.completeBook.length > 5000 
                            ? `${bookContent.completeBook.substring(0, 5000)}...\n\n[Book continues for ${bookContent.completeBook.length - 5000} more characters]` 
                            : bookContent.completeBook
                        }}
                      />
                    </div>
                    <div className="mt-4 space-y-4">
                      {/* File Format Downloads */}
                      <div>
                        <h3 className="text-lg font-bold mb-3" style={{ color: "#111827" }}>
                          Download Book
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <button 
                            onClick={() => {
                              const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
                              window.open(`/api/generate-file/${bookData.id}?format=docx&userId=${userId}`, '_blank')
                            }}
                            className="px-4 py-3 rounded-lg text-white font-medium text-center"
                            style={{ backgroundColor: "#2563EB" }}
                          >
                            📄 DOCX
                            <div className="text-xs opacity-80">Editable</div>
                          </button>
                          <button 
                            onClick={() => {
                              const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
                              window.open(`/api/generate-file/${bookData.id}?format=pdf&userId=${userId}`, '_blank')
                            }}
                            className="px-4 py-3 rounded-lg text-white font-medium text-center"
                            style={{ backgroundColor: "#DC2626" }}
                          >
                            📕 PDF
                            <div className="text-xs opacity-80">5x8 Print</div>
                          </button>
                          <button 
                            onClick={() => {
                              const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
                              window.open(`/api/generate-file/${bookData.id}?format=epub&userId=${userId}`, '_blank')
                            }}
                            className="px-4 py-3 rounded-lg text-white font-medium text-center"
                            style={{ backgroundColor: "#059669" }}
                          >
                            📚 EPUB
                            <div className="text-xs opacity-80">E-Reader</div>
                          </button>
                          <button 
                            onClick={() => {
                              const blob = new Blob([bookContent.completeBook], { type: 'text/markdown' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${bookData.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="px-4 py-3 rounded-lg text-white font-medium text-center"
                            style={{ backgroundColor: "#7C3AED" }}
                          >
                            📝 Markdown
                            <div className="text-xs opacity-80">Raw Text</div>
                          </button>
                        </div>
                      </div>
                      
                      {/* Additional Actions */}
                      <div>
                        <h3 className="text-lg font-bold mb-3" style={{ color: "#111827" }}>
                          Quick Actions
                        </h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(bookContent.completeBook)
                              alert('Book content copied to clipboard!')
                            }}
                            className="px-4 py-2 rounded-lg border font-medium"
                            style={{ borderColor: "#D1D5DB", color: "#374151" }}
                          >
                            📋 Copy to Clipboard
                          </button>
                          <button 
                            onClick={() => {
                              const printWindow = window.open('', '_blank')
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html>
                                    <head><title>${bookData.title}</title></head>
                                    <body style="font-family: serif; line-height: 1.6; margin: 2em;">
                                      <pre style="white-space: pre-wrap; font-family: serif;">${bookContent.completeBook}</pre>
                                    </body>
                                  </html>
                                `)
                                printWindow.document.close()
                                printWindow.print()
                              }
                            }}
                            className="px-4 py-2 rounded-lg border font-medium"
                            style={{ borderColor: "#D1D5DB", color: "#374151" }}
                          >
                            🖨️ Print Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            }
            
            // Fallback to old format (just chapters)
            const chapterNumbers = Object.keys(bookContent).map(Number).sort((a, b) => a - b)
            
            if (chapterNumbers.length > 0) {
              return (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
                    Generated Chapters ({chapterNumbers.length} of 15)
                  </h2>
                  <div className="space-y-6">
                    {chapterNumbers.map((chapterNum) => (
                      <div key={chapterNum} className="border-l-4 border-blue-500 pl-4">
                        <h3 className="text-lg font-bold mb-2" style={{ color: "#111827" }}>
                          Chapter {chapterNum}: {bookData.chapterTitles?.[chapterNum - 1] || 'Untitled'}
                        </h3>
                        <div 
                          className="prose max-w-none text-sm p-4 rounded-lg"
                          style={{ backgroundColor: "#F9FAFB", color: "#374151", lineHeight: "1.6" }}
                        >
                          <div className="whitespace-pre-wrap">
                            {bookContent[chapterNum].length > 1000 
                              ? `${bookContent[chapterNum].substring(0, 1000)}...` 
                              : bookContent[chapterNum]
                            }
                          </div>
                          {bookContent[chapterNum].length > 1000 && (
                            <div className="mt-2 text-xs text-gray-500">
                              Showing first 1000 characters of {bookContent[chapterNum].length} total
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            }
          } catch (e) {
            // If contentUrl is not JSON, it might be a regular URL
            return null
          }
          return null
        })()}

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