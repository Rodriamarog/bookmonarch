'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { BookOpen, Download, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

interface Book {
  id: string
  title: string
  author_name: string
  genre: string
  status: string
  progress: number | null
  created_at: string
  content_url: string | null
  error_message: string | null
}

interface RecentBooksProps {
  userId: string
}

export function RecentBooks({ userId }: RecentBooksProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBooks()
  }, [userId])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setBooks(data || [])
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'pending':
      case 'outline_generated':
      case 'generating_content':
        return <Loader className="h-5 w-5 text-orange-600 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string, progress: number | null) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'pending':
        return 'Starting...'
      case 'outline_generated':
        return 'Creating chapters...'
      case 'generating_content':
        return `Generating... ${progress || 0}%`
      default:
        return 'Unknown'
    }
  }

  const handleDownload = async (bookId: string, title: string) => {
    try {
      // TODO: Implement download functionality
      console.log('Download book:', bookId)
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin mr-2" />
          <span>Loading your books...</span>
        </CardContent>
      </Card>
    )
  }

  if (books.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">No books generated yet</p>
          <p className="text-sm text-gray-500">
            Generate your first book using the form above!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Your Books
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getStatusIcon(book.status)}
                  <div>
                    <h3 className="font-bold text-gray-900">{book.title}</h3>
                    <p className="text-sm text-gray-600">by {book.author_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{getStatusText(book.status, book.progress)}</span>
                  <span>•</span>
                  <span>{new Date(book.created_at).toLocaleDateString()}</span>
                  {book.progress && book.progress > 0 && book.status !== 'completed' && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${book.progress}%` }}
                          />
                        </div>
                        <span className="text-xs">{Math.round(book.progress || 0)}%</span>
                      </div>
                    </>
                  )}
                </div>

                {book.error_message && (
                  <p className="text-sm text-red-600 mt-1">
                    Error: {book.error_message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(book.status === 'outline_complete' || book.status === 'chapters_complete' || book.status === 'completed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/debug/book/${book.id}`, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    View Details
                  </Button>
                )}
                {book.status === 'completed' && book.content_url && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
                        window.open(`/api/generate-file/${book.id}?format=pdf&userId=${userId}`, '_blank')
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1"
                    >
                      📕 PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const userId = "cffa1a68-ce03-4628-8339-e08db54a6d24" // Replace with actual user ID
                        window.open(`/api/generate-file/${book.id}?format=docx&userId=${userId}`, '_blank')
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1"
                    >
                      📄 DOCX
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}