'use client'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { Download, FileText, File, BookOpen, CheckCircle } from 'lucide-react'
import useBookManagement from '@/hooks/useBookManagement'

interface BookPreviewProps {
  bookId: string
  title: string
  author: string
  status: string
  progress: number
  currentStep?: string
  pdfUrl?: string
  epubUrl?: string
  metadataUrl?: string
  onRefresh?: () => void
}

export function BookPreview({ 
  bookId, 
  title, 
  author, 
  status, 
  progress, 
  currentStep, 
  pdfUrl, 
  epubUrl, 
  metadataUrl,
  onRefresh 
}: BookPreviewProps) {
  const { downloadFile, isLoading } = useBookManagement()

  const handleDownload = async (fileType: 'pdf' | 'epub' | 'metadata') => {
    try {
      await downloadFile(bookId, fileType)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. Please try again.')
    }
  }

  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'
  const isGenerating = status === 'generating_content' || status === 'pending'

  return (
    <Card variant="elevated" className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: "#D97706" }} />
          {isCompleted ? 'Book Complete!' : isGenerating ? 'Generating Book...' : 'Book Status'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Book Info */}
        <div>
          <h3 className="font-bold text-lg mb-1" style={{ color: "#111827" }}>
            {title || 'Untitled Book'}
          </h3>
          <p className="text-sm" style={{ color: "#4B5563" }}>
            by {author || 'Unknown Author'}
          </p>
        </div>

        {/* Status Section */}
        {isGenerating && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium mb-2" style={{ color: "#111827" }}>
                {currentStep || 'Processing...'}
              </p>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="h-3 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: "#FF6B6B"
                }}
              />
            </div>
            
            <div className="text-center">
              <p className="text-xs" style={{ color: "#4B5563" }}>
                {Math.round(progress)}% complete
              </p>
            </div>
          </div>
        )}

        {/* Completion Status */}
        {isCompleted && (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: "#10B981" }} />
            <p className="font-medium" style={{ color: "#10B981" }}>
              Your book is ready!
            </p>
            <p className="text-sm mt-1" style={{ color: "#4B5563" }}>
              Download your book in different formats below
            </p>
          </div>
        )}

        {/* Failed Status */}
        {isFailed && (
          <div className="text-center py-4">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <p className="font-medium text-red-600">
              Generation failed
            </p>
            <p className="text-sm mt-1" style={{ color: "#4B5563" }}>
              Please try generating your book again
            </p>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="secondary"
                size="sm"
                className="mt-3"
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Download Section */}
        {isCompleted && (
          <div className="space-y-3">
            <h4 className="font-medium" style={{ color: "#111827" }}>
              Download Options
            </h4>
            
            <div className="space-y-2">
              {/* PDF Download */}
              <Button
                onClick={() => handleDownload('pdf')}
                variant="secondary"
                className="w-full justify-start"
                disabled={isLoading || !pdfUrl}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
              </Button>

              {/* EPUB Download */}
              <Button
                onClick={() => handleDownload('epub')}
                variant="secondary"
                className="w-full justify-start"
                disabled={isLoading || !epubUrl}
              >
                <File className="h-4 w-4 mr-2" />
                Download EPUB
              </Button>

              {/* Metadata Download */}
              <Button
                onClick={() => handleDownload('metadata')}
                variant="secondary"
                className="w-full justify-start"
                disabled={isLoading || !metadataUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Marketing Info
              </Button>
            </div>
          </div>
        )}

        {/* Placeholder for no active generation */}
        {!isGenerating && !isCompleted && !isFailed && (
          <div className="text-center py-8">
            <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" style={{ color: "#4B5563" }} />
            <p className="text-sm opacity-60" style={{ color: "#4B5563" }}>
              Fill out the form and click &quot;Generate Book&quot; to start creating your book
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}