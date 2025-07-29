"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui"

export default function TestBookPage() {
  const [bookContent, setBookContent] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load the test book content from API
    fetch('/api/test-book')
      .then(response => response.text())
      .then(content => {
        setBookContent(content)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error loading test book:', error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading test book...</div>
        </div>
      </div>
    )
  }

  // Mock book data for testing
  const mockBookData = {
    title: "The Complete Guide to Digital Marketing",
    author: "John Smith",
    genre: "Non-fiction",
    status: "completed",
    progress: 100,
    metadata: {
      totalWords: 16575,
      totalChapters: 15,
      generatedAt: new Date().toISOString()
    }
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#FFFBF5" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="p-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>
            Test Book Preview
          </h1>
          <p className="text-lg mb-4" style={{ color: "#4B5563" }}>
            Testing book formatting with cached content
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Title:</strong> {mockBookData.title}
            </div>
            <div>
              <strong>Author:</strong> {mockBookData.author}
            </div>
            <div>
              <strong>Status:</strong> {mockBookData.status}
            </div>
            <div>
              <strong>Progress:</strong> {mockBookData.progress}%
            </div>
          </div>
        </Card>

        {/* Book Statistics */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
            Book Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
              <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                {mockBookData.metadata.totalWords.toLocaleString()}
              </div>
              <div className="text-sm" style={{ color: "#4B5563" }}>Total Words</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
              <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                {mockBookData.metadata.totalChapters}
              </div>
              <div className="text-sm" style={{ color: "#4B5563" }}>Chapters</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
              <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                {Math.round(mockBookData.metadata.totalWords / mockBookData.metadata.totalChapters).toLocaleString()}
              </div>
              <div className="text-sm" style={{ color: "#4B5563" }}>Avg Words/Chapter</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
              <div className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                {Math.round(mockBookData.metadata.totalWords / 250)}
              </div>
              <div className="text-sm" style={{ color: "#4B5563" }}>Est. Pages</div>
            </div>
          </div>
        </Card>

        {/* Complete Book Preview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#111827" }}>
            Complete Book Preview (PDF-like Rendering)
          </h2>
          <div 
            className="border rounded-lg overflow-hidden"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {/* PDF-like container with proper styling */}
            <div 
              className="max-h-96 overflow-y-auto"
              style={{ 
                backgroundColor: "#FFFFFF",
                padding: "40px",
                fontFamily: "'Garamond', serif",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#000000"
              }}
            >
              <div 
                dangerouslySetInnerHTML={{
                  __html: bookContent
                }}
                style={{
                  // Override any conflicting styles
                  fontFamily: "'Garamond', serif",
                  color: "#000000"
                }}
              />
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {/* File Format Downloads */}
            <div>
              <h3 className="text-lg font-bold mb-3" style={{ color: "#111827" }}>
                Download Test Book
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => {
                    const blob = new Blob([bookContent], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'Ultimate_Guide_To_Gaming.md'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="px-4 py-3 rounded-lg text-white font-medium text-center"
                  style={{ backgroundColor: "#7C3AED" }}
                >
                  📝 Markdown
                  <div className="text-xs opacity-80">Raw Text (PDF/EPUB generation moved to backend)</div>
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
                    navigator.clipboard.writeText(bookContent)
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
                          <head><title>Ultimate Guide To Gaming</title></head>
                          <body style="font-family: serif; line-height: 1.6; margin: 2em;">
                            <pre style="white-space: pre-wrap; font-family: serif;">${bookContent}</pre>
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
    </div>
  )
}